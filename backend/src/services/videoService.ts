import { supabase } from '../lib/supabase.js'
import { generateVideo as requestHeygenVideo, generateVideoFromTemplate, getVideoStatus } from '../lib/heygen.js'
import type {
  GenerateTemplateVideoRequest,
  GenerateVideoRequest,
  HeyGenDimensionInput,
  HeyGenVideoResponse,
} from '../lib/heygen.js'
import type { Reel, Video } from '../types/database.js'

type TemplateCategory = 'Trading' | 'Lifestyle' | 'Fin. Freedom'

interface TemplateOption {
  id: string
  name: string
  variableKey: string
  aliases?: string[]
}

// Category to HeyGen template mapping
const CATEGORY_TEMPLATES: Record<TemplateCategory, TemplateOption[]> = {
  Trading: [
    { name: 'Daran walking', id: 'a237e3542bf84d87846b37d682d2c01c', variableKey: 'script_text1', aliases: ['daran walk'] },
    { name: 'Daran in car', id: 'b99820266bee40358230e262ec87c311', variableKey: 'script_text1' },
    { name: 'Daran sitting', id: 'e34a91cbd65e4fa3b0128a07ba170d98', variableKey: 'script' },
  ],
  Lifestyle: [
    { name: 'Car', id: 'e9422da4ef744aae824f00fbc4a55400', variableKey: 'script' },
    { name: 'Room', id: 'dcba1982d86c4624b40266ff074e1712', variableKey: 'script', aliases: ['room'] },
    { name: 'Outside', id: '265a7b0306a34b58bf1be6eeb5bc4aa2', variableKey: 'script' },
  ],
  'Fin. Freedom': [
    { name: 'Tim outside', id: '01eb044dcc5d4c6aa5f2ad7b06d3cdd8', variableKey: 'script' },
    { name: 'Tim laying', id: '2915dfbaefa046f487acfbef3414d101', variableKey: 'script' },
    { name: '3', id: '54c7ee59d7cd4b3b8efc5aca10808bb4', variableKey: 'script', aliases: ['template 3'] },
  ],
}

const ALL_TEMPLATE_OPTIONS: TemplateOption[] = [
  ...CATEGORY_TEMPLATES.Trading,
  ...CATEGORY_TEMPLATES.Lifestyle,
  ...CATEGORY_TEMPLATES['Fin. Freedom'],
]

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
const DEFAULT_TEMPLATE_DIMENSION: HeyGenDimensionInput = {
  width: 720,
  height: 1280,
}
const DEFAULT_TEMPLATE_SCRIPT_KEY = 'script'
const GLOBAL_FALLBACK_TEMPLATE_ID = 'baf2ab03a4354aebac815fd42c10895b'
const DEFAULT_TEMPLATE_AVATAR_VARIABLE_KEY =
  process.env.HEYGEN_TEMPLATE_AVATAR_VARIABLE_KEY?.trim() || 'avatar_id'
const DEFAULT_TEMPLATE_PHOTO_AVATAR_VARIABLE_KEY =
  process.env.HEYGEN_TEMPLATE_PHOTO_AVATAR_VARIABLE_KEY?.trim() || 'talking_photo_id'

type TemplateOverrides = {
  templateId: string
  scriptKey: string
  defaults: Record<string, string>
  payloadOverrides: Record<string, any>
  avatarNodeIds: string[]
  avatarVariableKey?: string
  photoAvatarVariableKey?: string
}

const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const replaceTemplateTokens = (input: any, replacements: Record<string, string | undefined>): any => {
  if (typeof input === 'string') {
    return Object.entries(replacements).reduce((acc, [token, replacement]) => {
      const safeReplacement = replacement ?? ''
      return acc.replace(new RegExp(escapeRegex(token), 'gi'), safeReplacement)
    }, input)
  }

  if (Array.isArray(input)) {
    return input.map((item) => replaceTemplateTokens(item, replacements))
  }

  if (input && typeof input === 'object') {
    return Object.entries(input).reduce((acc, [key, value]) => {
      acc[key] = replaceTemplateTokens(value, replacements)
      return acc
    }, {} as Record<string, any>)
  }

  return input
}

const cloneJson = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value))

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

function normalizeCategory(category?: string | null): TemplateCategory {
  const value = (category || '').trim().toLowerCase()
  if (value === 'life style' || value === 'lifestyle') {
    return 'Lifestyle'
  }
  if (value === 'fin. freedom' || value === 'fin freedom' || value === 'financial freedom') {
    return 'Fin. Freedom'
  }
  return 'Trading'
}

function templateMatches(option: TemplateOption, identifier: string): boolean {
  const normalizedIdentifier = identifier.trim().toLowerCase()
  if (option.id.toLowerCase() === normalizedIdentifier) {
    return true
  }

  const normalizedName = option.name.trim().toLowerCase()
  if (normalizedName === normalizedIdentifier) {
    return true
  }

  if (normalizedName.replace(/\s+/g, '') === normalizedIdentifier.replace(/\s+/g, '')) {
    return true
  }

  return option.aliases?.some(
    (alias) => alias.trim().toLowerCase() === normalizedIdentifier
  ) ?? false
}

function selectTemplateOption(category: string | null | undefined, requested?: string | null): TemplateOption {
  const normalizedCategory = normalizeCategory(category)
  const templates = CATEGORY_TEMPLATES[normalizedCategory] || CATEGORY_TEMPLATES.Trading

  if (requested && requested.trim().length > 0) {
    const trimmed = requested.trim()
    const match =
      templates.find((option) => templateMatches(option, trimmed)) ||
      ALL_TEMPLATE_OPTIONS.find((option) => templateMatches(option, trimmed))

    if (match) {
      return match
    }

    return {
      id: trimmed,
      name: trimmed,
      variableKey: 'script',
    }
  }

  return templates[Math.floor(Math.random() * templates.length)]
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
  outputResolution: string = DEFAULT_HEYGEN_RESOLUTION,
  planItemId?: string | null,
  aspectRatio: string | null = DEFAULT_VERTICAL_ASPECT_RATIO,
  dimension?: HeyGenDimensionInput,
  templateSettings?: TemplateOverrides
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
    
    const usingTemplate =
      !!templateSettings?.templateId && aspectRatio === DEFAULT_VERTICAL_ASPECT_RATIO

    if (!avatarId && !usingTemplate) {
      throw new Error('No avatar available. Please configure an avatar in your settings.')
    }

    const resolvedAvatarId = await resolveCharacterIdentifier(avatarId, isPhotoAvatar)

    if (usingTemplate) {
      const scriptValue = (video.script || video.topic || '').trim()
      if (!scriptValue) {
        throw new Error('Script is required when using a HeyGen template.')
      }

      const scriptKey = templateSettings.scriptKey?.trim() || DEFAULT_TEMPLATE_SCRIPT_KEY

      const topicValue = (video.topic || scriptValue).trim()
      const placeholderMap: Record<string, string> = {
        '{{script}}': scriptValue,
        '{{topic}}': topicValue,
        '{{avatar_id}}': resolvedAvatarId || '',
        '{{talking_photo_id}}': isPhotoAvatar && resolvedAvatarId ? resolvedAvatarId : '',
      }

      const processedDefaults: Record<string, any> = {}
      for (const [key, rawValue] of Object.entries(templateSettings.defaults || {})) {
        if (rawValue === null || rawValue === undefined) {
          continue
        }
        const processedValue =
          typeof rawValue === 'string'
            ? replaceTemplateTokens(rawValue, placeholderMap)
            : replaceTemplateTokens(cloneJson(rawValue), placeholderMap)
        processedDefaults[key] = processedValue
      }

      const variables: Record<string, any> = {
        ...processedDefaults,
        [scriptKey]: scriptValue,
      }

      if (resolvedAvatarId) {
        const characterPayload = (variableName: string) => ({
          name: variableName,
          type: 'character',
          properties: {
            character_id: resolvedAvatarId,
            type: isPhotoAvatar ? 'talking_photo' : 'avatar',
          },
        })

        if (isPhotoAvatar && templateSettings.photoAvatarVariableKey) {
          variables[templateSettings.photoAvatarVariableKey] = characterPayload(
            templateSettings.photoAvatarVariableKey
          )
        } else if (!isPhotoAvatar && templateSettings.avatarVariableKey) {
          variables[templateSettings.avatarVariableKey] = characterPayload(
            templateSettings.avatarVariableKey
          )
        }
      }

      const templateRequest: GenerateTemplateVideoRequest = {
        template_id: templateSettings.templateId,
        variables,
        title: video.topic?.slice(0, 80) || 'Content Factory Video',
        caption: false,
        include_gif: false,
        enable_sharing: false,
        dimension: dimension || DEFAULT_TEMPLATE_DIMENSION,
      }

      let overridesPayload: Record<string, any> | undefined =
        templateSettings.payloadOverrides && Object.keys(templateSettings.payloadOverrides).length > 0
          ? replaceTemplateTokens(cloneJson(templateSettings.payloadOverrides), placeholderMap)
          : undefined

      if (templateSettings.avatarNodeIds?.length && avatarId) {
        const nodesOverride: any[] = Array.isArray(overridesPayload?.nodes_override)
          ? [...overridesPayload!.nodes_override]
          : []

        const characterOverride = isPhotoAvatar
          ? { type: 'talking_photo', talking_photo_id: avatarId }
          : { type: 'avatar', avatar_id: avatarId }

        for (const nodeId of templateSettings.avatarNodeIds) {
          nodesOverride.push({
            id: nodeId,
            character: characterOverride,
          })
        }

        overridesPayload = overridesPayload || {}
        overridesPayload.nodes_override = nodesOverride
      }

      if (overridesPayload && Object.keys(overridesPayload).length > 0) {
        templateRequest.overrides = overridesPayload
      }

      console.log('[HeyGen Template] Generating video via template', {
        videoId: video.id,
        templateId: templateSettings.templateId,
        scriptKey,
        variableKeys: Object.keys(variables),
        hasOverrides: !!templateRequest.overrides,
      })

      const response = await generateVideoFromTemplate(templateRequest)
      await applyManualGenerationSuccess(video.id, response)
      await updatePlanItemStatus(planItemId, response.status)
      return
    }
    
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
    
    // For SaaS: Fetch user-specific template overrides from preferences
    let preferences: Record<string, any> | null = null
    const { data: prefData, error: prefError } = await supabase
      .from('user_preferences')
      .select(
        'heygen_vertical_template_id, heygen_vertical_template_script_key, heygen_vertical_template_variables, heygen_vertical_template_overrides'
      )
      .eq('user_id', userId)
      .single()
    if (prefError) {
      if (prefError.code !== 'PGRST205') {
        console.warn('[Preferences] Failed to load user preferences:', prefError.message || prefError)
      } else {
        console.warn('[Preferences] user_preferences table not found; falling back to env template config')
      }
    } else {
      preferences = prefData
    }

    const normalizeTemplateDefaults = (raw: unknown): Record<string, any> => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {}
      }
      return Object.entries(raw as Record<string, any>).reduce((acc, [key, value]) => {
        if (value === undefined) {
          return acc
        }
        acc[key] = value
        return acc
      }, {} as Record<string, any>)
    }
    const normalizeTemplateOverrides = (raw: unknown): Record<string, any> => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {}
      }
      return raw as Record<string, any>
    }
    const parseJsonObject = (value?: string | null): Record<string, any> => {
      if (!value || value.trim().length === 0) {
        return {}
      }
      try {
        const parsed = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return {}
        }
        return parsed
      } catch (error) {
        console.warn('[HeyGen Template] Failed to parse JSON env value:', error)
        return {}
      }
    }
    const parseNodeIdList = (value?: string | null): string[] => {
      if (!value) return []
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    }

    const resolveTemplateId = (): string | undefined => {
      if (preferences?.heygen_vertical_template_id?.trim()) {
        return preferences.heygen_vertical_template_id.trim()
      }
      if (process.env.HEYGEN_VERTICAL_TEMPLATE_ID?.trim()) {
        return process.env.HEYGEN_VERTICAL_TEMPLATE_ID.trim()!
      }
      return GLOBAL_FALLBACK_TEMPLATE_ID
    }

    const templateId = resolveTemplateId()

    const templateSettings: TemplateOverrides | undefined = templateId
      ? {
          templateId,
          scriptKey:
            preferences?.heygen_vertical_template_script_key?.trim() ||
            process.env.HEYGEN_VERTICAL_TEMPLATE_SCRIPT_KEY?.trim() ||
            DEFAULT_TEMPLATE_SCRIPT_KEY,
          defaults:
            Object.keys(preferences?.heygen_vertical_template_variables || {}).length > 0
              ? normalizeTemplateDefaults(preferences?.heygen_vertical_template_variables)
              : normalizeTemplateDefaults(parseJsonObject(process.env.HEYGEN_VERTICAL_TEMPLATE_VARIABLES)),
          payloadOverrides:
            Object.keys(preferences?.heygen_vertical_template_overrides || {}).length > 0
              ? normalizeTemplateOverrides(preferences?.heygen_vertical_template_overrides)
              : parseJsonObject(process.env.HEYGEN_VERTICAL_TEMPLATE_OVERRIDES),
          avatarNodeIds: parseNodeIdList(process.env.HEYGEN_TEMPLATE_AVATAR_NODE_IDS),
          avatarVariableKey: DEFAULT_TEMPLATE_AVATAR_VARIABLE_KEY,
          photoAvatarVariableKey: DEFAULT_TEMPLATE_PHOTO_AVATAR_VARIABLE_KEY,
        }
      : undefined

    // Validate avatar before creating video record (unless a template is configured)
    if (!avatarId && !templateSettings) {
      throw new Error(
        'No avatar configured. Please set up an avatar or provide a HeyGen template in Preferences before generating videos.'
      )
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
    const aspectRatio = input.aspect_ratio || DEFAULT_VERTICAL_ASPECT_RATIO
    const dimension =
      input.dimension ||
      (aspectRatio === DEFAULT_VERTICAL_ASPECT_RATIO ? { ...DEFAULT_VERTICAL_DIMENSION } : undefined)
    void runHeygenGeneration(
      video,
      avatarId,
      isPhotoAvatar,
      outputResolution,
      input.plan_item_id || null,
      aspectRatio,
      dimension,
      templateSettings
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
  static async generateVideoForReel(
    reel: Reel
  ): Promise<{ video_id: string; video_url: string | null; template?: TemplateOption }> {
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
      const templateSelection = selectTemplateOption(reel.category, reel.template)
      const scriptText = reel.script.trim()
      if (!scriptText) {
        throw new Error('Reel script is empty. Please provide a script before generating video.')
    }

      const variables: Record<string, string> = {
        [templateSelection.variableKey]: scriptText,
      }

      const templatePayload: GenerateTemplateVideoRequest = {
        template_id: templateSelection.id,
        variables,
        title: reel.topic?.slice(0, 80) || 'Content Factory Video',
        caption: true,
        include_gif: false,
        enable_sharing: false,
        dimension: DEFAULT_TEMPLATE_DIMENSION,
      }

      const callbackUrl = process.env.HEYGEN_TEMPLATE_CALLBACK_URL?.trim()
      if (callbackUrl) {
        templatePayload.callback_url = callbackUrl
      }

      console.log('[Reel Template] Generating HeyGen template video', {
        reelId: reel.id,
        category: reel.category,
        selectedTemplate: templateSelection.name,
        templateId: templateSelection.id,
        variableKey: templateSelection.variableKey,
        hasCallback: !!templatePayload.callback_url,
      })

      const response = await generateVideoFromTemplate(templatePayload)

      return {
        video_id: response.video_id,
        video_url: response.video_url || null,
        template: templateSelection,
      }
    } catch (error: any) {
      console.error('Error generating template video for reel:', error)
      throw new Error(`Failed to generate video: ${error.message}`)
    }
  }

  /**
   * Get template for category
   */
  static getTemplateForCategory(category: TemplateCategory): string {
    return selectTemplateOption(category).name
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
