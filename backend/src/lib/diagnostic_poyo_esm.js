import axios from 'axios'
import { retryWithBackoff } from './diagnostic_perplexity.js'

const POYO_API_URL = 'https://api.poyo.ai'

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
 * Sora aspect ratio options
 * Per docs: only '16:9' and '9:16' are supported.
 */
export type SoraAspectRatio = '16:9' | '9:16'

/**
 * Request payload for creating a Sora text-to-video task
 */
export interface CreateSoraTaskRequest {
    model: 'sora-2' | 'sora-2-private' | 'sora-2-stable'
    callback_url?: string
    input: {
        prompt: string
        image_urls?: string[]
        duration: 10 | 15
        aspect_ratio: SoraAspectRatio
        style?:
            | 'thanksgiving'
            | 'comic'
            | 'news'
            | 'selfie'
            | 'nostalgic'
            | 'anime'
        storyboard?: boolean
    }
}

/**
 * Response from creating a Sora task
 */
export interface CreateSoraTaskResponse {
    code: number
    data: {
        task_id: string
        status: 'not_started'
        created_time: string
    }
}

/**
 * Task status response from Poyo API
 */
export interface SoraTaskDetail {
    code: number
    data: {
        task_id: string
        status: 'not_started' | 'in_progress' | 'finished' | 'failed'
        created_time?: string
        output?: {
            video_url?: string
            url?: string
            urls?: string[]
        }
        result?: {
            video_url?: string
            url?: string
            urls?: string[]
        }
        video_url?: string
        video_urls?: string[]
        error?: {
            message?: string
        }
    }
    error?: {
        message?: string
        type?: string
    }
    message?: string
}

/**
 * Map aspect ratio from internal format to Sora format
 */
export function mapAspectRatioToSora(aspectRatio?: string | null): SoraAspectRatio {
    if (!aspectRatio) return '9:16' // Default to vertical for short videos

    // Handle common aspect ratio formats
    if (aspectRatio === '9:16' || aspectRatio === 'vertical' || aspectRatio === 'portrait') return '9:16'
    if (aspectRatio === '16:9' || aspectRatio === 'horizontal' || aspectRatio === 'landscape') return '16:9'

    // Default to 9:16
    return '9:16'
}

/**
 * Calculate duration from seconds, clamped to supported values.
 */
export function calculateDurationFromSeconds(durationSeconds: number): 10 | 15 {
    if (durationSeconds >= 15) return 15
    return 10
}

/**
 * Create a Sora text-to-video generation task
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

    const attemptCreate = async (model: CreateSoraTaskRequest['model']): Promise<CreateSoraTaskResponse> => {
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

    const primaryModel = options.model || 'sora-2'
    let lastError: any

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await attemptCreate(primaryModel)
        } catch (error: any) {
            lastError = error
            console.error(
                `[Poyo Sora] Failed to create task with ${primaryModel} (attempt ${attempt}/3):`,
                error
            )
        }
    }

    try {
        console.warn('[Poyo Sora] Falling back to sora-2-stable after 3 failed attempts.')
        return await attemptCreate('sora-2-stable')
    } catch (error: any) {
        lastError = error
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
        ; (enhancedError as any).status = lastError?.response?.status || 500
    throw enhancedError
}

/**
 * Get task details and status
 */
export async function getTaskDetails(taskId: string): Promise<SoraTaskDetail> {
    const apiKey = getPoyoApiKey()

    try {
        const response = await axios.get<SoraTaskDetail>(`${POYO_API_URL}/api/task/status`, {
            params: { task_id: taskId },
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        })

        if (response.data.code !== 200) {
            throw new Error(`Poyo API error: ${response.data.message || 'Unexpected response'}`)
        }

        return response.data
    } catch (error: any) {
        console.error('[Poyo Sora] Failed to get task details:', error)

        let errorMessage = 'Failed to retrieve task status'

        if (error.response) {
            const status = error.response.status
            const data = error.response.data

            if (status === 401) {
                errorMessage = 'Poyo API authentication failed.'
            } else if (status === 404) {
                errorMessage = `Task not found: ${taskId}`
            } else if (data?.error?.message || data?.message) {
                errorMessage = `Poyo API error: ${data.error?.message || data.message}`
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
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`)
}
