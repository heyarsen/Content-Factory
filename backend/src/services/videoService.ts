import { supabase } from '../lib/supabase.js'
import { generateVideo as requestHeygenVideo, getVideoStatus } from '../lib/heygen.js'
import type { HeyGenVideoResponse } from '../lib/heygen.js'
import type { Reel, Video } from '../types/database.js'

// Category to HeyGen template mapping
const CATEGORY_TEMPLATES: Record<string, string> = {
  Trading: 'Daran walking',
  Lifestyle: 'Car',
  'Fin. Freedom': 'Daran sitting',
}

const DEFAULT_REEL_STYLE: Video['style'] = 'professional'
const DEFAULT_REEL_DURATION = 30

type VideoStyle = Video['style']

export interface ManualVideoInput {
  topic: string
  script?: string
  style: VideoStyle
  duration: number
}

type ServiceError = Error & { status?: number }

function createServiceError(message: string, status: number): ServiceError {
  const error = new Error(message) as ServiceError
  error.status = status
  return error
}

function mapHeygenStatus(status: string): Video['status'] {
  if (status === 'completed') {
    return 'completed'
  }
  if (status === 'failed') {
    return 'failed'
  }
  return 'generating'
}

function buildHeygenPayload(topic: string, script: string | undefined, style: VideoStyle, duration: number) {
  return {
    topic,
    script: script || topic,
    style,
    duration,
  }
}

async function applyManualGenerationSuccess(videoId: string, response: HeyGenVideoResponse): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({
      heygen_video_id: response.video_id,
      status: mapHeygenStatus(response.status),
      video_url: response.video_url || null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)

  if (error) {
    console.error('Failed to persist video generation success:', error)
  }
}

async function applyManualGenerationFailure(videoId: string, error: Error): Promise<void> {
  const { error: dbError } = await supabase
    .from('videos')
    .update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)

  if (dbError) {
    console.error('Failed to persist video generation failure:', dbError)
  }
}

async function runHeygenGeneration(video: Video): Promise<void> {
  try {
    const response = await requestHeygenVideo(
      buildHeygenPayload(video.topic, video.script || undefined, video.style, video.duration)
    )
    await applyManualGenerationSuccess(video.id, response)
  } catch (error: any) {
    console.error('HeyGen generation error:', error)
    await applyManualGenerationFailure(video.id, error)
  }
}

export class VideoService {
  /**
   * Create a manual video request and trigger HeyGen generation asynchronously
   */
  static async requestManualVideo(userId: string, input: ManualVideoInput): Promise<Video> {
    const video = await this.createVideoRecord(userId, input)
    void runHeygenGeneration(video)
    return video
  }

  /**
   * List videos for a user with optional filters
   */
  static async listVideos(
    userId: string,
    options: { status?: string; search?: string } = {}
  ): Promise<Video[]> {
    let query = supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
    }

    if (options.search) {
      query = query.or(`topic.ilike.%${options.search}%,script.ilike.%${options.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching videos:', error)
      throw new Error('Failed to fetch videos')
    }

    return data || []
  }

  /**
   * Get a single video belonging to a user
   */
  static async getVideoForUser(videoId: string, userId: string): Promise<Video | null> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching video:', error)
      throw new Error('Failed to fetch video')
    }

    return data
  }

  /**
   * Refresh HeyGen status for a video if it is still processing
   */
  static async refreshVideoStatus(videoId: string, userId: string): Promise<Video | null> {
    const video = await this.getVideoForUser(videoId, userId)
    if (!video) {
      return null
    }

    if (video.heygen_video_id && (video.status === 'pending' || video.status === 'generating')) {
      try {
        const status = await getVideoStatus(video.heygen_video_id)
        const { data, error } = await supabase
          .from('videos')
          .update({
            status: mapHeygenStatus(status.status),
            video_url: status.video_url || video.video_url,
            error_message: status.error || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', video.id)
          .select()
          .single()

        if (error) {
          console.error('Error updating video status:', error)
          throw new Error('Failed to update video status')
        }

        return data
      } catch (error) {
        console.error('HeyGen status check error:', error)
      }
    }

    return video
  }

  /**
   * Retry a failed video generation
   */
  static async retryVideo(videoId: string, userId: string): Promise<void> {
    const video = await this.getVideoForUser(videoId, userId)
    if (!video) {
      throw createServiceError('Video not found', 404)
    }

    if (video.status !== 'failed') {
      throw createServiceError('Can only retry failed videos', 400)
    }

    const { error } = await supabase
      .from('videos')
      .update({
        status: 'pending',
        heygen_video_id: null,
        video_url: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', video.id)

    if (error) {
      console.error('Error resetting video for retry:', error)
      throw new Error('Failed to reset video for retry')
    }

    const refreshedVideo: Video = {
      ...video,
      status: 'pending',
      heygen_video_id: null,
      video_url: null,
      error_message: null,
    }

    void runHeygenGeneration(refreshedVideo)
  }

  /**
   * Delete a video for a user
   */
  static async deleteVideo(videoId: string, userId: string): Promise<void> {
    const video = await this.getVideoForUser(videoId, userId)
    if (!video) {
      throw createServiceError('Video not found', 404)
    }

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting video:', error)
      throw new Error('Failed to delete video')
    }
  }

  /**
   * Generate video for a reel based on category
   */
  static async generateVideoForReel(reel: Reel): Promise<{ video_id: string; video_url: string | null }> {
    if (!reel.script) {
      throw new Error('Reel must have a script to generate video')
    }

    const template = reel.template || CATEGORY_TEMPLATES[reel.category] || CATEGORY_TEMPLATES.Trading

    try {
      const response = await requestHeygenVideo(
        buildHeygenPayload(reel.topic, reel.script, DEFAULT_REEL_STYLE, DEFAULT_REEL_DURATION)
      )

      // template is currently not sent to HeyGen, but kept for future use
      void template

      return {
        video_id: response.video_id,
        video_url: response.video_url || null,
      }
    } catch (error: any) {
      console.error('Error generating video for reel:', error)
      throw new Error(`Failed to generate video: ${error.message}`)
    }
  }

  /**
   * Get template for category
   */
  static getTemplateForCategory(category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'): string {
    return CATEGORY_TEMPLATES[category] || CATEGORY_TEMPLATES.Trading
  }

  private static async createVideoRecord(userId: string, input: ManualVideoInput): Promise<Video> {
    const { data, error } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        topic: input.topic,
        script: input.script || null,
        style: input.style,
        duration: input.duration,
        status: 'pending',
        heygen_video_id: null,
        video_url: null,
        error_message: null,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Error creating video record:', error)
      throw new Error('Failed to create video record')
    }

    return data
  }
}
