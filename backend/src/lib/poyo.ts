import axios from 'axios'
import {
    type CreateSoraTaskRequest,
    type CreateSoraTaskResponse,
    type SoraAspectRatio,
    type SoraTaskDetail,
} from './soraUtils.js'

const POYO_API_URL = 'https://api.poyo.ai'

/**
 * Retry function with exponential backoff for handling rate limits
 * (inlined here to avoid coupling Poyo/Sora to Perplexity module resolution)
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
 * Get Poyo API key from environment
 */
function getPoyoApiKey(): string {
    const key = process.env.POYO_API_KEY
    if (!key) {
        throw new Error('Missing POYO_API_KEY environment variable')
    }
    return key
}


/**
 * Create a Sora 2 video generation task
 */
export async function createSoraTask(
    prompt: string,
    aspectRatio: SoraAspectRatio = '9:16',
    options: {
        duration?: 10 | 15
        callbackUrl?: string
        imageUrls?: string[]
        style?: CreateSoraTaskRequest['input']['style']
        storyboard?: boolean
        model?: CreateSoraTaskRequest['model']
    } = {}
): Promise<CreateSoraTaskResponse> {
    const apiKey = getPoyoApiKey()

    const createPayload = (model: CreateSoraTaskRequest['model']): CreateSoraTaskRequest => ({
        model,
        callback_url: options.callbackUrl,
        input: {
            prompt,
            duration: options.duration || 10,
            aspect_ratio: aspectRatio,
            ...(options.imageUrls && options.imageUrls.length > 0 ? { image_urls: options.imageUrls } : {}),
            ...(options.style ? { style: options.style } : {}),
            ...(typeof options.storyboard === 'boolean' ? { storyboard: options.storyboard } : {}),
        },
    })

    const attemptCreate = async (
        model: CreateSoraTaskRequest['model']
    ): Promise<CreateSoraTaskResponse> => {
        const payload = createPayload(model)

        console.log('[Poyo Sora] Creating task with payload:', {
            prompt: prompt.substring(0, 100) + '...',
            aspect_ratio: aspectRatio,
            duration: payload.input.duration,
            model: payload.model,
        })

        const response = await retryWithBackoff(
            async () => {
                return await axios.post<CreateSoraTaskResponse>(
                    `${POYO_API_URL}/api/generate/submit`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
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
            throw new Error(`Poyo API error: ${response.data.message || 'Unexpected response'}`)
        }

        console.log('[Poyo Sora] Task created successfully:', response.data.data.task_id)
        return response.data
    }

    let lastError: any
    if (options.model && options.model !== 'sora-2') {
        console.warn(
            `[Poyo Sora] Overriding requested model "${options.model}" to follow Sora retry policy.`
        )
    }

    const modelAttempts: CreateSoraTaskRequest['model'][] = [
        'sora-2',
        'sora-2',
        'sora-2-stable',
        'sora-2-stable',
    ]

    for (let attemptIndex = 0; attemptIndex < modelAttempts.length; attemptIndex++) {
        const model = modelAttempts[attemptIndex]
        const attemptNumber = attemptIndex + 1
        const attemptLabel = `${attemptNumber}/${modelAttempts.length}`

        try {
            return await attemptCreate(model)
        } catch (error: any) {
            lastError = error
            console.error(
                `[Poyo Sora] Failed to create task with ${model} (attempt ${attemptLabel}):`,
                error
            )
        }
    }

    console.error('[Poyo Sora] Failed to create task:', lastError)

    let errorMessage = 'Failed to create Sora 2 video generation task'

    if (lastError?.response) {
        const status = lastError.response.status
        const data = lastError.response.data

        if (status === 401) {
            errorMessage = 'Poyo API authentication failed. Please check your POYO_API_KEY environment variable.'
        } else if (status === 402) {
            errorMessage = 'Insufficient credits in your Poyo account.'
        } else if (status === 422) {
            errorMessage = `Invalid request parameters: ${data?.error?.message || data?.message || 'Validation error'}`
        } else if (status === 429) {
            errorMessage = 'Poyo API rate limit exceeded. Please try again later.'
        } else if (status >= 500) {
            errorMessage = 'Poyo API server error. Please try again later.'
        } else if (data?.error?.message || data?.message) {
            errorMessage = `Poyo API error: ${data.error?.message || data.message}`
        }
    } else if (lastError?.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout while connecting to Poyo API.'
    } else if (lastError?.message) {
        errorMessage = lastError.message
    }

    const enhancedError = new Error(errorMessage)
    ;(enhancedError as any).status = lastError?.response?.status || 500
    throw enhancedError
}

/**
 * Get task details and status
 */
export async function getTaskDetails(taskId: string): Promise<SoraTaskDetail> {
    const apiKey = getPoyoApiKey()

    const maxAttempts = 3
    const baseDelayMs = 1000
    const statusEndpoints: Array<{
        method: 'get' | 'post'
        path: string
        buildConfig: () => { params?: Record<string, string>; data?: Record<string, string> }
    }> = [
        {
            method: 'get',
            path: '/api/task/status',
            buildConfig: () => ({ params: { task_id: taskId } }),
        },
        {
            method: 'post',
            path: '/api/task/status',
            buildConfig: () => ({ data: { task_id: taskId } }),
        },
        {
            method: 'get',
            path: '/api/generate/status',
            buildConfig: () => ({ params: { task_id: taskId } }),
        },
        {
            method: 'post',
            path: '/api/generate/status',
            buildConfig: () => ({ data: { task_id: taskId } }),
        },
    ]

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            let response: { data: SoraTaskDetail } | null = null
            let lastNotFoundError: any = null

            for (const endpoint of statusEndpoints) {
                try {
                    const config = endpoint.buildConfig()
                    if (endpoint.method === 'get') {
                        response = await axios.get<SoraTaskDetail>(`${POYO_API_URL}${endpoint.path}`, {
                            ...config,
                            headers: {
                                Authorization: `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                            },
                            timeout: 15000,
                        })
                    } else {
                        response = await axios.post<SoraTaskDetail>(
                            `${POYO_API_URL}${endpoint.path}`,
                            config.data,
                            {
                                headers: {
                                    Authorization: `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json',
                                },
                                timeout: 15000,
                            }
                        )
                    }

                    if (response.data.code !== 200) {
                        throw new Error(
                            `Poyo API error: ${response.data.message || 'Unexpected response'}`
                        )
                    }

                    return response.data
                } catch (innerError: any) {
                    const innerStatus = innerError.response?.status
                    if (innerStatus === 404 || innerStatus === 405) {
                        lastNotFoundError = innerError
                        continue
                    }
                    throw innerError
                }
            }

            if (lastNotFoundError) {
                const notFoundError = new Error('Poyo API error: Task not found on any status endpoint')
                ;(notFoundError as any).status = 404
                throw notFoundError
            }

            throw new Error('Poyo API error: Failed to resolve task status endpoint')
        } catch (error: any) {
            const status = error.response?.status ?? error.status

            if (status === 404 && attempt < maxAttempts) {
                const delayMs = baseDelayMs * attempt
                console.warn(
                    `[Poyo Sora] Task ${taskId} not found yet (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`
                )
                await new Promise(resolve => setTimeout(resolve, delayMs))
                continue
            }

            if ((status === 429 || (status >= 500 && status < 600)) && attempt < maxAttempts) {
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
                console.warn(
                    `[Poyo Sora] Transient status (${status}) fetching task ${taskId} (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`
                )
                await new Promise(resolve => setTimeout(resolve, delayMs))
                continue
            }

            console.error('[Poyo Sora] Failed to get task details:', error)

            let errorMessage = 'Failed to retrieve task status'

            if (status === 404) {
                errorMessage = `Task not found: ${taskId}`
            } else if (error.response) {
                const data = error.response.data

                if (status === 401) {
                    errorMessage = 'Poyo API authentication failed.'
                } else if (data?.error?.message || data?.message) {
                    errorMessage = `Poyo API error: ${data.error?.message || data.message}`
                }
            } else if (error.message) {
                errorMessage = error.message
            }

            const enhancedError = new Error(errorMessage)
            ;(enhancedError as any).status = status || 500
            throw enhancedError
        }
    }

    throw new Error(`Failed to retrieve task status for ${taskId}`)
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

        let taskDetail: SoraTaskDetail | null = null
        try {
            taskDetail = await getTaskDetails(taskId)
        } catch (error: any) {
            if (error?.status === 404) {
                console.warn(
                    `[Poyo Sora] Task ${taskId} not found yet (attempt ${attempts}/${maxAttempts}). Retrying after ${pollInterval}ms...`
                )
                await new Promise(resolve => setTimeout(resolve, pollInterval))
                continue
            }
            throw error
        }

        const state = taskDetail.data.status

        console.log(`[Poyo Sora] Task ${taskId} status: ${state} (attempt ${attempts}/${maxAttempts})`)

        if (options.onProgress) {
            // Calculate progress based on attempts (since API doesn't provide progress)
            const progress = Math.min(95, Math.round((attempts / maxAttempts) * 100))
            options.onProgress(progress, state)
        }

        if (state === 'finished') {
            console.log(`[Poyo Sora] Task ${taskId} completed successfully`)
            return taskDetail
        }

        if (state === 'failed') {
            const errorMsg = taskDetail.data.error?.message || 'Video generation failed'
            console.error(`[Poyo Sora] Task ${taskId} failed:`, errorMsg)
            throw new Error(`Sora video generation failed: ${errorMsg}`)
        }

        // State is not_started/in_progress - continue polling
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`)
}
