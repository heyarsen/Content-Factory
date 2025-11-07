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
  style?: VideoStyle
  duration?: number
  avatar_id?: string | null
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

function buildHeygenPayload(topic: string, script: string | undefined, style: VideoStyle, duration: number, avatarId?: string, isPhotoAvatar: boolean = false) {
  return {
    topic,
    script: script || topic,
    style,
    duration,
    ...(isPhotoAvatar ? { talking_photo_id: avatarId } : { avatar_id: avatarId }),
  }
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
  if (mapHeygenStatus(response.status) === 'completed' && video) {
    const metadata = video.metadata as any
    if (metadata?.generate_caption && video.topic) {
      // Generate caption asynchronously
      void generateCaptionForVideo(videoId, video.topic, video.script)
    }
  }
}

async function generateCaptionForVideo(videoId: string, topic: string, script?: string | null): Promise<void> {
  try {
    const { openai } = await import('../lib/openai.js')
    
    const prompt = `Generate a compelling social media caption/description for a short video post. 

${topic ? `Topic: ${topic}` : ''}
${script ? `Script: ${script.substring(0, 500)}` : ''}

Requirements:
- Engaging and click-worthy
- Include relevant hashtags (3-5)
- Platform-optimized (works for Instagram, TikTok, YouTube Shorts, etc.)
- 100-200 characters for the main caption
- Include a call-to-action
- Professional but approachable tone

Output ONLY the caption text, nothing else.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a social media content writer specializing in video captions for short-form content platforms.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    })

    const caption = completion.choices[0]?.message?.content?.trim() || ''
    
    if (caption) {
      // Update video with generated caption (store in metadata or a caption field if it exists)
      await supabase
        .from('videos')
        .update({
          metadata: { ...((await supabase.from('videos').select('metadata').eq('id', videoId).single()).data?.metadata as any || {}), caption },
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId)
      
      console.log(`Generated caption for video ${videoId}:`, caption.substring(0, 50) + '...')
    }
  } catch (error: any) {
    console.error('Failed to generate caption for video:', error)
    // Don't throw - caption generation failure shouldn't break video completion
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

async function runHeygenGeneration(video: Video, avatarId?: string, isPhotoAvatar: boolean = false): Promise<void> {
  try {
    if (!avatarId) {
      throw new Error('No avatar available. Please configure an avatar in your settings.')
    }
    
    // Build payload with proper avatar type
    const payload = {
      topic: video.topic,
      script: video.script || undefined,
      style: video.style,
      duration: video.duration,
      ...(isPhotoAvatar ? { talking_photo_id: avatarId } : { avatar_id: avatarId }),
    }
    
    console.log('Calling HeyGen API with payload:', {
      videoId: video.id,
      avatarId,
      isPhotoAvatar,
      hasScript: !!payload.script,
      scriptLength: payload.script?.length,
      style: payload.style,
      duration: payload.duration,
    })
    
    const response = await requestHeygenVideo(payload)
    await applyManualGenerationSuccess(video.id, response)
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
    
    const video = await this.createVideoRecord(userId, input, avatarRecordId)
    void runHeygenGeneration(video, avatarId, isPhotoAvatar)
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
  static async generateVideoForReel(reel: Reel): Promise<{ video_id: string; video_url: string | null }> {
    if (!reel.script) {
      throw new Error('Reel must have a script to generate video')
    }

    const template = reel.template || CATEGORY_TEMPLATES[reel.category] || CATEGORY_TEMPLATES.Trading

    try {
      // For reels, we don't have avatar info, so use default (regular avatar)
      const response = await requestHeygenVideo(
        buildHeygenPayload(reel.topic, reel.script, DEFAULT_REEL_STYLE, DEFAULT_REEL_DURATION, undefined, false)
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
        metadata: input.generate_caption !== false ? { generate_caption: true } : null,
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
