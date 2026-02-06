import { supabase } from '../lib/supabase.js'
import { getSoraProviderSetting, type SoraProvider } from './appSettingsService.js'
import {
    calculateDurationFromSeconds,
    extractVideoUrl,
    mapAspectRatioToSora,
    type SoraTaskDetail,
} from '../lib/soraUtils.js'
import type { Video } from '../types/database.js'
import { VideoService } from './videoService.js'

/**
 * Map Sora task status to internal video status
 * Sora providers return: 'not_started', 'in_progress', 'finished', 'failed'
 */
function mapSoraStatusToVideoStatus(soraStatus: string): Video['status'] {
    switch (soraStatus) {
        case 'not_started':
        case 'in_progress':
            return 'generating'
        case 'finished':
            return 'completed'
        case 'failed':
            return 'failed'
        default:
            console.warn(`[Sora Service] Unknown Sora status: ${soraStatus}, defaulting to 'generating'`)
            return 'generating'
    }
}

async function getSoraClient(provider: SoraProvider) {
    if (provider === 'kie') {
        return await import('../lib/kie.js')
    }
    return await import('../lib/poyo.js')
}

async function resolveSoraProvider(video?: Video): Promise<SoraProvider> {
    if (video?.sora_provider === 'kie' || video?.sora_provider === 'poyo') {
        return video.sora_provider
    }
    return await getSoraProviderSetting()
}

/**
 * Update video record with Sora task success
 * Poyo API returns video URL in the task status payload
 */
async function updateVideoWithSoraSuccess(
    videoId: string,
    taskDetail: SoraTaskDetail
): Promise<void> {
    const videoUrl = extractVideoUrl(taskDetail)

    if (!videoUrl) {
        throw new Error('Sora task completed but no video URL was provided in the response')
    }

    console.log('[Sora Service] Updating video record with success:', {
        videoId,
        taskId: taskDetail.data.task_id,
        videoUrl,
    })

    const { error } = await supabase
        .from('videos')
        .update({
            status: 'completed',
            video_url: videoUrl,
            updated_at: new Date().toISOString(),
        })
        .eq('id', videoId)

    if (error) {
        console.error('[Sora Service] Failed to update video record:', error)
        throw new Error(`Failed to update video record: ${error.message}`)
    }

    console.log('[Sora Service] Video record updated successfully')
}

/**
 * Update video record with Sora task failure
 */
async function updateVideoWithSoraFailure(
    videoId: string,
    error: Error
): Promise<void> {
    await VideoService.failVideo(videoId, error.message)
}

/**
 * Generate video using Sora and poll for completion
 */
export async function generateVideoWithSora(
    video: Video,
    options: {
        aspectRatio?: string | null
        callBackUrl?: string
    } = {}
): Promise<void> {
    try {
        // Idempotency guard: if a Sora task was already created for this record, do not create again
        if (video.sora_task_id) {
            console.log('[Sora Service] Skipping generation because sora_task_id already exists:', {
                videoId: video.id,
                soraTaskId: video.sora_task_id,
            })
            return
        }

        console.log('[Sora Service] Starting Sora video generation:', {
            videoId: video.id,
            topic: video.topic,
            aspectRatio: options.aspectRatio,
        })

        // Build the prompt from topic, style, and script
        let prompt = `Style: ${video.style}. Topic: ${video.topic}. VoiceOver must be no more than 15 seconds.`
        if (video.script) {
            // Combine topic, style and script for a more detailed prompt
            prompt = `Style: ${video.style}. Topic: ${video.topic}. Script: ${video.script}. VoiceOver must be no more than 15 seconds.`
        }

        // Limit prompt length (Sora has limits)
        const maxPromptLength = 1000
        if (prompt.length > maxPromptLength) {
            prompt = prompt.substring(0, maxPromptLength) + '...'
            console.log('[Sora Service] Prompt truncated to max length:', maxPromptLength)
        }

        // Map aspect ratio
        const soraAspectRatio = mapAspectRatioToSora(options.aspectRatio)

        // Calculate duration
        const duration = calculateDurationFromSeconds(video.duration || 30)

        const provider = await resolveSoraProvider(video)
        const soraClient = await getSoraClient(provider)

        // Create Sora task
        const createResponse = await soraClient.createSoraTask(prompt, soraAspectRatio, {
            duration,
            callbackUrl: options.callBackUrl,
        })

        const taskId = createResponse.data.task_id

        // Update video record with task ID
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                sora_task_id: taskId,
                sora_provider: provider,
                status: 'generating',
                updated_at: new Date().toISOString(),
            })
            .eq('id', video.id)

        if (updateError) {
            console.error('[Sora Service] Failed to update video with task ID:', updateError)
            throw new Error(`Failed to update video record: ${updateError.message}`)
        }

        console.log('[Sora Service] Task created, starting polling:', taskId)

        // Poll for completion
        // Increased timeout: 120 attempts * 10s = 20 minutes (video generation can take longer)
        const taskDetail = await soraClient.pollTaskUntilComplete(taskId, {
            maxAttempts: 120, // 20 minutes with 10s interval
            pollInterval: 10000, // 10 seconds between polls
            onProgress: (progress, status) => {
                console.log(`[Sora Service] Video ${video.id} - Progress: ${progress}%, Status: ${status}`)
            },
        })

        // Update video record with success
        await updateVideoWithSoraSuccess(video.id, taskDetail)

        // Extract video URL from resultJson for logging
        const videoUrl = extractVideoUrl(taskDetail)

        console.log('[Sora Service] Video generation completed successfully:', {
            videoId: video.id,
            taskId,
            videoUrl,
        })
    } catch (error: any) {
        console.error('[Sora Service] Video generation failed:', error)
        await updateVideoWithSoraFailure(video.id, error)
        throw error
    }
}

/**
 * Check status of an existing Sora task and update video record
 */
export async function checkSoraTaskStatus(
    videoId: string,
    taskId: string,
    provider?: SoraProvider | null
): Promise<void> {
    try {
        const resolvedProvider =
            provider && (provider === 'poyo' || provider === 'kie')
                ? provider
                : await getSoraProviderSetting()
        const soraClient = await getSoraClient(resolvedProvider)
        const taskDetail = await soraClient.getTaskDetails(taskId)

        const status = mapSoraStatusToVideoStatus(taskDetail.data.status)

        console.log('[Sora Service] Task status check:', {
            videoId,
            taskId,
            provider: resolvedProvider,
            state: taskDetail.data.status,
            mappedStatus: status,
        })

        if (taskDetail.data.status === 'finished') {
            await updateVideoWithSoraSuccess(videoId, taskDetail)
        } else if (taskDetail.data.status === 'failed') {
            const error = new Error(taskDetail.data.error?.message || 'Sora task failed')
            await updateVideoWithSoraFailure(videoId, error)
        } else {
            // Update progress
            const { error } = await supabase
                .from('videos')
                .update({
                    status,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', videoId)

            if (error) {
                console.error('[Sora Service] Failed to update video status:', error)
            }
        }
    } catch (error: any) {
        if (error?.status === 404) {
            console.warn('[Sora Service] Task not found yet, keeping status as generating:', {
                videoId,
                taskId,
            })

            const { error: updateError } = await supabase
                .from('videos')
                .update({
                    status: 'generating',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', videoId)

            if (updateError) {
                console.error('[Sora Service] Failed to update video status after 404:', updateError)
            }

            return
        }

        console.error('[Sora Service] Failed to check task status:', error)
        throw error
    }
}

/**
 * Service exports
 */
export const SoraService = {
    generateVideoWithSora,
    checkSoraTaskStatus,
    mapSoraStatusToVideoStatus,
}
