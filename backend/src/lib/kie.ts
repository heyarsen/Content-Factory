import axios from 'axios'

const KIE_API_URL = 'https://api.kie.ai/api/v1'

/**
 * Retry function with exponential backoff for handling rate limits
 * (inlined here to avoid coupling KIE/Sora to Perplexity module resolution)
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error: any) {
            lastError = error
            const status = error.response?.status

            // Only retry on 429 (rate limit) or 5xx errors
            if (status === 429 || (status >= 500 && status < 600)) {
                if (attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt)

                    const retryAfter = error.response?.headers?.['retry-after']
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay

                    console.log(
                        `Rate limit or server error (${status}), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`
                    )
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    continue
                }
            }

            throw error
        }
    }

    throw lastError || new Error('Max retries exceeded')
}

/**
 * Get KIE API key from environment
 */
function getKieApiKey(): string {
    const key = process.env.KIE_API_KEY
    if (!key) {
        throw new Error('Missing KIE_API_KEY environment variable')
    }
    return key
}

/**
 * Sora aspect ratio options
 * Per docs: only 'portrait' and 'landscape' are supported.
 */
export type SoraAspectRatio = 'landscape' | 'portrait'

/**
 * Request payload for creating a Sora text-to-video task
 */
export interface CreateSoraTaskRequest {
    model: 'sora-2-text-to-video-stable'
    callBackUrl?: string
    input: {
        prompt: string
        aspect_ratio: SoraAspectRatio
        n_frames?: string // Duration in frames, default "10"
        remove_watermark?: boolean
        character_id_list?: string[]
        language?: string // Optional language parameter (e.g., 'en', 'es', 'fr')
    }
}

/**
 * Response from creating a Sora task
 */
export interface CreateSoraTaskResponse {
    code: number
    msg: string
    data: {
        taskId: string
    }
}

/**
 * Task status response from KIE API
 * Per docs: state can be 'waiting', 'success', or 'fail'
 * Results are in resultJson as a JSON string
 */
export interface SoraTaskDetail {
    code: number
    msg: string
    data: {
        taskId: string
        model: string
        state: 'waiting' | 'success' | 'fail' // API uses 'state', not 'status'
        param: string // JSON string of original request params
        resultJson: string | null // JSON string containing resultUrls array when success
        failCode: string | null
        failMsg: string | null
        costTime: number | null // milliseconds
        completeTime: number | null // timestamp
        createTime: number // timestamp
    }
}

/**
 * Map aspect ratio from internal format to Sora format
 */
export function mapAspectRatioToSora(aspectRatio?: string | null): SoraAspectRatio {
    if (!aspectRatio) return 'portrait' // Default to portrait for vertical videos

    // Handle common aspect ratio formats
    if (aspectRatio === '9:16' || aspectRatio === 'vertical') return 'portrait'
    if (aspectRatio === '16:9' || aspectRatio === 'horizontal') return 'landscape'

    // Default to portrait
    return 'portrait'
}

/**
 * Calculate n_frames from duration in seconds.
 * Updated to support longer durations beyond the previous 15-second limit.
 */
export function calculateFramesFromDuration(durationSeconds: number): string {
    // Cap at 15 frames based on KIE Sora2 API maximum limit
    const maxFrames = 15
    return Math.min(durationSeconds, maxFrames).toString()
}

/**
 * Create a Sora text-to-video generation task
 */
export async function createSoraTask(
    prompt: string,
    aspectRatio: SoraAspectRatio = 'portrait',
    options: {
        nFrames?: string
        removeWatermark?: boolean
        characterIdList?: string[]
        callBackUrl?: string
        language?: string // Optional language parameter
    } = {}
): Promise<CreateSoraTaskResponse> {
    const apiKey = getKieApiKey()

    const payload: CreateSoraTaskRequest = {
        model: 'sora-2-text-to-video-stable',
        callBackUrl: options.callBackUrl,
        input: {
            prompt,
            aspect_ratio: aspectRatio,
            n_frames: options.nFrames || '10',
            remove_watermark: options.removeWatermark ?? true,
            character_id_list: options.characterIdList,
            ...(options.language && { language: options.language }),
        },
    }

    console.log('[KIE Sora] Creating task with payload:', {
        prompt: prompt.substring(0, 100) + '...',
        aspect_ratio: aspectRatio,
        n_frames: payload.input.n_frames,
    })

    try {
        const response = await retryWithBackoff(
            async () => {
                return await axios.post<CreateSoraTaskResponse>(
                    `${KIE_API_URL}/jobs/createTask`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 30000,
                    }
                )
            },
            3, // maxRetries
            1000 // initialDelay
        )

        if (response.data.code !== 200) {
            throw new Error(`KIE API error: ${response.data.msg}`)
        }

        console.log('[KIE Sora] Task created successfully:', response.data.data.taskId)
        return response.data
    } catch (error: any) {
        console.error('[KIE Sora] Failed to create task:', error)

        let errorMessage = 'Failed to create Sora video generation task'

        if (error.response) {
            const status = error.response.status
            const data = error.response.data

            if (status === 401) {
                errorMessage = 'KIE API authentication failed. Please check your KIE_API_KEY environment variable.'
            } else if (status === 402) {
                errorMessage = 'Insufficient credits in your KIE account.'
            } else if (status === 422) {
                errorMessage = `Invalid request parameters: ${data?.msg || 'Validation error'}`
            } else if (status === 429) {
                errorMessage = 'KIE API rate limit exceeded. Please try again later.'
            } else if (status === 455) {
                errorMessage = 'KIE service is currently undergoing maintenance.'
            } else if (status >= 500) {
                errorMessage = 'KIE API server error. Please try again later.'
            } else if (data?.msg) {
                errorMessage = `KIE API error: ${data.msg}`
            }
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'Request timeout while connecting to KIE API.'
        } else if (error.message) {
            errorMessage = error.message
        }

        const enhancedError = new Error(errorMessage)
            ; (enhancedError as any).status = error.response?.status || 500
        throw enhancedError
    }
}

/**
 * Get task details and status
 */
export async function getTaskDetails(taskId: string): Promise<SoraTaskDetail> {
    const apiKey = getKieApiKey()

    try {
        // Per docs, task status endpoint is /jobs/recordInfo?taskId=...
        const response = await axios.get<SoraTaskDetail>(`${KIE_API_URL}/jobs/recordInfo`, {
            params: { taskId },
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        })

        if (response.data.code !== 200) {
            if (response.data.msg?.includes('recordInfo is null')) {
                console.warn(
                    `[KIE Sora] Task ${taskId} is not indexed yet (recordInfo is null); treating as waiting`
                )

                return {
                    code: 200,
                    msg: 'Task is still being indexed',
                    data: {
                        taskId,
                        model: 'sora-2-text-to-video-stable',
                        state: 'waiting',
                        param: '',
                        resultJson: null,
                        failCode: null,
                        failMsg: null,
                        costTime: null,
                        completeTime: null,
                        createTime: Date.now(),
                    },
                }
            }

            throw new Error(`KIE API error: ${response.data.msg}`)
        }

        return response.data
    } catch (error: any) {
        console.error('[KIE Sora] Failed to get task details:', error)

        let errorMessage = 'Failed to retrieve task status'

        if (error.response) {
            const status = error.response.status
            const data = error.response.data

            if (status === 401) {
                errorMessage = 'KIE API authentication failed.'
            } else if (status === 404) {
                errorMessage = `Task not found: ${taskId}`
            } else if (data?.msg) {
                errorMessage = `KIE API error: ${data.msg}`
            }
        } else if (error.message) {
            errorMessage = error.message
        }

        const enhancedError = new Error(errorMessage)
            ; (enhancedError as any).status = error.response?.status || 500
        throw enhancedError
    }
}

/**
 * Poll task status until completion or timeout
 */
export async function pollTaskUntilComplete(
    taskId: string,
    options: {
        maxAttempts?: number
        pollInterval?: number // milliseconds
        onProgress?: (progress: number, status: string) => void
    } = {}
): Promise<SoraTaskDetail> {
    // Increase timeout: 120 attempts * 10s = 20 minutes (video generation can take longer)
    const maxAttempts = options.maxAttempts || 120 // 120 attempts = 20 minutes with 10s interval
    const pollInterval = options.pollInterval || 10000 // 10 seconds (less frequent polling)

    let attempts = 0

    while (attempts < maxAttempts) {
        attempts++

        const taskDetail = await getTaskDetails(taskId)
        const state = taskDetail.data.state // API uses 'state', not 'status'

        console.log(`[KIE Sora] Task ${taskId} state: ${state} (attempt ${attempts}/${maxAttempts})`)

        if (options.onProgress) {
            // Calculate progress based on attempts (since API doesn't provide progress)
            const progress = Math.min(95, Math.round((attempts / maxAttempts) * 100))
            options.onProgress(progress, state)
        }

        if (state === 'success') {
            console.log(`[KIE Sora] Task ${taskId} completed successfully`)
            return taskDetail
        }

        if (state === 'fail') {
            const errorMsg = taskDetail.data.failMsg || taskDetail.data.failCode || 'Video generation failed'
            console.error(`[KIE Sora] Task ${taskId} failed:`, errorMsg)
            throw new Error(`Sora video generation failed: ${errorMsg}`)
        }

        // State is 'waiting' - continue polling
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`)
}
