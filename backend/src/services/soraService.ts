import { supabase } from '../lib/supabase.js'
import {
    createSoraTask,
    pollTaskUntilComplete,
    mapAspectRatioToSora,
    calculateFramesFromDuration,
    type SoraAspectRatio,
    type SoraTaskDetail,
} from '../lib/kie.js'
import type { Video } from '../types/database.js'
import { getMaxCharactersForDuration, getMaxWordsForDuration } from '../lib/scriptLimits.js'
import { VideoService } from './videoService.js'

/**
 * Map Sora task status to internal video status
 * KIE API uses: 'waiting', 'success', 'fail'
 */
function mapSoraStatusToVideoStatus(soraStatus: string): Video['status'] {
    switch (soraStatus) {
        case 'waiting':
            return 'generating'
        case 'success':
            return 'completed'
        case 'fail':
            return 'failed'
        default:
            console.warn(`[Sora Service] Unknown Sora status: ${soraStatus}, defaulting to 'generating'`)
            return 'generating'
    }
}

/**
 * Update video record with Sora task success
 * KIE API returns results in resultJson as a JSON string: {"resultUrls": ["url1", "url2"]}
 */
async function updateVideoWithSoraSuccess(
    videoId: string,
    taskDetail: SoraTaskDetail
): Promise<void> {
    // Parse resultJson to get video URL
    let videoUrl: string | null = null

    if (taskDetail.data.resultJson) {
        try {
            const result = JSON.parse(taskDetail.data.resultJson)
            if (result.resultUrls && Array.isArray(result.resultUrls) && result.resultUrls.length > 0) {
                videoUrl = result.resultUrls[0] // Get first video URL
            }
        } catch (error) {
            console.error('[Sora Service] Failed to parse resultJson:', error)
        }
    }

    if (!videoUrl) {
        throw new Error('Sora task completed but no video URL was provided in resultJson')
    }

    console.log('[Sora Service] Updating video record with success:', {
        videoId,
        taskId: taskDetail.data.taskId,
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

        const maxWords = getMaxWordsForDuration(video.duration || 15)
        const maxCharacters = getMaxCharactersForDuration(video.duration || 15)

        // Build the prompt from topic, style, and script
        let prompt = `Style: ${video.style}. Topic: ${video.topic}. VoiceOver must be no more than 15 seconds. Keep the voiceover under ${maxWords} words and ${maxCharacters} characters. Match the video pacing to the voiceover timing and avoid fast cuts.`
        if (video.script) {
            // Combine topic, style and script for a more detailed prompt
            prompt = `Style: ${video.style}. Topic: ${video.topic}. Script: ${video.script}. VoiceOver must be no more than 15 seconds. Keep the voiceover under ${maxWords} words and ${maxCharacters} characters. Match the video pacing to the voiceover timing and avoid fast cuts.`
        }

        // Limit prompt length (Sora has limits)
        const maxPromptLength = 1000
        if (prompt.length > maxPromptLength) {
            prompt = prompt.substring(0, maxPromptLength) + '...'
            console.log('[Sora Service] Prompt truncated to max length:', maxPromptLength)
        }

        // Map aspect ratio
        const soraAspectRatio = mapAspectRatioToSora(options.aspectRatio)

        // Calculate frames from duration
        const nFrames = calculateFramesFromDuration(video.duration || 30)

        // Create Sora task
        const createResponse = await createSoraTask(prompt, soraAspectRatio, {
            nFrames,
            removeWatermark: true,
            callBackUrl: options.callBackUrl,
        })

        const taskId = createResponse.data.taskId

        // Update video record with task ID
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                sora_task_id: taskId,
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
        const taskDetail = await pollTaskUntilComplete(taskId, {
            maxAttempts: 120, // 20 minutes with 10s interval
            pollInterval: 10000, // 10 seconds between polls
            onProgress: (progress, status) => {
                console.log(`[Sora Service] Video ${video.id} - Progress: ${progress}%, Status: ${status}`)
            },
        })

        // Update video record with success
        await updateVideoWithSoraSuccess(video.id, taskDetail)

        // Extract video URL from resultJson for logging
        let videoUrl: string | null = null
        if (taskDetail.data.resultJson) {
            try {
                const result = JSON.parse(taskDetail.data.resultJson)
                if (result.resultUrls && Array.isArray(result.resultUrls) && result.resultUrls.length > 0) {
                    videoUrl = result.resultUrls[0]
                }
            } catch (error) {
                // Ignore parse errors for logging
            }
        }

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
    taskId: string
): Promise<void> {
    try {
        const { getTaskDetails } = await import('../lib/kie.js')
        const taskDetail = await getTaskDetails(taskId)

        const status = mapSoraStatusToVideoStatus(taskDetail.data.state) // API uses 'state', not 'status'

        console.log('[Sora Service] Task status check:', {
            videoId,
            taskId,
            state: taskDetail.data.state,
            mappedStatus: status,
        })

        if (taskDetail.data.state === 'success') {
            await updateVideoWithSoraSuccess(videoId, taskDetail)
        } else if (taskDetail.data.state === 'fail') {
            const error = new Error(taskDetail.data.failMsg || taskDetail.data.failCode || 'Sora task failed')
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
