import { supabase } from '../lib/supabase.js'
import { generateVideo as requestHeygenVideo, generateVideoFromTemplate, getVideoStatus } from '../lib/heygen.js'
import type {
  GenerateVideoRequest,
  GenerateTemplateVideoRequest,
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

interface TemplatePreferences {
  templateId: string
  scriptKey: string
  variables: Record<string, any>
  overrides: Record<string, any>
}

interface TemplateContextRecord {
  [key: string]: string | undefined
}

interface TemplateContext extends TemplateContextRecord {
  script: string
  topic: string
  avatar_id?: string
  talking_photo_id?: string
}

interface TemplateGenerationInput {
  userId: string
  topic: string
  script?: string | null
  avatarId?: string
  isPhotoAvatar: boolean
  dimension?: HeyGenDimensionInput
  title?: string
}

const TEMPLATE_ENV_ID = process.env.HEYGEN_VERTICAL_TEMPLATE_ID?.trim()
const TEMPLATE_ENV_SCRIPT_KEY = (process.env.HEYGEN_VERTICAL_TEMPLATE_SCRIPT_KEY || 'script').trim() || 'script'
const TEMPLATE_ENV_VARIABLES = process.env.HEYGEN_VERTICAL_TEMPLATE_VARIABLES
const TEMPLATE_ENV_OVERRIDES = process.env.HEYGEN_VERTICAL_TEMPLATE_OVERRIDES

// Default template ID to use when no other template is configured
// This ensures all videos use templates by default
const DEFAULT_TEMPLATE_ID = 'baf2ab03a4354aebac815fd42c10895b'

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

function parseTemplateEnvJson(value?: string): Record<string, any> {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch (error) {
    console.warn(`Failed to parse template JSON:`, error)
  }
  return {}
}

function getEnvTemplatePreferences(): TemplatePreferences | null {
  // Use env var if set, otherwise fall back to default template ID
  const templateId = TEMPLATE_ENV_ID || DEFAULT_TEMPLATE_ID
  
  if (!templateId || templateId.trim().length === 0) {
    return null
  }

  console.log(`[Template] Using template ID: ${templateId} (${TEMPLATE_ENV_ID ? 'from env var' : 'default fallback'})`)

  return {
    templateId: templateId.trim(),
    scriptKey: TEMPLATE_ENV_SCRIPT_KEY,
    variables: parseTemplateEnvJson(TEMPLATE_ENV_VARIABLES),
    overrides: parseTemplateEnvJson(TEMPLATE_ENV_OVERRIDES),
  }
}

async function getTemplatePreferences(userId: string): Promise<TemplatePreferences | null> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(
        'heygen_vertical_template_id, heygen_vertical_template_script_key, heygen_vertical_template_variables, heygen_vertical_template_overrides'
      )
      .eq('user_id', userId)
      .single()

    const templateId = (data?.heygen_vertical_template_id || '').trim()
    if (!error && data && templateId.length > 0) {
      console.log(`[Template] Found user template preference: ${templateId} for user ${userId}`)
      return {
        templateId,
        scriptKey: (data.heygen_vertical_template_script_key || 'script').trim() || 'script',
        variables: (data.heygen_vertical_template_variables || {}) as Record<string, any>,
        overrides: (data.heygen_vertical_template_overrides || {}) as Record<string, any>,
      }
    } else {
      if (error && error.code !== 'PGRST116') {
        console.warn(`[Template] Error loading user preferences for ${userId}:`, error.message)
      } else {
        console.log(`[Template] No user template preference found for user ${userId}, checking env vars...`)
      }
    }
  } catch (error) {
    console.error('[Template] Failed to load HeyGen template preferences:', error)
  }

  const envPrefs = getEnvTemplatePreferences()
  if (envPrefs) {
    // Logging is already done in getEnvTemplatePreferences
    return envPrefs
  } else {
    console.error(`[Template] CRITICAL: No template available (default template ID is invalid)`)
    return null
  }
}

function replacePlaceholders(value: any, context: TemplateContextRecord): any {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER_REGEX, (_, token) => {
      const replacement = context[token]
      return replacement !== undefined ? String(replacement) : ''
    })
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, context))
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = replacePlaceholders(nestedValue, context)
    }
    return result
  }

  return value
}

function buildTemplateVariables(
  rawVariables: Record<string, any>,
  scriptKey: string,
  scriptValue: string,
  context: TemplateContextRecord
): Record<string, any> {
  const sanitizedVariables = { ...rawVariables }
  const key = scriptKey?.trim() || 'script'
  sanitizedVariables[key] = scriptValue
  return replacePlaceholders(sanitizedVariables, context)
}

function buildTemplateOverrides(
  rawOverrides: Record<string, any>,
  context: TemplateContextRecord
): Record<string, any> {
  if (!rawOverrides || Object.keys(rawOverrides).length === 0) {
    return {}
  }
  return replacePlaceholders(rawOverrides, context)
}

async function maybeGenerateVideoUsingTemplate(
  input: TemplateGenerationInput
): Promise<HeyGenVideoResponse | null> {
  console.log(`[Template Generation] Attempting template generation for user ${input.userId}`, {
    hasAvatarId: !!input.avatarId,
    isPhotoAvatar: input.isPhotoAvatar,
    hasScript: !!input.script,
    topic: input.topic,
  })

  const preferences = await getTemplatePreferences(input.userId)
  if (!preferences) {
    console.log(`[Template Generation] No template preferences found, falling back to regular API`)
    return null
  }

  if (!input.avatarId) {
    console.warn(`[Template Generation] No avatarId provided, cannot use template (requires avatar for overrides)`)
    return null
  }

  const scriptValue = (input.script?.trim() || input.topic || 'Video Content').trim() || 'Video Content'
  const topicValue = (input.topic || scriptValue || 'Video Content').trim() || 'Video Content'
  const context: TemplateContext = {
    script: scriptValue,
    topic: topicValue,
    avatar_id: input.avatarId?.trim() || undefined,
  }

  if (input.isPhotoAvatar) {
    context.talking_photo_id = input.avatarId?.trim() || undefined
  }

  const variables = buildTemplateVariables(preferences.variables, preferences.scriptKey, scriptValue, context)
  const userOverrides = buildTemplateOverrides(preferences.overrides, context)

  // Build character override for the selected avatar
  const characterOverride: Record<string, any> = input.isPhotoAvatar
    ? {
        type: 'talking_photo',
        talking_photo_id: input.avatarId,
      }
    : {
        type: 'avatar',
        avatar_id: input.avatarId,
      }

  // HeyGen template API: If avatar is assigned a variable name in the template,
  // it should be passed in variables with type "character"
  // Common variable names: "avatar", "character", "avatar_scene1", etc.
  // Check if user has already specified an avatar variable, or try common names
  const avatarVariableNames = ['avatar', 'character', 'avatar_scene1', 'avatar_scene', 'talking_photo']
  let avatarVariableFound = false

  for (const varName of avatarVariableNames) {
    if (variables[varName]) {
      // User already has this variable, ensure it's set to character type
      if (typeof variables[varName] === 'object' && variables[varName].type === 'character') {
        // Already a character variable, update its properties
        variables[varName] = {
          name: varName,
          type: 'character',
          properties: characterOverride,
        }
        avatarVariableFound = true
        console.log(`[Template Generation] Found avatar variable "${varName}" in template variables, updating with selected avatar`)
        break
      }
    }
  }

  // If no avatar variable found, add it to the first common name that's not already used
  if (!avatarVariableFound) {
    for (const varName of avatarVariableNames) {
      if (!variables[varName]) {
        variables[varName] = {
          name: varName,
          type: 'character',
          properties: characterOverride,
        }
        avatarVariableFound = true
        console.log(`[Template Generation] Adding avatar as character variable "${varName}" to template variables`)
        break
      }
    }
  }

  // Always add avatar override to use the selected avatar instead of template's default
  // Merge user overrides with automatic avatar override
  const avatarOverride: Record<string, any> = {
    ...userOverrides,
  }

  // Add nodes_override to replace avatar in template if user hasn't already specified it
  // HeyGen template API uses nodes_override array to override specific nodes
  if (!avatarOverride.nodes_override && !avatarOverride.nodes) {
    // Try to override all character nodes in the template
    // This structure targets any node with a character property
    avatarOverride.nodes_override = [
      {
        character: characterOverride,
      },
    ]
  } else if (avatarOverride.nodes_override && Array.isArray(avatarOverride.nodes_override)) {
    // If user provided nodes_override, ensure all character nodes use our avatar
    avatarOverride.nodes_override = avatarOverride.nodes_override.map((node: any) => {
      if (node.character) {
        return {
          ...node,
          character: characterOverride,
        }
      }
      return node
    })
  }

  // Also add video_inputs_override as an alternative structure (some templates use this)
  if (!avatarOverride.video_inputs_override) {
    avatarOverride.video_inputs_override = [
      {
        character: characterOverride,
      },
    ]
  }

  // Add top-level character override as fallback
  if (!avatarOverride.character) {
    avatarOverride.character = characterOverride
  }

  const request: GenerateTemplateVideoRequest = {
    template_id: preferences.templateId,
    variables,
    title: input.title?.trim() || topicValue,
    caption: false,
    dimension: input.dimension,
    overrides: avatarOverride,
  }

  console.log(`[Template Generation] Using HeyGen template ${preferences.templateId} for user ${input.userId}`, {
    templateId: preferences.templateId,
    scriptKey: preferences.scriptKey,
    hasVariables: Object.keys(variables).length > 0,
    hasOverrides: Object.keys(avatarOverride).length > 0,
    avatarId: input.avatarId,
    isPhotoAvatar: input.isPhotoAvatar,
    overrideStructure: JSON.stringify(avatarOverride, null, 2).substring(0, 500),
  })

  try {
    const response = await generateVideoFromTemplate(request)
    console.log(`[Template Generation] ✅ Successfully generated video using template: ${response.video_id}`)
    return response
  } catch (error: any) {
    console.error(`[Template Generation] ❌ Template generation failed:`, {
      error: error.message,
      templateId: preferences.templateId,
      userId: input.userId,
    })
    // Don't throw - let it fall back to regular API
    return null
  }
}

export interface ManualVideoInput {
  topic: string
  script?: string
  style?: VideoStyle
  duration?: number
  avatar_id?: string | null
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

    if (!resolvedAvatarId) {
      throw new Error('Failed to resolve avatar identifier. Please check your avatar configuration.')
    }

    console.log(`[Video Generation] Attempting template generation first for video ${video.id}`, {
      userId: video.user_id,
      hasResolvedAvatarId: !!resolvedAvatarId,
      isPhotoAvatar,
    })

    const templateResponse = await maybeGenerateVideoUsingTemplate({
      userId: video.user_id,
      topic: video.topic,
      script: video.script || undefined,
      avatarId: resolvedAvatarId,
      isPhotoAvatar,
      dimension,
      title: video.topic,
    })

    if (templateResponse) {
      console.log(`[Video Generation] ✅ Template generation succeeded for video ${video.id}, video_id: ${templateResponse.video_id}`)
      await applyManualGenerationSuccess(video.id, templateResponse)
      await updatePlanItemStatus(planItemId, templateResponse.status)
      return
    }

    console.log(`[Video Generation] Template generation not used, falling back to regular HeyGen API for video ${video.id}`)

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

export class VideoService {
  /**
   * Create a manual video request and trigger HeyGen generation asynchronously
   */
  static async requestManualVideo(userId: string, input: ManualVideoInput): Promise<Video> {
    const { avatarId, avatarRecordId, isPhotoAvatar } = await resolveAvatarContext(
      userId,
      input.avatar_id || null
    )
    
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
    const outputResolution = DEFAULT_VERTICAL_OUTPUT_RESOLUTION
    const aspectRatio = DEFAULT_VERTICAL_ASPECT_RATIO
    const dimension = { ...DEFAULT_VERTICAL_DIMENSION }
    void runHeygenGeneration(
      video,
      avatarId,
      isPhotoAvatar,
      outputResolution,
      input.plan_item_id || null,
      aspectRatio,
      dimension
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
      const resolvedAvatarId = await resolveCharacterIdentifier(avatarId, isPhotoAvatar)
      
      if (!resolvedAvatarId) {
        throw new Error('Failed to resolve avatar identifier for reel. Please check your avatar configuration.')
      }

      console.log(`[Reel Generation] Attempting template generation for reel ${reel.id}`, {
        userId: reel.user_id,
        hasResolvedAvatarId: !!resolvedAvatarId,
        isPhotoAvatar,
      })

      const templateDimension = { ...DEFAULT_VERTICAL_DIMENSION }
      const templateResponse = await maybeGenerateVideoUsingTemplate({
        userId: reel.user_id,
        topic: reel.topic,
        script: scriptText,
        avatarId: resolvedAvatarId,
        isPhotoAvatar,
        dimension: templateDimension,
        title: reel.topic,
      })

      if (templateResponse) {
        console.log(`[Reel Generation] ✅ Template generation succeeded for reel ${reel.id}, video_id: ${templateResponse.video_id}`)
        return {
          video_id: templateResponse.video_id,
          video_url: templateResponse.video_url || null,
        }
      }

      console.log(`[Reel Generation] Template generation not used, falling back to regular HeyGen API for reel ${reel.id}`)

      const payload = buildHeygenPayload(
        reel.topic,
        scriptText,
        DEFAULT_REEL_STYLE,
        DEFAULT_REEL_DURATION,
        resolvedAvatarId,
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
