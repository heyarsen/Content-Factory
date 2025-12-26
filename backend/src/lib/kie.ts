import axios from 'axios'
import { retryWithBackoff } from './perplexity.js'

const KIE_API_URL = 'https://api.kie.ai/api/v1'

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
 */
export type SoraAspectRatio = 'landscape' | 'portrait' | 'square'

/**
 * Request payload for creating a Sora text-to-video task
 */
export interface CreateSoraTaskRequest {
    model: 'sora-2-text-to-video'
    callBackUrl?: string
    input: {
        prompt: string
        aspect_ratio: SoraAspectRatio
        n_frames?: string // Duration in frames, default "10"
        remove_watermark?: boolean
        character_id_list?: string[]
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
 */
export interface SoraTaskDetail {
    code: number
    msg: string
    data: {
        taskId: string
        status: 'pending' | 'processing' | 'completed' | 'failed'
        progress?: number
        result?: {
            video_url?: string
            thumbnail_url?: string
            duration?: number
        }
        error?: string
        created_at?: string
        updated_at?: string
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
    if (aspectRatio === '1:1') return 'square'

    // Default to portrait
    return 'portrait'
}

/**
 * Calculate n_frames from duration in seconds
 * Sora uses frames, typical video is 24-30 fps
 * We'll use 30 fps as default
 */
export function calculateFramesFromDuration(durationSeconds: number): string {
    const fps = 30
    const frames = Math.round(durationSeconds * fps)
    return frames.toString()
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
    } = {}
): Promise<CreateSoraTaskResponse> {
    const apiKey = getKieApiKey()

    const payload: CreateSoraTaskRequest = {
        model: 'sora-2-text-to-video',
        callBackUrl: options.callBackUrl,
        input: {
            prompt,
            aspect_ratio: aspectRatio,
            n_frames: options.nFrames || '10',
            remove_watermark: options.removeWatermark ?? true,
            character_id_list: options.characterIdList,
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
            {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 5000,
            }
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
        const response = await axios.get<SoraTaskDetail>(
            `${KIE_API_URL}/jobs/getTaskDetail`,
            {
                params: { taskId },
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        )

        if (response.data.code !== 200) {
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
    const maxAttempts = options.maxAttempts || 60 // 60 attempts = 5 minutes with 5s interval
    const pollInterval = options.pollInterval || 5000 // 5 seconds

    let attempts = 0

    while (attempts < maxAttempts) {
        attempts++

        const taskDetail = await getTaskDetails(taskId)
        const status = taskDetail.data.status
        const progress = taskDetail.data.progress || 0

        console.log(`[KIE Sora] Task ${taskId} status: ${status}, progress: ${progress}%`)

        if (options.onProgress) {
            options.onProgress(progress, status)
        }

        if (status === 'completed') {
            console.log(`[KIE Sora] Task ${taskId} completed successfully`)
            return taskDetail
        }

        if (status === 'failed') {
            const errorMsg = taskDetail.data.error || 'Video generation failed'
            console.error(`[KIE Sora] Task ${taskId} failed:`, errorMsg)
            throw new Error(`Sora video generation failed: ${errorMsg}`)
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`)
}
