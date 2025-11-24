import { supabase } from '../lib/supabase.js'
import {
  generateVideo as requestHeygenVideo,
  generateVideoFromTemplate,
  getVideoStatus,
} from '../lib/heygen.js'
import type {
  GenerateVideoRequest,
  HeyGenDimensionInput,
  HeyGenVideoResponse,
} from '../lib/heygen.js'
import type { Reel, Video } from '../types/database.js'

const DEFAULT_REEL_STYLE: Video['style'] = 'professional'
const DEFAULT_REEL_DURATION = 30

type VideoStyle = Video['style']

const DEFAULT_HEYGEN_RESOLUTION =
  process.env.HEYGEN_OUTPUT_RESOLUTION && process.env.HEYGEN_OUTPUT_RESOLUTION.trim().length > 0
    ? process.env.HEYGEN_OUTPUT_RESOLUTION.trim()
    : '720p'

const DEFAULT_VERTICAL_ASPECT_RATIO = '9:16' as const
const DEFAULT_VERTICAL_DIMENSION: Required<HeyGenDimensionInput> = {
  width: 1080,
  height: 1920,
}
const DEFAULT_VERTICAL_OUTPUT_RESOLUTION = '1080x1920'
const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'

type AvatarRecord = {
  id: string
  heygen_avatar_id: string
  avatar_url: string | null
  source?: 'synced' | 'user_photo' | 'ai_generated' | null
}

const isPhotoAvatarRecord = (avatar?: AvatarRecord | null): boolean => {
  if (!avatar) {
    return false
  }
  if (avatar.source === 'user_photo' || avatar.source === 'ai_generated') {
    return true
  }
  return !!avatar.avatar_url && avatar.avatar_url.includes('supabase.co/storage')
}

async function resolveCharacterIdentifier(
  avatarId?: string,
  isPhotoAvatar?: boolean
): Promise<string | undefined> {
  if (!avatarId) {
    return undefined
  }

  if (!isPhotoAvatar) {
    return avatarId
  }

  try {
    const axios = (await import('axios')).default
    const apiKey = process.env.HEYGEN_KEY
    if (!apiKey) {
      throw new Error('Missing HEYGEN_KEY environment variable')
    }

    const response = await axios.get(
      `${HEYGEN_V2_API_URL}/avatar_group/${avatarId}/avatars`,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    const avatarList =
      response.data?.data?.avatar_list ||
      response.data?.avatar_list ||
      response.data?.data ||
      []

    if (Array.isArray(avatarList) && avatarList.length > 0) {
      return avatarList[0].id
    }
  } catch (error: any) {
    console.warn('Failed to resolve talking_photo_id; using group id instead:', error?.response?.data || error?.message)
  }

  return avatarId
}

interface AvatarContext {
  avatarId: string
  avatarRecordId?: string
  isPhotoAvatar: boolean
}

async function resolveAvatarContext(
  userId: string,
  requestedAvatarId?: string | null
  ): Promise<AvatarContext> {
    const { AvatarService } = await import('./avatarService.js')

    const mapAvatarRecord = (avatar: AvatarRecord): AvatarContext => ({
      avatarId: avatar.heygen_avatar_id,
      avatarRecordId: avatar.id,
      isPhotoAvatar: isPhotoAvatarRecord(avatar),
    })

  if (!requestedAvatarId) {
    const defaultAvatar = await AvatarService.getDefaultAvatar(userId)
    if (!defaultAvatar) {
      throw new Error('No avatar configured. Please create or select an avatar before generating videos.')
    }
    return mapAvatarRecord(defaultAvatar as AvatarRecord)
  }

  let avatar: AvatarRecord | null = await AvatarService.getAvatarById(requestedAvatarId, userId)

  if (!avatar) {
    const { data } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .eq('heygen_avatar_id', requestedAvatarId)
      .single()

    if (data) {
      avatar = data as AvatarRecord
    }
  }

  if (avatar) {
    return mapAvatarRecord(avatar)
  }

  throw new Error('Avatar not found. Please ensure the selected avatar belongs to your account.')
}

export interface ManualVideoInput {
  topic: string
  script?: string
  style?: VideoStyle
  duration?: number
  avatar_id?: string | null
  talking_photo_id?: string | null
  plan_item_id?: string | null
  output_resolution?: string
  generate_caption?: boolean
  aspect_ratio?: string | null
  dimension?: HeyGenDimensionInput
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
  aspectRatio: string | null = DEFAULT_VERTICAL_ASPECT_RATIO, // e.g., "9:16" for vertical videos
  dimension?: HeyGenDimensionInput
): GenerateVideoRequest {
  const isVertical = aspectRatio === DEFAULT_VERTICAL_ASPECT_RATIO
  const resolvedOutputResolution = isVertical ? DEFAULT_VERTICAL_OUTPUT_RESOLUTION : outputResolution
  const resolvedDimension =
    dimension || (isVertical ? { ...DEFAULT_VERTICAL_DIMENSION } : undefined)

  const payload: GenerateVideoRequest = {
    topic,
    script: script || topic,
    style,
    duration,
    ...(isPhotoAvatar ? { talking_photo_id: avatarId } : { avatar_id: avatarId }),
    force_vertical: isVertical,
  }

  if (resolvedOutputResolution) {
    payload.output_resolution = resolvedOutputResolution
  }

  if (aspectRatio) {
    payload.aspect_ratio = aspectRatio
  }

  if (resolvedDimension) {
    payload.dimension = resolvedDimension
  }

  // Log payload details including aspect ratio
  if (aspectRatio) {
    console.log(`[HeyGen Payload] Built payload with aspect_ratio: ${aspectRatio}`, {
      hasAspectRatio: !!aspectRatio,
      aspectRatio,
      outputResolution: resolvedOutputResolution,
      hasAvatar: !!avatarId,
      dimension: resolvedDimension,
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

async function updatePlanItemStatus(planItemId: string | null | undefined, status: string): Promise<void> {
  if (!planItemId) {
    return
  }

  try {
    await supabase
      .from('video_plan_items')
      .update({
        status: mapHeygenStatus(status),
        error_message: null,
      })
      .eq('id', planItemId)
  } catch (error) {
    console.error('Failed to update plan item status:', error)
  }
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
  outputResolution: string = DEFAULT_VERTICAL_OUTPUT_RESOLUTION,
  planItemId?: string | null,
  aspectRatio: string | null = DEFAULT_VERTICAL_ASPECT_RATIO,
  dimension?: HeyGenDimensionInput
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

    const resolvedAvatarId = await resolveCharacterIdentifier(avatarId, isPhotoAvatar)

    const payload = buildHeygenPayload(
      video.topic,
      video.script || undefined,
      video.style,
      video.duration,
      resolvedAvatarId,
      isPhotoAvatar,
      outputResolution,
      aspectRatio,
      dimension
    )
    
    console.log('Calling HeyGen API with payload:', {
      videoId: video.id,
      avatarId,
      isPhotoAvatar,
      hasScript: !!payload.script,
      scriptLength: payload.script?.length,
      style: payload.style,
      duration: payload.duration,
      outputResolution: payload.output_resolution,
      aspectRatio: payload.aspect_ratio,
    })
    
    const response = await requestHeygenVideo(payload)
    await applyManualGenerationSuccess(video.id, response)
    await updatePlanItemStatus(planItemId, response.status)
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

type TemplatePreference = {
  templateId: string
  scriptKey: string
  variables: Record<string, any>
  overrides: Record<string, any>
}

async function fetchUserTemplatePreference(userId: string): Promise<TemplatePreference | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('heygen_vertical_template_id, heygen_vertical_template_script_key, heygen_vertical_template_variables, heygen_vertical_template_overrides')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  if (!data.heygen_vertical_template_id) {
    return null
  }

  return {
    templateId: data.heygen_vertical_template_id,
    scriptKey: data.heygen_vertical_template_script_key || 'script',
    variables: data.heygen_vertical_template_variables || {},
    overrides: data.heygen_vertical_template_overrides || {},
  }
}

async function runTemplateGeneration(
  video: Video,
  preference: TemplatePreference,
  scriptText: string,
  planItemId?: string | null
): Promise<void> {
  try {
    const variables: Record<string, any> = {
      ...preference.variables,
    }

    const scriptKey = preference.scriptKey || 'script'
    const scriptValue = scriptText || video.topic || ''
    if (scriptValue) {
      variables[scriptKey] = scriptValue
    }

    const payload = {
      template_id: preference.templateId,
      variables,
      title: video.topic,
      caption: true,
      overrides: preference.overrides,
    }

    const response = await generateVideoFromTemplate(payload)
    await applyManualGenerationSuccess(video.id, response)
    await updatePlanItemStatus(planItemId, response.status)
  } catch (error: any) {
    console.error('Template generation error:', {
      error: error.message || error,
      templateId: preference.templateId,
      videoId: video.id,
    })
    const errMessage = error?.message || 'Template video generation failed'
    throw new Error(errMessage)
  }
}

export class VideoService {
  /**
   * Create a manual video request and trigger HeyGen generation asynchronously
   */
  static async requestManualVideo(userId: string, input: ManualVideoInput): Promise<Video> {
    // If talking_photo_id is provided, use it directly (it's a specific look ID)
    // Otherwise, resolve the avatar context normally
    let avatarId: string | undefined
    let avatarRecordId: string | undefined
    let isPhotoAvatar = false
    
    if (input.talking_photo_id) {
      // Direct look ID provided - use it as talking_photo_id
      avatarId = input.talking_photo_id
      isPhotoAvatar = true
      // Find the avatar record using the group_id (avatar_id) to get avatarRecordId
      if (input.avatar_id) {
        const { data: avatarRecord } = await supabase
          .from('avatars')
          .select('id, heygen_avatar_id')
          .eq('heygen_avatar_id', input.avatar_id)
          .eq('user_id', userId)
          .single()
        if (avatarRecord) {
          avatarRecordId = avatarRecord.id
        }
      }
    } else {
      const resolved = await resolveAvatarContext(
        userId,
        input.avatar_id || null
      )
      avatarId = resolved.avatarId
      avatarRecordId = resolved.avatarRecordId
      isPhotoAvatar = resolved.isPhotoAvatar
    }
    const templatePreference = await fetchUserTemplatePreference(userId)
    
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
    const aspectRatio = input.aspect_ratio || DEFAULT_VERTICAL_ASPECT_RATIO
    const dimension =
      input.dimension ||
      (aspectRatio === DEFAULT_VERTICAL_ASPECT_RATIO ? { ...DEFAULT_VERTICAL_DIMENSION } : undefined)
    const scriptText = (input.script || '').trim() || input.topic

    const scheduleManualGeneration = () =>
      runHeygenGeneration(
        video,
        avatarId,
        isPhotoAvatar,
        outputResolution,
        input.plan_item_id || null,
        aspectRatio,
        dimension
      )

    if (templatePreference) {
      void runTemplateGeneration(video, templatePreference, scriptText, input.plan_item_id || null).catch(
        (error) => {
          console.warn('Template video generation failed; falling back to avatar-based generation:', {
            error: error.message || error,
            videoId: video.id,
          })
          void scheduleManualGeneration()
        }
      )
    } else {
      void scheduleManualGeneration()
    }
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

    const { avatarId, isPhotoAvatar } = await resolveAvatarContext(userId, video.avatar_id)

    const refreshedVideo: Video = {
      ...video,
      status: 'pending',
      heygen_video_id: null,
      video_url: null,
      error_message: null,
    }

    void runHeygenGeneration(refreshedVideo, avatarId, isPhotoAvatar)
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
  static async generateVideoForReel(
    reel: Reel
  ): Promise<{ video_id: string; video_url: string | null }> {
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

    try {
      const scriptText = reel.script.trim()
      if (!scriptText) {
        throw new Error('Reel script is empty. Please provide a script before generating video.')
      }

      const { avatarId, isPhotoAvatar } = await resolveAvatarContext(reel.user_id, null)
      const payload = buildHeygenPayload(
        reel.topic,
        scriptText,
        DEFAULT_REEL_STYLE,
        DEFAULT_REEL_DURATION,
        avatarId,
        isPhotoAvatar,
        DEFAULT_HEYGEN_RESOLUTION,
        DEFAULT_VERTICAL_ASPECT_RATIO
      )

      const response = await requestHeygenVideo(payload)
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
