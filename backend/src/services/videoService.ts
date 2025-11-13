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

const DEFAULT_HEYGEN_RESOLUTION =
  process.env.HEYGEN_OUTPUT_RESOLUTION && process.env.HEYGEN_OUTPUT_RESOLUTION.trim().length > 0
    ? process.env.HEYGEN_OUTPUT_RESOLUTION.trim()
    : '720p'

export interface ManualVideoInput {
  topic: string
  script?: string
  style?: VideoStyle
  duration?: number
  avatar_id?: string | null
  plan_item_id?: string | null
  output_resolution?: string
  generate_caption?: boolean
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

function buildHeygenPayload(
  topic: string,
  script: string | undefined,
  style: VideoStyle,
  duration: number,
  avatarId?: string,
  isPhotoAvatar: boolean = false,
  outputResolution: string = DEFAULT_HEYGEN_RESOLUTION,
  aspectRatio?: string // e.g., "9:16" for vertical videos
) {
  const payload: any = {
    topic,
    script: script || topic,
    style,
    duration,
    ...(isPhotoAvatar ? { talking_photo_id: avatarId } : { avatar_id: avatarId }),
  }

  if (outputResolution) {
    payload.output_resolution = outputResolution
  }

  if (aspectRatio) {
    payload.aspect_ratio = aspectRatio
  }

  // Log payload details including aspect ratio
  if (aspectRatio) {
    console.log(`[HeyGen Payload] Built payload with aspect_ratio: ${aspectRatio}`, {
      hasAspectRatio: !!aspectRatio,
      aspectRatio,
      outputResolution,
      hasAvatar: !!avatarId,
    })
  }

  return payload
}

async function applyManualGenerationSuccess(videoId: string, response: HeyGenVideoResponse): Promise<void> {
  // Get video record to check if caption generation is requested
  const { data: video } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

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
    return
  }

  // Generate caption if video is completed and caption generation was requested
  // Note: Caption generation is handled separately via the generate-description endpoint
  // Skipping automatic caption generation to avoid metadata column dependency
}

// Caption generation is handled via the /api/videos/:id/generate-description endpoint
// Removed automatic caption generation to avoid metadata column dependency

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

async function runHeygenGeneration(
  video: Video,
  avatarId?: string,
  isPhotoAvatar: boolean = false,
  outputResolution: string = DEFAULT_HEYGEN_RESOLUTION,
  planItemId?: string | null
): Promise<void> {
  try {
    // Idempotency guard: if a HeyGen video was already created for this record, do not create again
    if (video.heygen_video_id) {
      console.log('Skipping HeyGen generation because heygen_video_id already exists for video:', {
        videoId: video.id,
        heygenVideoId: video.heygen_video_id,
      })
      return
    }
    
    if (!avatarId) {
      throw new Error('No avatar available. Please configure an avatar in your settings.')
    }
    
    // Build payload with proper avatar type
    const payload: any = {
      topic: video.topic,
      script: video.script || undefined,
      style: video.style,
      duration: video.duration,
      ...(isPhotoAvatar ? { talking_photo_id: avatarId } : { avatar_id: avatarId }),
    }

    if (outputResolution) {
      payload.output_resolution = outputResolution
    }
    
    console.log('Calling HeyGen API with payload:', {
      videoId: video.id,
      avatarId,
      isPhotoAvatar,
      hasScript: !!payload.script,
      scriptLength: payload.script?.length,
      style: payload.style,
      duration: payload.duration,
      outputResolution,
    })
    
    const response = await requestHeygenVideo(payload)
    await applyManualGenerationSuccess(video.id, response)
    if (planItemId) {
      await supabase
        .from('video_plan_items')
        .update({
          status: mapHeygenStatus(response.status),
          error_message: null,
        })
        .eq('id', planItemId)
    }
  } catch (error: any) {
    console.error('HeyGen generation error:', error)
    
    // Extract detailed error message
    let errorMessage = error?.message || 'Failed to generate video'
    
    if (error?.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error?.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error?.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : JSON.stringify(error.response.data.error)
    } else if (error?.response?.status === 401) {
      errorMessage = 'HeyGen API authentication failed. Please check your API key configuration.'
    } else if (error?.response?.status === 429) {
      errorMessage = 'HeyGen API rate limit exceeded. Please try again later.'
    } else if (error?.response?.status >= 500) {
      errorMessage = 'HeyGen API server error. Please try again later.'
    }
    
    const enhancedError = new Error(errorMessage)
    await applyManualGenerationFailure(video.id, enhancedError)
    if (planItemId) {
      await supabase
        .from('video_plan_items')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planItemId)
    }
  }
}

export class VideoService {
  /**
   * Create a manual video request and trigger HeyGen generation asynchronously
   */
  static async requestManualVideo(userId: string, input: ManualVideoInput): Promise<Video> {
    // Get default avatar if no avatar_id specified
    let avatarId: string | undefined = input.avatar_id || undefined
    let avatarRecordId: string | undefined
    let isPhotoAvatar = false
    
    const { AvatarService } = await import('./avatarService.js')
    
    if (!avatarId) {
      const defaultAvatar = await AvatarService.getDefaultAvatar(userId)
      if (defaultAvatar) {
        avatarId = defaultAvatar.heygen_avatar_id
        avatarRecordId = defaultAvatar.id
        // Check if it's a photo avatar (avatar_url points to Supabase storage)
        isPhotoAvatar = defaultAvatar.avatar_url?.includes('supabase.co/storage') || false
      }
    } else {
      // If avatar_id is provided, try to find by database record ID first
      let avatar = await AvatarService.getAvatarById(avatarId, userId)
      
      // If not found by database ID, try to find by HeyGen avatar ID
      if (!avatar) {
        const { data } = await supabase
          .from('avatars')
          .select('*')
          .eq('user_id', userId)
          .eq('heygen_avatar_id', avatarId)
          .single()
        
        if (data) {
          avatar = data as any
        }
      }
      
      avatarRecordId = avatar?.id
      if (avatar) {
        avatarId = avatar.heygen_avatar_id
        // Check if it's a photo avatar (avatar_url points to Supabase storage)
        isPhotoAvatar = avatar.avatar_url?.includes('supabase.co/storage') || false
        
        console.log('Avatar lookup result:', {
          inputAvatarId: input.avatar_id,
          databaseRecordId: avatarRecordId,
          heygenAvatarId: avatarId,
          isPhotoAvatar,
          avatarStatus: avatar.status,
        })
      } else {
        console.error('Avatar not found:', {
          inputAvatarId: input.avatar_id,
          userId,
        })
        throw new Error(`Avatar not found. Please ensure the avatar ID is correct and belongs to your account.`)
      }
    }
    
    // Validate avatar before creating video record
    if (!avatarId) {
      throw new Error('No avatar configured. Please set up an avatar in your settings before generating videos.')
    }
    
    // Idempotency 1: If tied to a plan item, and it already has a video_id, reuse that video
    if (input.plan_item_id) {
      const { data: existingItem } = await supabase
        .from('video_plan_items')
        .select('video_id')
        .eq('id', input.plan_item_id)
        .single()
      if (existingItem?.video_id) {
        const { data: existingVideo } = await supabase
          .from('videos')
          .select('*')
          .eq('id', existingItem.video_id)
          .single()
        if (existingVideo) {
          console.log('[Idempotency] Reusing existing video for plan item:', {
            planItemId: input.plan_item_id,
            videoId: existingItem.video_id,
          })
          return existingVideo as Video
        }
      }
    }
    
    // Idempotency 2: Reuse a very recent, equivalent request by same user to avoid duplicates
    const recentWindowMs = 6 * 60 * 60 * 1000 // 6 hours
    const sinceIso = new Date(Date.now() - recentWindowMs).toISOString()
    const equivalentQuery = supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', input.topic)
      .eq('style', input.style || DEFAULT_REEL_STYLE)
      .eq('duration', input.duration || DEFAULT_REEL_DURATION)
      .gte('created_at', sinceIso)
      .in('status', ['pending', 'generating', 'completed'] as any)
      .order('created_at', { ascending: false })
      .limit(1)
    
    const { data: maybeDuplicate } = await equivalentQuery
    if (maybeDuplicate && maybeDuplicate.length > 0) {
      const candidate = maybeDuplicate[0] as Video
      const scriptMatches =
        (candidate.script || '') === (input.script || '')
      const avatarMatches =
        !avatarRecordId || candidate.avatar_id === avatarRecordId
      if (scriptMatches && avatarMatches) {
        console.log('[Idempotency] Reusing recent equivalent video request:', {
          existingVideoId: candidate.id,
          status: candidate.status,
        })
        return candidate
      }
    }
    
    const video = await this.createVideoRecord(userId, input, avatarRecordId)
    const outputResolution = input.output_resolution || DEFAULT_HEYGEN_RESOLUTION
    void runHeygenGeneration(
      video,
      avatarId,
      isPhotoAvatar,
      outputResolution,
      input.plan_item_id || null
    )
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
  static async refreshVideoStatus(videoId: string, userId: string): Promise<Video & { progress?: number } | null> {
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

        return {
          ...data,
          progress: status.progress,
        }
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
  static async generateVideoForReel(reel: Reel, userId?: string): Promise<{ video_id: string; video_url: string | null }> {
    // Idempotency: if reel already has a HeyGen video or URL, reuse it
    if (reel.heygen_video_id || reel.video_url) {
      return {
        video_id: reel.heygen_video_id || '',
        video_url: reel.video_url ?? null,
      }
    }
    
    if (!reel.script) {
      throw new Error('Reel must have a script to generate video')
    }

    // Ensure userId is available - use from reel if not provided
    const effectiveUserId = userId || reel.user_id
    if (!effectiveUserId) {
      throw new Error('User ID is required to generate video. Please ensure the reel has a user_id.')
    }

    const template = reel.template || CATEGORY_TEMPLATES[reel.category] || CATEGORY_TEMPLATES.Trading

    try {
      // Get default avatar - userId is guaranteed to be available at this point
      let avatarId: string | undefined = undefined
      let isPhotoAvatar = false

      const { AvatarService } = await import('./avatarService.js')
      const defaultAvatar = await AvatarService.getDefaultAvatar(effectiveUserId)
      if (defaultAvatar) {
        avatarId = defaultAvatar.heygen_avatar_id
        isPhotoAvatar = defaultAvatar.avatar_url?.includes('supabase.co/storage') || false
        console.log(`[Reel Video] Using default avatar for reel: ${avatarId} (isPhotoAvatar: ${isPhotoAvatar})`)
      } else {
        console.warn(`[Reel Video] No default avatar found for user ${effectiveUserId}`)
        // Try to get any active avatar as fallback
        const userAvatars = await AvatarService.getUserAvatars(effectiveUserId)
        const activeAvatar = userAvatars.find(a => a.status === 'active')
        if (activeAvatar) {
          avatarId = activeAvatar.heygen_avatar_id
          isPhotoAvatar = activeAvatar.avatar_url?.includes('supabase.co/storage') || false
          console.log(`[Reel Video] Using fallback active avatar: ${avatarId} (isPhotoAvatar: ${isPhotoAvatar})`)
        }
      }

      if (!avatarId) {
        throw new Error('No avatar available. Please configure a default avatar in your settings.')
      }

      // Build payload with avatar and vertical aspect ratio for Reels/TikTok (9:16)
      // Use aspect_ratio: "9:16" for vertical videos - this is the correct way to generate vertical videos
      const verticalResolution = '1080p' // Use standard resolution, aspect_ratio will make it vertical
      console.log(`[Reel Video] Building payload with aspect_ratio 9:16 for vertical video (Instagram Reels/TikTok)`)
      
      const payload = buildHeygenPayload(
        reel.topic,
        reel.script,
        DEFAULT_REEL_STYLE,
        DEFAULT_REEL_DURATION,
        avatarId,
        isPhotoAvatar,
        verticalResolution, // Use standard resolution
        '9:16' // Use aspect_ratio to ensure vertical format (no white frames on sides)
      )
      
      console.log(`[Reel Video] Generating video for reel with avatar:`, {
        topic: reel.topic,
        hasScript: !!reel.script,
        avatarId,
        isPhotoAvatar,
        outputResolution: payload.output_resolution,
        aspectRatio: payload.aspect_ratio,
        isVertical: payload.aspect_ratio === '9:16',
      })

      const response = await requestHeygenVideo(payload)

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

  private static async createVideoRecord(userId: string, input: ManualVideoInput, avatarRecordId?: string): Promise<Video> {
    const { data, error } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        topic: input.topic,
        script: input.script || null,
        style: input.style || DEFAULT_REEL_STYLE,
        duration: input.duration || DEFAULT_REEL_DURATION,
        status: 'pending',
        heygen_video_id: null,
        video_url: null,
        avatar_id: avatarRecordId || null,
        error_message: null,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Error creating video record:', {
        error,
        userId,
        topic: input.topic,
        hasScript: !!input.script,
        style: input.style,
        duration: input.duration,
        avatarRecordId,
      })
      const errorMessage = error?.message || 'Failed to create video record'
      const detailedMessage = error?.details ? `${errorMessage}: ${error.details}` : errorMessage
      throw new Error(detailedMessage)
    }

    return data
  }
}
