import axios from 'axios'

const KIE_API_URL = 'https://api.kie.ai/api/v1'
const POYO_API_URL = process.env.POYO_API_URL || 'https://api.poyo.ai'

const CREATE_TASK_ENDPOINTS: Record<SoraProvider, string[]> = {
    kie: ['/jobs/createTask'],
    poyo: ['/api/generate/submit'],
}

const TASK_DETAILS_ENDPOINTS: Record<SoraProvider, string[]> = {
    kie: ['/jobs/recordInfo'],
    poyo: ['/api/task/status', '/api/task-management/status'],
}

export type SoraProvider = 'kie' | 'poyo'
export type SoraModel = 'sora-2' | 'sora-2-private' | 'sora-2-stable'

const soraModelMap: Record<SoraModel, string> = {
    'sora-2': 'sora-2-text-to-video',
    'sora-2-private': 'sora-2-text-to-video-private',
    'sora-2-stable': 'sora-2-text-to-video-stable',
}

const poyoModelMap: Record<SoraModel, string> = {
    'sora-2': 'sora-2',
    'sora-2-private': 'sora-2-private',
    // POYO docs only list sora-2 and sora-2-private.
    'sora-2-stable': 'sora-2',
}

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
function getApiConfig(provider: SoraProvider): { apiKey: string; baseUrl: string } {
    const key = provider === 'poyo' ? process.env.POYO_API_KEY : process.env.KIE_API_KEY
    if (!key) {
        throw new Error(
            provider === 'poyo'
                ? 'Missing POYO_API_KEY environment variable'
                : 'Missing KIE_API_KEY environment variable'
        )
    }

    return {
        apiKey: key,
        baseUrl: provider === 'poyo' ? POYO_API_URL : KIE_API_URL,
    }
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
    model: string
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
        status?: string
        createdTime?: string
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

function mapPoyoAspectRatio(aspectRatio: SoraAspectRatio): '9:16' | '16:9' {
    return aspectRatio === 'landscape' ? '16:9' : '9:16'
}

function mapPoyoDuration(nFrames?: string): 10 | 15 {
    const parsed = Number.parseInt(nFrames || '10', 10)
    return parsed > 10 ? 15 : 10
}

function normalizeCreateTaskResponse(raw: any, provider: SoraProvider): CreateSoraTaskResponse {
    if (provider === 'poyo') {
        return {
            code: raw?.code ?? 500,
            msg: raw?.msg || '',
            data: {
                taskId: raw?.data?.task_id,
                status: raw?.data?.status,
                createdTime: raw?.data?.created_time,
            },
        }
    }

    return raw
}

function normalizeTaskDetailResponse(raw: any, taskId: string, provider: SoraProvider): SoraTaskDetail {
    if (provider === 'poyo') {
        const status: string = raw?.data?.status || raw?.data?.state || 'not_started'
        const mappedState: 'waiting' | 'success' | 'fail' =
            status === 'finished' || status === 'success'
                ? 'success'
                : status === 'failed' || status === 'fail'
                    ? 'fail'
                    : 'waiting'

        const resultUrl = raw?.data?.result_url || raw?.data?.video_url || raw?.data?.url
        const resultJson = resultUrl ? JSON.stringify({ resultUrls: [resultUrl] }) : null

        return {
            code: raw?.code ?? 500,
            msg: raw?.msg || '',
            data: {
                taskId,
                model: raw?.data?.model || 'sora-2',
                state: mappedState,
                param: JSON.stringify(raw?.data || {}),
                resultJson,
                failCode: raw?.error?.type || null,
                failMsg: raw?.error?.message || raw?.data?.error_message || null,
                costTime: null,
                completeTime: null,
                createTime: Date.now(),
            },
        }
    }

    return raw
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
        model?: SoraModel
        provider?: SoraProvider
    } = {}
): Promise<CreateSoraTaskResponse> {
    const provider = options.provider || 'kie'
    const { apiKey, baseUrl } = getApiConfig(provider)

    const payload: Record<string, any> =
        provider === 'poyo'
            ? {
                model: poyoModelMap[options.model || 'sora-2-stable'],
                callback_url: options.callBackUrl,
                input: {
                    prompt,
                    duration: mapPoyoDuration(options.nFrames),
                    aspect_ratio: mapPoyoAspectRatio(aspectRatio),
                },
            }
            : {
                model: soraModelMap[options.model || 'sora-2-stable'],
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

    console.log('[Sora API] Creating task with payload:', {
        provider,
        model: payload.model,
        prompt: prompt.substring(0, 100) + '...',
        aspect_ratio: payload.input.aspect_ratio,
        duration_or_frames: payload.input.duration || payload.input.n_frames,
    })

    try {
        const endpoints = CREATE_TASK_ENDPOINTS[provider]
        let response: { data: CreateSoraTaskResponse } | null = null
        let lastError: any = null

        for (const endpoint of endpoints) {
            try {
                response = await retryWithBackoff(
                    async () => {
                        return await axios.post(`${baseUrl}${endpoint}`, payload, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                            },
                            timeout: 30000,
                        })
                    },
                    3,
                    1000
                )
                break
            } catch (error: any) {
                lastError = error
                const status = error?.response?.status
                // If endpoint was not found, continue to next known variant.
                if (status === 404 && provider === 'poyo') {
                    console.warn(`[Sora API] Endpoint returned 404 for provider=${provider}: ${endpoint}`)
                    continue
                }
                throw error
            }
        }

        if (!response) {
            throw lastError || new Error('Failed to create Sora task: no valid endpoint found')
        }

        const normalizedResponse = normalizeCreateTaskResponse(response.data, provider)

        if (normalizedResponse.code !== 200) {
            throw new Error(`KIE API error: ${normalizedResponse.msg}`)
        }

        if (!normalizedResponse.data.taskId) {
            throw new Error('KIE API error: missing task id in create task response')
        }

        console.log('[Sora API] Task created successfully:', normalizedResponse.data.taskId)
        return normalizedResponse
    } catch (error: any) {
        console.error('[Sora API] Failed to create task:', {
            provider,
            status: error?.response?.status,
            code: error?.code,
            message: error?.message,
            responseData: error?.response?.data,
        })

        let errorMessage = 'Failed to create Sora video generation task'

        if (error.response) {
            const status = error.response.status
            const data = error.response.data

            if (status === 401) {
                errorMessage = `${provider.toUpperCase()} API authentication failed. Please check API key environment variable.`
            } else if (status === 402) {
                errorMessage = `Insufficient credits in your ${provider.toUpperCase()} account.`
            } else if (status === 422) {
                errorMessage = `Invalid request parameters: ${data?.msg || 'Validation error'}`
            } else if (status === 429) {
                errorMessage = `${provider.toUpperCase()} API rate limit exceeded. Please try again later.`
            } else if (status === 455) {
                errorMessage = `${provider.toUpperCase()} service is currently undergoing maintenance.`
            } else if (status >= 500) {
                errorMessage = `${provider.toUpperCase()} API server error. Please try again later.`
            } else if (data?.msg) {
                errorMessage = `${provider.toUpperCase()} API error: ${data.msg}`
            }
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = `Request timeout while connecting to ${provider.toUpperCase()} API.`
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
export async function getTaskDetails(taskId: string, provider: SoraProvider = 'kie'): Promise<SoraTaskDetail> {
    const { apiKey, baseUrl } = getApiConfig(provider)

    try {
        const endpoints = TASK_DETAILS_ENDPOINTS[provider]
        let response: { data: SoraTaskDetail } | null = null
        let lastError: any = null

        for (const endpoint of endpoints) {
            try {
                response = await axios.get(`${baseUrl}${endpoint}`, {
                    params: provider === 'poyo' ? { task_id: taskId } : { taskId },
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 15000,
                })
                break
            } catch (error: any) {
                lastError = error
                const status = error?.response?.status
                if (status === 404 && provider === 'poyo') {
                    console.warn(`[Sora API] Task details endpoint returned 404 for provider=${provider}: ${endpoint}`)
                    continue
                }
                throw error
            }
        }

        if (!response) {
            throw lastError || new Error('Failed to retrieve task status: no valid endpoint found')
        }

        const normalizedResponse = normalizeTaskDetailResponse(response.data, taskId, provider)

        if (normalizedResponse.code !== 200) {
            if (response.data.msg?.includes('recordInfo is null')) {
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

            throw new Error(`KIE API error: ${normalizedResponse.msg}`)
        }

        return normalizedResponse
    } catch (error: any) {
        console.error('[Sora API] Failed to get task details:', {
            provider,
            taskId,
            status: error?.response?.status,
            code: error?.code,
            message: error?.message,
            responseData: error?.response?.data,
        })

        let errorMessage = 'Failed to retrieve task status'

        if (error.response) {
            const status = error.response.status
            const data = error.response.data

            if (status === 401) {
                errorMessage = `${provider.toUpperCase()} API authentication failed.`
            } else if (status === 404) {
                errorMessage = `Task not found: ${taskId}`
            } else if (data?.msg) {
                errorMessage = `${provider.toUpperCase()} API error: ${data.msg}`
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
        provider?: SoraProvider
    } = {}
): Promise<SoraTaskDetail> {
    // Increase timeout: 120 attempts * 10s = 20 minutes (video generation can take longer)
    const maxAttempts = options.maxAttempts || 120 // 120 attempts = 20 minutes with 10s interval
    const pollInterval = options.pollInterval || 10000 // 10 seconds (less frequent polling)

    let attempts = 0

    while (attempts < maxAttempts) {
        attempts++

        const taskDetail = await getTaskDetails(taskId, options.provider || 'kie')
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
