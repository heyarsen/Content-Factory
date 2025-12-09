import axios from 'axios'
import { retryWithBackoff } from './perplexity.js'

const HEYGEN_API_URL = 'https://api.heygen.com/v1'
const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'

function getHeyGenKey(): string {
  const key = process.env.HEYGEN_KEY
  if (!key) {
    throw new Error('Missing HEYGEN_KEY environment variable')
  }
  return key
}

const DEFAULT_HEYGEN_RESOLUTION =
  process.env.HEYGEN_OUTPUT_RESOLUTION && process.env.HEYGEN_OUTPUT_RESOLUTION.trim().length > 0
    ? process.env.HEYGEN_OUTPUT_RESOLUTION.trim()
    : '720p'

export type HeyGenDimensionInput = {
  width?: number
  height?: number
}

type HeyGenDimension = {
  width: number
  height: number
}

const formatDimensionForHeygen = (dimension: HeyGenDimension): { width: string; height: string } => ({
  width: dimension.width.toString(),
  height: dimension.height.toString(),
})

const parsePositiveInteger = (value: unknown): number | null => {
  if (value === undefined || value === null) return null
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }
  return Math.round(numeric)
}

const sanitizeDimensionInput = (dimension?: HeyGenDimensionInput): HeyGenDimension | null => {
  if (!dimension) return null
  const width = parsePositiveInteger(dimension.width)
  const height = parsePositiveInteger(dimension.height)
  if (!width || !height) {
    return null
  }
  return { width, height }
}

const parseResolutionToDimension = (resolution?: string): HeyGenDimension | null => {
  if (!resolution) return null
  const match = resolution.trim().toLowerCase().match(/(\d+)\s*x\s*(\d+)/)
  if (!match) return null
  const width = parsePositiveInteger(parseInt(match[1], 10))
  const height = parsePositiveInteger(parseInt(match[2], 10))
  if (!width || !height) return null
  return { width, height }
}

const DEFAULT_VERTICAL_DIMENSION: HeyGenDimension = (() => {
  const fallbackWidth = 1080
  const fallbackHeight = 1920
  const envWidth = parsePositiveInteger(process.env.HEYGEN_VERTICAL_WIDTH) ?? fallbackWidth
  const envHeight = parsePositiveInteger(process.env.HEYGEN_VERTICAL_HEIGHT)
  const computedHeight = envHeight && envHeight > envWidth ? envHeight : Math.max(Math.round(envWidth * (16 / 9)), envWidth + 1, fallbackHeight)
  return {
    width: envWidth,
    height: computedHeight,
  }
})()

const DEFAULT_VERTICAL_OUTPUT_RESOLUTION = `${DEFAULT_VERTICAL_DIMENSION.width}x${DEFAULT_VERTICAL_DIMENSION.height}`

const LOOK_PROCESSING_TIMEOUT_MS =
  parsePositiveInteger(process.env.HEYGEN_LOOK_PROCESSING_TIMEOUT_MS) ?? 240000

const LOOK_PROCESSING_POLL_INTERVAL_MS =
  parsePositiveInteger(process.env.HEYGEN_LOOK_PROCESSING_POLL_INTERVAL_MS) ?? 5000

const LOOK_UPLOAD_PENDING_SUBSTRINGS = [
  'photo avatar look upload not completed',
  'look upload not completed',
  'look upload incomplete',
]

const RETRYABLE_TRAINING_ERROR_SUBSTRINGS = [
  'no valid image',
  ...LOOK_UPLOAD_PENDING_SUBSTRINGS,
]

type PhotoAvatarLook = {
  id: string
  name?: string
  status?: string
  group_id?: string
  image_url?: string
  business_type?: string
  upscale_availability?: {
    available?: boolean
    reason?: string | null
  }
  [key: string]: any
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const normalize = (value?: string | null) => (value || '').toLowerCase().trim()

const isLookUploadPending = (look?: PhotoAvatarLook | null): boolean => {
  if (!look) return true
  const reason = normalize(look.upscale_availability?.reason)
  if (!reason) return false
  return LOOK_UPLOAD_PENDING_SUBSTRINGS.some((token) => reason.includes(token))
}

const isLookReadyForTraining = (look?: PhotoAvatarLook | null): boolean => {
  if (!look || !look.id) return false
  if (normalize(look.status) === 'failed') {
    return false
  }
  if (isLookUploadPending(look)) {
    return false
  }
  return true
}

export async function fetchAvatarGroupLooks(groupId: string): Promise<PhotoAvatarLook[]> {
  const apiKey = getHeyGenKey()
  const response = await axios.get(
    `${HEYGEN_V2_API_URL}/avatar_group/${groupId}/avatars`,
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

  if (!Array.isArray(avatarList)) {
    return []
  }

  return avatarList.filter((look: any) => look && typeof look === 'object')
}

export interface WaitForLooksReadyOptions {
  minReadyLooks?: number
  maxWaitTime?: number
  pollInterval?: number
}

export async function waitForLooksReady(
  groupId: string,
  lookIds: string[],
  options: WaitForLooksReadyOptions = {}
): Promise<{ readyLooks: PhotoAvatarLook[]; snapshot: PhotoAvatarLook[] }> {
  const uniqueLookIds = Array.from(
    new Set(
      lookIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  )

  if (uniqueLookIds.length === 0) {
    throw new Error('No look IDs available to monitor for upload completion.')
  }

  const minReadyLooks = Math.min(
    uniqueLookIds.length,
    Math.max(options.minReadyLooks ?? 1, 1)
  )
  const maxWaitTime = options.maxWaitTime ?? LOOK_PROCESSING_TIMEOUT_MS
  const pollInterval = options.pollInterval ?? LOOK_PROCESSING_POLL_INTERVAL_MS
  const startTime = Date.now()

  console.log(
    `[Looks Monitor] Waiting for ${minReadyLooks}/${uniqueLookIds.length} look(s) to finish uploading for group ${groupId}...`
  )

  let lastError: any = null

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const snapshot = await fetchAvatarGroupLooks(groupId)
      const lookMap = new Map<string, PhotoAvatarLook>()
      snapshot.forEach((look) => {
        if (look?.id) {
          lookMap.set(look.id, look)
        }
      })

      const statusReport = uniqueLookIds.map((id) => ({
        id,
        look: lookMap.get(id),
      }))

      const readyLooks = statusReport
        .map((entry) => entry.look)
        .filter((look): look is PhotoAvatarLook => isLookReadyForTraining(look))

      const pendingLooks = statusReport.filter(
        (entry) => !isLookReadyForTraining(entry.look)
      )

      console.log(
        `[Looks Monitor] group ${groupId}: ${readyLooks.length}/${uniqueLookIds.length} ready (need ${minReadyLooks}).`
      )

      if (pendingLooks.length > 0) {
        console.log(
          '[Looks Monitor] Pending looks:',
          pendingLooks.map((entry) => ({
            id: entry.id,
            status: entry.look?.status || 'missing',
            reason:
              entry.look?.upscale_availability?.reason ||
              (entry.look ? null : 'not_returned_yet'),
          }))
        )
      }

      if (readyLooks.length >= minReadyLooks) {
        console.log('[Looks Monitor] ✅ Looks upload completed.')
        return { readyLooks, snapshot }
      }
    } catch (err: any) {
      lastError = err
      console.warn(
        '[Looks Monitor] Failed to fetch avatar group looks (will retry):',
        err.response?.data || err.message
      )
    }

    await sleep(pollInterval)
  }

  const waitedSeconds = Math.round((Date.now() - startTime) / 1000)
  const timeoutMessage =
    `Looks did not finish uploading within ${waitedSeconds} seconds for group ${groupId}. ` +
    'Please wait a bit longer and try again.'

  throw new Error(
    timeoutMessage + (lastError ? ` Last error: ${lastError.message}` : '')
  )
}

/**
 * Gesture definition for HeyGen API
 * Used to specify gestures at specific times during video playback
 * 
 * Supported gesture types (varies by avatar):
 * - open_hand: Open hand gesture (friendly, welcoming)
 * - point_right: Point to the right
 * - point_left: Point to the left
 * - emphasis: Emphasis gesture (for important points)
 * - wave: Waving gesture
 * - thumbs_up: Thumbs up gesture
 * 
 * Note: Gesture support depends on avatar type:
 * - Hyper-Realistic Avatars (video-based): Full gesture control
 *   These avatars are created from video footage and support the full range of gestures.
 *   To create a Hyper-Realistic avatar, upload video footage with natural movements.
 *   See: https://help.heygen.com/en/articles/11691624-how-to-use-gesture-control
 * 
 * - Avatar IV: Limited gesture support via custom_motion_prompt
 *   Avatar IV avatars are generated from photos and support enhanced expressions
 *   and head movement, but not the gestures array. Use custom_motion_prompt instead.
 *   See: https://docs.heygen.com/docs/create-avatar-iv-videos
 * 
 * - Photo Avatars: Limited to facial expressions and head movement
 *   Photo avatars (talking_photo) primarily support lip-sync with basic head movement.
 *   Use custom_motion_prompt for enhanced expressions.
 * 
 * How to extend gesture types:
 * 1. Check HeyGen API documentation for supported gesture types for your avatar
 * 2. Add new gesture types to the buildGestureArray function
 * 3. Ensure the avatar supports the gesture type before using it
 * 
 * How to upload/select gesture-enabled avatars:
 * 1. Hyper-Realistic Avatars: Upload video footage with natural gestures during avatar creation
 * 2. Avatar IV: Generate from high-quality photos - motion is controlled via custom_motion_prompt
 * 3. Check avatar capabilities using detectAvatarCapabilities() before generating videos
 */
export interface GestureDefinition {
  time: number // Time in seconds when gesture should occur
  type: string // Gesture type (e.g., 'open_hand', 'point_right', 'emphasis')
}

/**
 * Avatar capabilities detected from HeyGen API
 * Determines which motion features are supported by the avatar
 */
export interface AvatarCapabilities {
  /**
   * Hyper-Realistic Avatar mode
   * Avatars created from video footage support full gesture control
   */
  supportsHyperRealistic: boolean
  
  /**
   * Gesture Control support
   * Can use gestures array in video_inputs
   */
  supportsGestureControl: boolean
  
  /**
   * Full-body movement support
   * Avatar can perform full-body gestures and movements
   */
  supportsFullBodyMovement: boolean
  
  /**
   * Custom motion prompts (Avatar IV)
   * Can use custom_motion_prompt parameter
   */
  supportsCustomMotionPrompt: boolean
  
  /**
   * Enhanced expressions
   * Avatar supports enhanced facial expressions
   */
  supportsEnhancedExpressions: boolean
  
  /**
   * Natural head movement
   * Avatar supports natural head movements (most avatars support this)
   */
  supportsHeadMovement: boolean
}

/**
 * Motion configuration for video generation
 * Specifies how the avatar should move and express during the video
 * 
 * Usage:
 * 1. For Hyper-Realistic Avatars: Use gestures array for precise gesture control
 * 2. For Avatar IV: Use customMotionPrompt with enhanceCustomMotionPrompt: true
 * 3. For Photo Avatars: Use customMotionPrompt for enhanced expressions
 * 
 * The system automatically detects avatar capabilities and applies the appropriate
 * motion features. You can also provide a custom MotionConfig to override defaults.
 */
export interface MotionConfig {
  /**
   * Array of gestures to perform at specific times
   * Only used if avatar supports gesture control (Hyper-Realistic Avatars)
   * 
   * Example:
   * [
   *   { time: 0.5, type: 'open_hand' },
   *   { time: 2.0, type: 'point_right' },
   *   { time: 4.0, type: 'emphasis' }
   * ]
   */
  gestures?: GestureDefinition[]
  
  /**
   * Custom motion prompt for Avatar IV or fallback
   * Describes desired movements and expressions in natural language
   * 
   * Examples:
   * - "Natural head movement with friendly expressions and engaging gestures"
   * - "Enhanced facial expressions with subtle head movements"
   * - "Avatar waves with a friendly smile"
   */
  customMotionPrompt?: string
  
  /**
   * Enable AI enhancement of custom motion prompt
   * Allows HeyGen to refine the motion description for better results
   * Recommended for Avatar IV and Photo Avatars
   */
  enhanceCustomMotionPrompt?: boolean
  
  /**
   * Enable natural head movement
   * Most avatars support this automatically
   * This is typically enabled by default for supported avatars
   */
  enableHeadMovement?: boolean
  
  /**
   * Enable enhanced expressions
   * More varied and natural facial expressions
   * This is typically enabled by default for supported avatars
   */
  enableEnhancedExpressions?: boolean
}

/**
 * ============================================================================
 * HEYGEN AVATAR MOTION ENHANCEMENT
 * ============================================================================
 * 
 * This section implements dynamic avatar motion features for HeyGen videos,
 * transforming basic lip-sync videos into expressive, dynamic content.
 * 
 * KEY FEATURES:
 * 1. Automatic Avatar Capability Detection
 *    - Detects which motion features are supported by the avatar
 *    - Supports Hyper-Realistic Avatars, Avatar IV, and Photo Avatars
 * 
 * 2. Gesture Control (for Hyper-Realistic Avatars)
 *    - Precise gesture timing with gestures array
 *    - Supports: open_hand, point_right, point_left, emphasis, wave, thumbs_up
 * 
 * 3. Custom Motion Prompts (for Avatar IV and Photo Avatars)
 *    - Natural language descriptions of desired movements
 *    - AI-enhanced motion refinement
 * 
 * 4. Automatic Fallback Strategy
 *    - Falls back to custom_motion_prompt if gestures not supported
 *    - Ensures all avatars get enhanced expressions and head movement
 * 
 * USAGE:
 * - Motion features are automatically enabled for all video generation
 * - The system detects avatar capabilities and applies appropriate features
 * - Works with both regular video generation and template-based generation
 * 
 * AVATAR SUPPORT:
 * - Hyper-Realistic Avatars: Full gesture control + head movement + expressions
 * - Avatar IV: Custom motion prompts + head movement + expressions
 * - Photo Avatars: Custom motion prompts + basic head movement + expressions
 * 
 * For more information, see:
 * - Gesture Control: https://help.heygen.com/en/articles/11691624-how-to-use-gesture-control
 * - Avatar IV: https://docs.heygen.com/docs/create-avatar-iv-videos
 * ============================================================================
 */

export interface GenerateVideoRequest {
  topic: string
  script?: string
  style: 'casual' | 'professional' | 'energetic' | 'educational'
  duration: number
  avatar_id?: string
  talking_photo_id?: string // For photo avatars
  template_id?: string
  output_resolution?: string
  aspect_ratio?: string // e.g., "9:16" for vertical videos (Reels/TikTok)
  dimension?: HeyGenDimensionInput
  force_vertical?: boolean
  motion_config?: MotionConfig // Optional motion configuration
}

export interface GenerateTemplateVideoRequest {
  template_id: string
  variables: Record<string, string | Record<string, any>>
  title?: string
  caption?: boolean | Record<string, any>
  include_gif?: boolean
  enable_sharing?: boolean
  callback_url?: string
  dimension?: HeyGenDimensionInput
  overrides?: Record<string, any>
  /**
   * Motion configuration for template videos
   * Motion features are applied via nodes_override in the overrides parameter
   */
  motion_config?: MotionConfig
}

export interface HeyGenVideoResponse {
  video_id: string
  status: string
  video_url?: string
  error?: string
}

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  avatar_url?: string
  gender?: string
  preview_url?: string
  thumbnail_url?: string
  status?: string
  is_public?: boolean // Indicates if this is a public/shared avatar
  group_id?: string // For photo avatars
  group_name?: string // For photo avatars
  categories?: string[]
}

export interface HeyGenAvatarsResponse {
  avatars: HeyGenAvatar[]
}

// Cache default voice id to avoid extra API calls
let cachedDefaultHeygenVoiceId: string | null = null

async function getDefaultHeygenVoiceId(): Promise<string> {
  if (cachedDefaultHeygenVoiceId) return cachedDefaultHeygenVoiceId

  const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
  const apiKey = getHeyGenKey()

  const endpoints = [
    {
      type: 'v2-voices',
      method: 'GET' as const,
      url: `${HEYGEN_V2_API_URL}/voices`,
      useXApiKey: true,
    },
    {
      type: 'v2-voice-list',
      method: 'GET' as const,
      url: `${HEYGEN_V2_API_URL}/voice.list`,
      useXApiKey: true,
    },
    {
      type: 'v1-list',
      method: 'POST' as const,
      url: `${HEYGEN_API_URL}/voice.list`,
      useXApiKey: false,
    },
    {
      type: 'v1-voices',
      method: 'GET' as const,
      url: `${HEYGEN_API_URL}/voices`,
      useXApiKey: false,
    },
  ]

  let lastError: any = null

  const extractVoices = (data: any): any[] => {
    if (!data) return []
    if (Array.isArray(data)) return data
    // Handle v2 API response: { error: null, data: { voices: [...] } }
    if (Array.isArray(data?.data?.voices)) return data.data.voices
    if (Array.isArray(data?.data?.voice_list)) return data.data.voice_list
    if (Array.isArray(data?.data)) return data.data
    if (Array.isArray(data?.voices)) return data.voices
    if (Array.isArray(data?.voice_list)) return data.voice_list
    return []
  }

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (endpoint.useXApiKey) {
        headers['X-Api-Key'] = apiKey
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const requestConfig = {
        headers,
        timeout: 15000,
      }

      const response =
        endpoint.method === 'POST'
          ? await axios.post(endpoint.url, {}, requestConfig)
          : await axios.get(endpoint.url, requestConfig)

      const voices = extractVoices(response.data)
      if (Array.isArray(voices) && voices.length > 0) {
        const preferred =
          voices.find((v: any) => {
            const locale = String(v?.locale || v?.language || '').toLowerCase()
            return locale.startsWith('en') || locale.includes('english')
          }) || voices[0]

        // Extract voice_id - v2 API uses 'voice_id', v1 may use 'id' or 'voice_id'
        const vid = preferred?.voice_id || preferred?.id || preferred?.voiceId
        if (vid) {
          cachedDefaultHeygenVoiceId = String(vid)
          console.log(`[HeyGen] Using default voice ${cachedDefaultHeygenVoiceId} from ${endpoint.type}`)
          return cachedDefaultHeygenVoiceId
        }
      }

      console.warn(`[HeyGen] ${endpoint.type} returned no voices. Response keys:`, Object.keys(response.data || {}))
    } catch (err: any) {
      lastError = err
      console.warn(
        `[HeyGen] Failed to fetch voices from ${endpoint.url} (${endpoint.type}):`,
        err.response?.data || err.message
      )
    }
  }

  console.error('[HeyGen] Failed to fetch default voice list from all endpoints', {
    lastError: lastError?.response?.data || lastError?.message,
    status: lastError?.response?.status,
  })

  throw new Error(
    'Unable to fetch default voices from HeyGen. Please set a valid HEYGEN_VOICE_ID (see List All Voices V2).'
  )
}

/**
 * List public/shared avatars from HeyGen
 * These are pre-built avatars available to all users
 * Uses the List All Avatars (V2) API endpoint which includes HeyGen's public/studio avatars
 * Reference: https://docs.heygen.com/reference/list-avatars-v2
 */
export async function listPublicAvatars(): Promise<HeyGenAvatarsResponse> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    // Use the List All Avatars (V2) endpoint as confirmed by HeyGen support
    // This endpoint returns all available avatars including public/studio avatars
    const endpoint = `${HEYGEN_V2_API_URL}/avatars`

    const headers = {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    }

    console.log('[Public Avatars] Fetching avatars from List All Avatars (V2) endpoint...')

    const response = await axios.get(endpoint, { headers })

    console.log('[Public Avatars] Response received:', {
      status: response.status,
      hasData: !!response.data?.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
    })

    // Handle different response structures
    let avatars: any[] = []
    if (response.data?.data?.avatars && Array.isArray(response.data.data.avatars)) {
      avatars = response.data.data.avatars
    } else if (response.data?.data?.avatar_list && Array.isArray(response.data.data.avatar_list)) {
      avatars = response.data.data.avatar_list
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      avatars = response.data.data
    } else if (response.data?.avatars && Array.isArray(response.data.avatars)) {
      avatars = response.data.avatars
    } else if (Array.isArray(response.data)) {
      avatars = response.data
    }

    if (avatars.length > 0) {
      console.log(`[Public Avatars] Raw response: ${avatars.length} items from List All Avatars (V2)`)
      
      // Filter to only show actual avatar groups, not individual looks
      // The /v2/avatars endpoint returns both avatar groups AND individual looks
      // We want to show only avatar groups (which have multiple looks)
      // Looks are typically part of a group and have a group_id, but we want the group itself
      // Strategy: Group by base name and only show groups with multiple variants
      const avatarGroups = new Map<string, any[]>()
      for (const avatar of avatars) {
        const name = avatar.avatar_name || avatar.name || ''
        if (!name) continue
        
        // Extract base name (e.g., "Silvia" from "Silvia Office Front")
        const baseName = name.split('(')[0].split('-')[0].trim().split(' ')[0]
        if (!baseName) continue
        
        const key = baseName.toLowerCase()
        if (!avatarGroups.has(key)) {
          avatarGroups.set(key, [])
        }
        avatarGroups.get(key)!.push(avatar)
      }
      
      // Only include groups that have multiple variants (actual avatar groups, not single looks)
      // Or include all if we can't determine (some avatars might be standalone)
      const filteredAvatars: any[] = []
      for (const [baseName, variants] of avatarGroups.entries()) {
        // If group has multiple variants, it's a real avatar group - include all variants
        // If it has only one, it might be a standalone avatar - include it too
        filteredAvatars.push(...variants)
      }
      
      console.log(`[Public Avatars] Filtered to ${filteredAvatars.length} avatars in ${avatarGroups.size} groups`)
      
      // Normalize avatar data structure
      // Note: The endpoint returns all avatars (user's own + public), but we mark them all as potentially public
      // In practice, users can use any avatar ID from this list in video generation
      const normalizedAvatars = filteredAvatars.map((avatar: any) => {
        // Try to find the best image URL from multiple possible fields.
        // According to docs, public avatars expose `preview_image_url`.
        const imageUrl =
          avatar.preview_image_url ||
          avatar.image_url ||
          avatar.avatar_url ||
          avatar.preview_url ||
          avatar.thumbnail_url ||
          avatar.portrait_url ||
          avatar.cover_url ||
          avatar.url

        // Extract tags from HeyGen API (tags field is the primary source per docs)
        // Reference: https://docs.heygen.com/reference/list-avatars-v2
        let categories: string[] = []
        if (Array.isArray(avatar.tags)) {
          // Tags is the primary field according to HeyGen docs
          categories = avatar.tags.map((c: any) => String(c))
        } else if (Array.isArray(avatar.categories)) {
          categories = avatar.categories.map((c: any) => String(c))
        } else if (Array.isArray(avatar.labels)) {
          categories = avatar.labels.map((c: any) => String(c))
        }

        return {
          avatar_id: avatar.avatar_id || avatar.id || avatar.avatarId,
          avatar_name: avatar.avatar_name || avatar.name || avatar.avatarName || 'Unnamed Avatar',
          // Main URL we store should be the preview-style image if available
          avatar_url: imageUrl || avatar.avatar_url || avatar.url || avatar.avatarUrl,
          preview_url:
            avatar.preview_image_url ||
            avatar.preview_url ||
            avatar.previewUrl ||
            avatar.preview ||
            imageUrl,
          thumbnail_url:
            avatar.thumbnail_url ||
            avatar.thumbnailUrl ||
            avatar.thumbnail ||
            imageUrl,
          gender: avatar.gender,
          status: avatar.status || 'active',
          is_public: avatar.is_public !== undefined ? avatar.is_public : true, // Mark as public if field exists, otherwise assume public
          categories, // Tags/categories for filtering
          tags: categories, // Also expose as tags for frontend convenience
          // Additional fields that might be present
          type: avatar.type,
          premium: avatar.premium,
          preview_video_url: avatar.preview_video_url,
          default_voice_id: avatar.default_voice_id,
          created_at: avatar.created_at,
        }
      })

      return { avatars: normalizedAvatars }
    }

    console.warn('[Public Avatars] No avatars found in response')
    return { avatars: [] }
  } catch (error: any) {
    console.error('[Public Avatars] Error fetching public avatars:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })
    // Return empty list instead of throwing - public avatars are optional
    return { avatars: [] }
  }
}

/**
 * List available avatars from HeyGen (user's own avatars)
 */
export async function listAvatars(): Promise<HeyGenAvatarsResponse> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    // Try v2 API first (photo avatars) - based on official docs
    // https://docs.heygen.com/docs/create-videos-with-photo-avatars
    const endpoints = [
      // v2 API - List avatar groups, then get avatars from each group
      {
        type: 'v2-groups',
        method: 'GET' as const,
        url: `${HEYGEN_V2_API_URL}/avatar_group.list`,
        useXApiKey: true,
      },
      // Fallback to v1 API endpoints
      {
        type: 'v1-list',
        method: 'POST' as const,
        url: `${HEYGEN_API_URL}/avatar.list`,
        useXApiKey: false,
      },
      {
        type: 'v1-get',
        method: 'GET' as const,
        url: `${HEYGEN_API_URL}/avatars`,
        useXApiKey: false,
      },
    ]

    let lastError: any = null
    for (const endpoint of endpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // Use X-Api-Key header for v2 API, Bearer for v1
        if (endpoint.useXApiKey) {
          headers['X-Api-Key'] = apiKey
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`
        }

        const requestConfig = { headers }

        const response = endpoint.method === 'POST'
          ? await axios.post(endpoint.url, {}, requestConfig)
          : await axios.get(endpoint.url, requestConfig)

        console.log(`HeyGen API response from ${endpoint.url} (${endpoint.type}):`, {
          status: response.status,
          dataKeys: response.data ? Object.keys(response.data) : [],
          hasData: !!response.data?.data,
          hasAvatarGroupList: !!response.data?.data?.avatar_group_list,
        })

        // Handle v2 API response structure (avatar groups)
        if (endpoint.type === 'v2-groups' && response.data?.data?.avatar_group_list) {
          const groups = response.data.data.avatar_group_list
          console.log(`Found ${groups.length} avatar groups`)

          // Fetch avatars from each group
          const allAvatars: any[] = []
          for (const group of groups) {
            try {
              const avatarsResponse = await axios.get(
                `${HEYGEN_V2_API_URL}/avatar_group/${group.id}/avatars`,
                { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } }
              )

              if (avatarsResponse.data?.data?.avatar_list) {
                const groupAvatars = avatarsResponse.data.data.avatar_list.map((avatar: any) => ({
                  avatar_id: avatar.id,
                  avatar_name: avatar.name || group.name || 'Unnamed Avatar',
                  avatar_url: avatar.image_url,
                  preview_url: avatar.image_url,
                  thumbnail_url: avatar.image_url,
                  gender: null,
                  status: avatar.status === 'completed' ? 'active' : avatar.status || 'active',
                  group_id: group.id,
                  group_name: group.name,
                }))
                allAvatars.push(...groupAvatars)
              }
            } catch (groupErr: any) {
              console.log(`Failed to fetch avatars from group ${group.id}:`, groupErr.response?.status)
            }
          }

          if (allAvatars.length > 0) {
            console.log(`Successfully fetched ${allAvatars.length} avatars from v2 API`)
            return { avatars: allAvatars }
          }
        }

        // Handle v1 API response structures
        let avatars: any[] = []

        if (response.data?.data?.avatars && Array.isArray(response.data.data.avatars)) {
          avatars = response.data.data.avatars
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          avatars = response.data.data
        } else if (response.data?.avatars && Array.isArray(response.data.avatars)) {
          avatars = response.data.avatars
        } else if (Array.isArray(response.data)) {
          avatars = response.data
        }

        if (avatars.length > 0) {
          console.log(`Successfully fetched ${avatars.length} avatars from ${endpoint.url} (${endpoint.type})`)
          // Normalize avatar data structure
          const normalizedAvatars = avatars.map((avatar: any) => ({
            avatar_id: avatar.avatar_id || avatar.id || avatar.avatarId,
            avatar_name: avatar.avatar_name || avatar.name || avatar.avatarName || 'Unnamed Avatar',
            avatar_url: avatar.avatar_url || avatar.url || avatar.avatarUrl || avatar.image_url,
            preview_url: avatar.preview_url || avatar.previewUrl || avatar.preview || avatar.image_url,
            thumbnail_url: avatar.thumbnail_url || avatar.thumbnailUrl || avatar.thumbnail || avatar.image_url,
            gender: avatar.gender,
            status: avatar.status || 'active',
          }))
          return { avatars: normalizedAvatars }
        }

        // Log unexpected structure for debugging
        console.log(`Unexpected response structure from ${endpoint.url}:`, JSON.stringify(response.data, null, 2).substring(0, 500))
      } catch (err: any) {
        // Log but continue trying other endpoints
        console.log(`Tried ${endpoint.url} (${endpoint.type}), got status ${err.response?.status}:`, err.response?.data || err.message)
        lastError = err
      }
    }

    // If we get here, all endpoints failed
    console.error('HeyGen API error (listAvatars): All endpoints failed', {
      lastError: lastError?.response?.data || lastError?.message,
      status: lastError?.response?.status,
      statusText: lastError?.response?.statusText,
    })

    throw new Error(
      lastError?.response?.data?.message ||
      lastError?.response?.data?.error?.message ||
      lastError?.message ||
      'Failed to list avatars. Please check your HeyGen API key and endpoint. The API may require a different endpoint format.'
    )
  } catch (error: any) {
    console.error('HeyGen API error (listAvatars):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Get avatar details by ID
 */
export async function getAvatar(avatarId: string): Promise<HeyGenAvatar> {
  try {
    const response = await axios.get(
      `${HEYGEN_API_URL}/avatar/${avatarId}`,
      {
        headers: {
          'Authorization': `Bearer ${getHeyGenKey()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Handle different response structures
    if (response.data.data) {
      return response.data.data
    }
    return response.data
  } catch (error: any) {
    console.error('HeyGen API error (getAvatar):', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get avatar'
    )
  }
}

/**
 * Detect avatar capabilities by checking avatar metadata
 * 
 * Determines which motion features are supported:
 * - Hyper-Realistic Avatars: Created from video footage, support full gesture control
 * - Avatar IV: Generated from photos, support custom motion prompts
 * - Photo Avatars: Limited to lip-sync with basic head movement
 * 
 * @param avatarId - The avatar ID to check
 * @param isPhotoAvatar - Whether this is a photo avatar (talking_photo)
 * @returns AvatarCapabilities object with boolean flags for each capability
 * 
 * @example
 * ```typescript
 * const capabilities = await detectAvatarCapabilities('avatar_123', false)
 * if (capabilities.supportsGestureControl) {
 *   // Use gestures array
 * } else if (capabilities.supportsCustomMotionPrompt) {
 *   // Use custom_motion_prompt
 * }
 * ```
 */
export async function detectAvatarCapabilities(
  avatarId: string,
  isPhotoAvatar: boolean = false
): Promise<AvatarCapabilities> {
  try {
    // For photo avatars, check photo avatar details
    if (isPhotoAvatar) {
      try {
        const photoDetails = await getPhotoAvatarDetails(avatarId)
        // Photo avatars typically have limited motion support
        // They support basic head movement and expressions, but not full gestures
        return {
          supportsHyperRealistic: false,
          supportsGestureControl: false, // Photo avatars don't support gesture control
          supportsFullBodyMovement: false,
          supportsCustomMotionPrompt: true, // Can use custom_motion_prompt for expressions
          supportsEnhancedExpressions: true,
          supportsHeadMovement: true, // Most photo avatars support head movement
        }
      } catch (error: any) {
        console.warn('[Avatar Detection] Could not fetch photo avatar details, using defaults:', error.message)
        // Fallback: assume limited capabilities for photo avatars
        return {
          supportsHyperRealistic: false,
          supportsGestureControl: false,
          supportsFullBodyMovement: false,
          supportsCustomMotionPrompt: true,
          supportsEnhancedExpressions: true,
          supportsHeadMovement: true,
        }
      }
    }

    // For regular avatars, try to fetch avatar details
    try {
      const avatar = await getAvatar(avatarId)
      
      // Check avatar metadata for capabilities
      // HeyGen may expose avatar type in various fields
      const avatarType = (avatar as any).type || (avatar as any).avatar_type || ''
      const avatarStatus = avatar.status || ''
      const avatarName = avatar.avatar_name || ''
      
      // Heuristics to detect avatar capabilities:
      // 1. Hyper-Realistic avatars are typically created from video footage
      //    They may have specific status or type indicators
      // 2. Avatar IV avatars are generated from photos and support custom motion prompts
      // 3. Regular avatars have basic lip-sync with limited motion
      
      const isHyperRealistic = 
        avatarType.toLowerCase().includes('hyper') ||
        avatarType.toLowerCase().includes('realistic') ||
        avatarType.toLowerCase().includes('video') ||
        avatarStatus.toLowerCase().includes('hyper')
      
      const isAvatarIV = 
        avatarType.toLowerCase().includes('iv') ||
        avatarType.toLowerCase().includes('avatar_iv') ||
        avatarName.toLowerCase().includes('avatar iv')
      
      // Hyper-Realistic avatars support full gesture control
      if (isHyperRealistic) {
        return {
          supportsHyperRealistic: true,
          supportsGestureControl: true,
          supportsFullBodyMovement: true,
          supportsCustomMotionPrompt: true,
          supportsEnhancedExpressions: true,
          supportsHeadMovement: true,
        }
      }
      
      // Avatar IV supports custom motion prompts and enhanced expressions
      if (isAvatarIV) {
        return {
          supportsHyperRealistic: false,
          supportsGestureControl: false, // Avatar IV doesn't support gesture array
          supportsFullBodyMovement: false,
          supportsCustomMotionPrompt: true,
          supportsEnhancedExpressions: true,
          supportsHeadMovement: true,
        }
      }
      
      // Default: assume basic capabilities (head movement, expressions)
      // Most avatars support at least basic head movement
      return {
        supportsHyperRealistic: false,
        supportsGestureControl: false,
        supportsFullBodyMovement: false,
        supportsCustomMotionPrompt: true, // Can try custom_motion_prompt as fallback
        supportsEnhancedExpressions: true,
        supportsHeadMovement: true,
      }
    } catch (error: any) {
      console.warn('[Avatar Detection] Could not fetch avatar details, using conservative defaults:', error.message)
      // Conservative fallback: assume basic capabilities only
      return {
        supportsHyperRealistic: false,
        supportsGestureControl: false,
        supportsFullBodyMovement: false,
        supportsCustomMotionPrompt: true,
        supportsEnhancedExpressions: true,
        supportsHeadMovement: true,
      }
    }
  } catch (error: any) {
    console.error('[Avatar Detection] Error detecting capabilities:', error.message)
    // Return conservative defaults on any error
    return {
      supportsHyperRealistic: false,
      supportsGestureControl: false,
      supportsFullBodyMovement: false,
      supportsCustomMotionPrompt: true,
      supportsEnhancedExpressions: true,
      supportsHeadMovement: true,
    }
  }
}

/**
 * Build gesture array based on script duration
 * 
 * Generates a placeholder gesture structure with timing based on video duration.
 * Gestures are spaced throughout the video to add natural movement.
 * 
 * @param script - The script text (used to estimate timing)
 * @param duration - Video duration in seconds
 * @returns Array of gesture definitions with timing
 * 
 * @example
 * ```typescript
 * const gestures = buildGestureArray('Hello, welcome to our presentation.', 10)
 * // Returns: [
 * //   { time: 0.5, type: 'open_hand' },
 * //   { time: 2.0, type: 'point_right' },
 * //   { time: 4.0, type: 'emphasis' }
 * // ]
 * ```
 * 
 * Supported gesture types:
 * - open_hand: Open hand gesture (friendly, welcoming)
 * - point_right: Point to the right
 * - point_left: Point to the left
 * - emphasis: Emphasis gesture (for important points)
 * - wave: Waving gesture
 * - thumbs_up: Thumbs up gesture
 * 
 * Note: Gesture types must be supported by the avatar.
 * Hyper-Realistic avatars support the full range of gestures.
 */
export function buildGestureArray(script: string, duration: number): GestureDefinition[] {
  // Enhanced gesture sequence for maximum movement and hand gestures
  // More frequent gestures create more natural, engaging movement
  const gestures: Array<{ time: number; type: string }> = []
  
  // Calculate gesture interval based on duration (aim for gesture every 2-3 seconds)
  const gestureInterval = Math.max(2.0, duration / Math.max(3, Math.floor(duration / 2.5)))
  
  // Generate gestures throughout the video for continuous movement
  const gestureTypes = ['open_hand', 'point_right', 'emphasis', 'wave', 'point_left', 'thumbs_up']
  let currentTime = 0.5 // Start early
  
  while (currentTime < duration - 0.5) {
    // Rotate through gesture types for variety
    const gestureType = gestureTypes[gestures.length % gestureTypes.length]
    gestures.push({ time: currentTime, type: gestureType })
    
    // Move to next gesture time
    currentTime += gestureInterval
    
    // Add some variation to timing (±0.3 seconds) for more natural feel
    currentTime += (Math.random() * 0.6 - 0.3)
  }
  
  // Ensure we have at least a few gestures even for short videos
  if (gestures.length < 2 && duration >= 1) {
    gestures.push({ time: Math.min(0.5, duration * 0.1), type: 'open_hand' })
    if (duration >= 2) {
      gestures.push({ time: Math.min(duration * 0.5, duration - 0.5), type: 'emphasis' })
    }
  }
  
  // Sort by time and ensure gestures don't exceed duration
  return gestures
    .filter(g => g.time < duration && g.time >= 0)
    .sort((a, b) => a.time - b.time)
    .slice(0, 10) // Limit to 10 gestures max to avoid overwhelming the API
}

export async function generateVideo(
  request: GenerateVideoRequest
): Promise<HeyGenVideoResponse> {
  try {
    const apiKey = getHeyGenKey()
    const outputResolution =
      request.output_resolution && request.output_resolution.trim().length > 0
        ? request.output_resolution.trim()
        : DEFAULT_HEYGEN_RESOLUTION
    const requirePortrait = !!request.force_vertical || request.aspect_ratio === '9:16'

    // Detect avatar capabilities for motion features
    let avatarCapabilities: AvatarCapabilities | null = null
    let motionConfig: MotionConfig | null = null
    
    if (request.motion_config || (request.avatar_id || request.talking_photo_id)) {
      try {
        const avatarId = request.avatar_id || request.talking_photo_id
        const isPhotoAvatar = !!request.talking_photo_id
        
        if (avatarId) {
          avatarCapabilities = await detectAvatarCapabilities(avatarId, isPhotoAvatar)
          
          // Build motion config if not provided
          if (!request.motion_config) {
            // Auto-generate motion config based on capabilities
            const gestures = avatarCapabilities.supportsGestureControl
              ? buildGestureArray(request.script || request.topic, request.duration)
              : undefined
            
            motionConfig = {
              gestures,
              customMotionPrompt: avatarCapabilities.supportsCustomMotionPrompt
                ? 'Natural head movement with friendly expressions and engaging gestures'
                : undefined,
              enhanceCustomMotionPrompt: avatarCapabilities.supportsCustomMotionPrompt,
              enableHeadMovement: avatarCapabilities.supportsHeadMovement,
              enableEnhancedExpressions: avatarCapabilities.supportsEnhancedExpressions,
            }
          } else {
            motionConfig = request.motion_config
          }
          
          console.log('[HeyGen Motion] Avatar capabilities detected:', {
            avatarId,
            isPhotoAvatar,
            capabilities: avatarCapabilities,
            motionConfig: motionConfig ? {
              hasGestures: !!motionConfig.gestures,
              gestureCount: motionConfig.gestures?.length || 0,
              hasCustomMotionPrompt: !!motionConfig.customMotionPrompt,
            } : null,
          })
        }
      } catch (capabilityError: any) {
        console.warn('[HeyGen Motion] Could not detect avatar capabilities, proceeding without motion features:', capabilityError.message)
        // Continue without motion features if detection fails
      }
    }

    // Always use v2 API - https://docs.heygen.com/reference/create-an-avatar-video-v2
    // Build payload with video_inputs array format
    const payload: any = {
      video_inputs: [
        {
          character: {},
        },
      ],
    }

    const ensurePortraitConfig = () => {
      if (!requirePortrait) return
      if (!payload.video_config) {
        payload.video_config = {}
      }
      payload.video_config.aspect_ratio = '9:16'
      payload.video_config.fit = payload.video_config.fit || 'cover'
    }

    // Voice is required by HeyGen v2 schema under voice.text.voice_id
    // Use env voice if provided, otherwise fetch a default HeyGen voice id
    let envVoiceId = process.env.HEYGEN_VOICE_ID?.trim()
    if (!envVoiceId) {
      envVoiceId = await getDefaultHeygenVoiceId()
    }
    // Provide both the current and legacy fields to satisfy different validators:
    // - voice.text.voice_id + voice.text.text (current)
    // - voice.voice_id + voice.input_text (legacy-compatible)
    payload.video_inputs[0].voice = {
      type: 'text',
      input_text: request.script || request.topic,
      voice_id: envVoiceId,
      text: {
        voice_id: envVoiceId,
        text: request.script || request.topic,
      },
    }

    // Build video_config - Use aspect_ratio for vertical videos (9:16 for Instagram Reels/TikTok)
    // According to docs: https://docs.heygen.com/reference/create-an-avatar-video-v2
    // For vertical videos, use aspect_ratio: "9:16" in video_config
    const requestDimension = sanitizeDimensionInput(request.dimension)
    const resolutionDimension = parseResolutionToDimension(outputResolution)
    const resolutionLooksPortrait = !!resolutionDimension && resolutionDimension.height > resolutionDimension.width
    const isVerticalFormat =
      resolutionLooksPortrait ||
      outputResolution.toLowerCase().includes('vertical') ||
      request.aspect_ratio === '9:16'

    // Initialize video_config if needed
    if (!payload.video_config) {
      payload.video_config = {}
    }

    if (isVerticalFormat || request.aspect_ratio === '9:16') {
      // For vertical videos (Instagram Reels/TikTok), use ONLY aspect_ratio: "9:16"
      // Do NOT set output_resolution for vertical videos to avoid white frames on sides
      payload.video_config.aspect_ratio = '9:16'
      payload.video_config.fit = 'cover'
      const verticalResolution =
        resolutionDimension && resolutionLooksPortrait
          ? `${resolutionDimension.width}x${resolutionDimension.height}`
          : request.output_resolution?.trim() || DEFAULT_VERTICAL_OUTPUT_RESOLUTION
      payload.video_config.output_resolution = verticalResolution
      console.log(
        `[HeyGen] Setting aspect_ratio to 9:16 for vertical video (Instagram Reels/TikTok) with output_resolution ${payload.video_config.output_resolution}`
      )
    } else if (outputResolution && outputResolution !== DEFAULT_HEYGEN_RESOLUTION) {
      // For horizontal videos, use output_resolution
      payload.video_config.output_resolution = outputResolution
      console.log(`[HeyGen] Setting output_resolution for horizontal video: ${outputResolution}`)
    }

    // If aspect_ratio was explicitly provided, use it
    if (request.aspect_ratio && !isVerticalFormat) {
      payload.video_config.aspect_ratio = request.aspect_ratio
      console.log(`[HeyGen] Using explicit aspect_ratio: ${request.aspect_ratio}`)
    }

    if (requestDimension) {
      payload.video_config.dimension = formatDimensionForHeygen(requestDimension)
      console.log(
        `[HeyGen] Using explicit video dimension override: ${requestDimension.width}x${requestDimension.height}`
      )
    } else if (isVerticalFormat) {
      const chosenDimension =
        resolutionLooksPortrait && resolutionDimension
          ? resolutionDimension
          : DEFAULT_VERTICAL_DIMENSION
      payload.video_config.dimension = formatDimensionForHeygen(chosenDimension)
      console.log(
        `[HeyGen] Setting portrait dimension for vertical video: ${payload.video_config.dimension.width}x${payload.video_config.dimension.height}`
      )
    }

    ensurePortraitConfig()

    // Remove video_config if it's empty to avoid API errors
    if (Object.keys(payload.video_config).length === 0) {
      delete payload.video_config
    }

    // Log video_config details
    if (payload.video_config) {
      console.log(`[HeyGen] Video config:`, {
        output_resolution: payload.video_config.output_resolution,
        aspect_ratio: payload.video_config.aspect_ratio,
        dimension: payload.video_config.dimension,
      })
      // Mirror video_config to each video input to satisfy HeyGen's per-input schema
      payload.video_inputs = payload.video_inputs.map((input: any) => ({
        ...input,
        video_config: {
          ...(input.video_config || {}),
          ...payload.video_config,
        },
      }))
    } else {
      console.log(`[HeyGen] No video_config set - using HeyGen defaults`)
    }

    // Determine if this is a photo avatar (talking_photo) or regular avatar
    // Photo avatars use talking_photo_id, regular avatars use avatar_id in AvatarSettings
    // Note: For photo avatars, talking_photo_id should be an individual avatar ID from a group,
    // not the group ID itself. If a group_id is provided, we need to fetch the first available avatar from the group.
    if (request.talking_photo_id) {
      // Photo avatar - use TalkingPhotoSettings
      // Check if this is a group_id (photo avatar groups) or individual avatar ID
      let talkingPhotoId = request.talking_photo_id

      // If it's a group_id format (usually longer), try to fetch individual avatars from the group
      // HeyGen API requires individual avatar IDs, not group IDs for talking_photo_id
      try {
        const avatarGroupResponse = await axios.get(
          `${HEYGEN_V2_API_URL}/avatar_group/${talkingPhotoId}/avatars`,
          {
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json',
            },
          }
        )

        if (avatarGroupResponse.data?.data?.avatar_list && avatarGroupResponse.data.data.avatar_list.length > 0) {
          // Use the first available avatar from the group
          talkingPhotoId = avatarGroupResponse.data.data.avatar_list[0].id
          console.log(`Found individual avatar ID ${talkingPhotoId} from group ${request.talking_photo_id}`)
        }
      } catch (groupErr: any) {
        // If fetching from group fails, assume it's already an individual avatar ID
        console.log(`Assuming ${talkingPhotoId} is an individual avatar ID (group fetch failed: ${groupErr.response?.status || groupErr.message})`)
      }

      payload.video_inputs[0].character = {
        type: 'talking_photo',
        talking_photo_id: talkingPhotoId,
      }
    } else if (request.avatar_id) {
      // Regular avatar - use AvatarSettings
      payload.video_inputs[0].character = {
        type: 'avatar',
        avatar_id: request.avatar_id,
      }
    } else {
      throw new Error('Either avatar_id or talking_photo_id must be provided')
    }

    // Add motion features to video input based on avatar capabilities
    if (motionConfig && avatarCapabilities) {
      // Add gestures if avatar supports gesture control
      if (motionConfig.gestures && motionConfig.gestures.length > 0 && avatarCapabilities.supportsGestureControl) {
        payload.video_inputs[0].gestures = motionConfig.gestures
        console.log('[HeyGen Motion] Added gestures to video input:', {
          gestureCount: motionConfig.gestures.length,
          gestures: motionConfig.gestures,
        })
      }
      
      // Add custom motion prompt for Avatar IV or fallback
      if (motionConfig.customMotionPrompt && avatarCapabilities.supportsCustomMotionPrompt) {
        payload.video_inputs[0].custom_motion_prompt = motionConfig.customMotionPrompt
        
        if (motionConfig.enhanceCustomMotionPrompt) {
          payload.video_inputs[0].enhance_custom_motion_prompt = true
        }
        
        console.log('[HeyGen Motion] Added custom motion prompt:', {
          prompt: motionConfig.customMotionPrompt,
          enhanced: motionConfig.enhanceCustomMotionPrompt,
        })
      } else if (!avatarCapabilities.supportsGestureControl && avatarCapabilities.supportsCustomMotionPrompt) {
        // Fallback: use custom motion prompt if gestures not supported
        payload.video_inputs[0].custom_motion_prompt = 
          motionConfig.customMotionPrompt || 
          'Enhanced facial expressions with subtle head movements and natural gestures'
        payload.video_inputs[0].enhance_custom_motion_prompt = true
        
        console.log('[HeyGen Motion] Using fallback custom motion prompt (gestures not supported)')
      }
      
      // Note: Head movement and enhanced expressions are typically automatic for most avatars
      // We log them but don't need to set explicit parameters unless HeyGen API requires them
      if (motionConfig.enableHeadMovement && avatarCapabilities.supportsHeadMovement) {
        console.log('[HeyGen Motion] Head movement enabled (automatic for this avatar)')
      }
      
      if (motionConfig.enableEnhancedExpressions && avatarCapabilities.supportsEnhancedExpressions) {
        console.log('[HeyGen Motion] Enhanced expressions enabled (automatic for this avatar)')
      }
    } else if (motionConfig && !avatarCapabilities) {
      // If we have motion config but couldn't detect capabilities, use conservative fallback
      if (motionConfig.customMotionPrompt) {
        payload.video_inputs[0].custom_motion_prompt = motionConfig.customMotionPrompt
        payload.video_inputs[0].enhance_custom_motion_prompt = motionConfig.enhanceCustomMotionPrompt || true
        console.log('[HeyGen Motion] Using motion config with conservative fallback (capabilities unknown)')
      }
    }

    const requestUrl = `${HEYGEN_V2_API_URL}/video/generate`
    console.log('HeyGen v2 API request:', {
      url: requestUrl,
      hasAvatarId: !!request.avatar_id,
      hasTalkingPhotoId: !!request.talking_photo_id,
      avatarId: request.avatar_id,
      talkingPhotoId: request.talking_photo_id,
      payload: JSON.stringify(payload, null, 2),
    })

    let response
    try {
      response = await axios.post(
        requestUrl,
        payload,
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      )
    } catch (err: any) {
      const errorStatus = err?.response?.status
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error
      const errorMessageStr = typeof errorMessage === 'string' ? errorMessage : String(errorMessage || '')

      // Log the actual error for debugging
      console.error(`[HeyGen] API Error Details:`, {
        status: errorStatus,
        errorMessage: errorMessageStr,
        responseData: err.response?.data,
        videoConfig: payload.video_config,
      })

      // Check if it's a resolution/config format error or server error
      const isConfigError = (errorStatus === 400 || errorStatus >= 500) && errorMessageStr &&
        (errorMessageStr.toLowerCase().includes('output_resolution') ||
          errorMessageStr.toLowerCase().includes('dimension') ||
          errorMessageStr.toLowerCase().includes('fit') ||
          errorMessageStr.toLowerCase().includes('resolution') ||
          errorMessageStr.toLowerCase().includes('invalid') ||
          errorMessageStr.toLowerCase().includes('not supported') ||
          errorMessageStr.toLowerCase().includes('server error'))

      // If using vertical resolution and it fails, try alternative approaches
      const verticalResolutions = ['1080x1920', '720x1280', '1080p_vertical', 'vertical_1080p', '1080p']
      const isVerticalResolution = payload.video_config?.output_resolution &&
        verticalResolutions.includes(payload.video_config.output_resolution)

      // If vertical resolution causes errors, try alternative formats
      if ((isConfigError || errorStatus >= 500) && isVerticalResolution) {
        const currentRes = payload.video_config?.output_resolution
        console.warn(`[HeyGen] Vertical resolution '${currentRes}' failed, trying alternative formats...`)

        // Try alternative resolution formats (simpler approach - no dimension parameter)
        const alternativeResolutions = ['720x1280', '1080x1920', '1080p', '720p']
        const filteredResolutions = alternativeResolutions.filter(r => r !== currentRes)

        for (const altResolution of filteredResolutions) {
          try {
            console.log(`[HeyGen] Trying alternative resolution: ${altResolution}`)
            payload.video_config.output_resolution = altResolution
            // Remove any dimension/fit if they exist
            if (payload.video_config.dimension) {
              delete payload.video_config.dimension
            }
            if (payload.video_config.fit) {
              delete payload.video_config.fit
            }

            response = await axios.post(
              requestUrl,
              payload,
              {
                headers: {
                  'X-Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              }
            )
            console.log(`[HeyGen] ✅ Successfully used alternative resolution: ${altResolution}`)
            break // Success, exit retry loop
          } catch (retryErr: any) {
            console.log(`[HeyGen] Resolution ${altResolution} also failed:`, retryErr.response?.status, retryErr.response?.data?.message)
            if (altResolution === filteredResolutions[filteredResolutions.length - 1]) {
              console.warn(`[HeyGen] All vertical resolution formats failed`)
            }
          }
        }

        // If we got a successful response from alternative resolution, skip the rest of error handling
        if (response) {
          // Continue to success path below
        } else {
          // All alternatives failed, try removing only output_resolution but keep aspect_ratio
          const shouldRetryWithoutOutputResolution = !!payload.video_config?.output_resolution
          const hadAspectRatio = !!payload.video_config?.aspect_ratio
          if (shouldRetryWithoutOutputResolution && hadAspectRatio) {
            // Keep aspect_ratio but remove output_resolution that's causing issues
            console.warn(
              '[HeyGen] Output resolution failed, retrying with aspect_ratio only:',
              {
                error: err.response?.data,
                errorStatus: err.response?.status,
                errorMessage: errorMessageStr,
                aspectRatio: payload.video_config?.aspect_ratio,
                outputResolution: payload.video_config?.output_resolution,
              }
            )
            // Remove output_resolution but keep aspect_ratio
            delete payload.video_config.output_resolution
            // Ensure aspect_ratio is still set
            ensurePortraitConfig()
            if (!payload.video_config.aspect_ratio) {
              payload.video_config.aspect_ratio = '9:16'
            }
            response = await axios.post(
              requestUrl,
              payload,
              {
                headers: {
                  'X-Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              }
            )
            console.log(`[HeyGen] ✅ Successfully generated video with aspect_ratio only (no output_resolution)`)
          } else if (shouldRetryWithoutOutputResolution) {
            // No aspect_ratio, try removing output_resolution only
            delete payload.video_config.output_resolution
            ensurePortraitConfig()
            if (!requirePortrait && Object.keys(payload.video_config).length === 0) {
              delete payload.video_config
            }
            response = await axios.post(
              requestUrl,
              payload,
              {
                headers: {
                  'X-Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              }
            )
          } else {
            throw err
          }
        }
      } else {
        // Original retry logic for non-resolution/config errors
        const shouldRetryWithoutConfig =
          !!payload.video_config &&
          errorStatus === 400 &&
          errorMessageStr &&
          (errorMessageStr.toLowerCase().includes('output_resolution') ||
            errorMessageStr.toLowerCase().includes('video_config') ||
            errorMessageStr.toLowerCase().includes('resolution') ||
            errorMessageStr.toLowerCase().includes('aspect') ||
            errorMessageStr.toLowerCase().includes('ratio'))

        if (shouldRetryWithoutConfig) {
          const hadAspectRatio = !!payload.video_config?.aspect_ratio
          const hadDimension = !!payload.video_config?.dimension
          const hadOutputResolution = !!payload.video_config?.output_resolution

          // If we have aspect_ratio, try to preserve it and only remove problematic fields
          if (hadAspectRatio) {
            console.warn(
              '[HeyGen] Output resolution/dimension not supported, retrying with aspect_ratio only:',
              {
                error: err.response?.data,
                errorStatus: err.response?.status,
                aspectRatio: payload.video_config?.aspect_ratio,
                outputResolution: payload.video_config?.output_resolution,
                dimension: payload.video_config?.dimension,
              }
            )
            // Remove problematic fields but keep aspect_ratio
            if (payload.video_config.output_resolution) {
              delete payload.video_config.output_resolution
            }
            if (payload.video_config.dimension) {
              delete payload.video_config.dimension
            }
            if (payload.video_config.fit) {
              delete payload.video_config.fit
            }
            // Ensure aspect_ratio is still set
            ensurePortraitConfig()
            if (!payload.video_config.aspect_ratio) {
              payload.video_config.aspect_ratio = '9:16'
            }
            response = await axios.post(
              requestUrl,
              payload,
              {
                headers: {
                  'X-Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              }
            )
            console.log(`[HeyGen] ✅ Successfully generated video with aspect_ratio only`)
          } else {
            // No aspect_ratio to preserve
            console.warn(
              '[HeyGen] Output resolution/aspect_ratio/dimension not supported, retrying without video_config:',
              {
                error: err.response?.data,
                errorStatus: err.response?.status,
                hadAspectRatio,
                hadDimension,
                aspectRatio: payload.video_config?.aspect_ratio,
                dimension: payload.video_config?.dimension,
                outputResolution: payload.video_config?.output_resolution,
              }
            )
            if (requirePortrait) {
              throw new Error(
                'HeyGen could not render a vertical video with this avatar/photo. Please upload a portrait-oriented photo or switch to a template-based video.'
              )
            }
            if (hadAspectRatio) {
              console.warn(`[HeyGen] ⚠️ Aspect ratio ${payload.video_config.aspect_ratio} may not be supported by HeyGen API. Video will be generated without aspect ratio setting.`)
            }
            if (hadDimension) {
              console.warn(`[HeyGen] ⚠️ Dimension parameter may not be supported by HeyGen API. Video will be generated without dimension setting.`)
            }
            delete payload.video_config
            response = await axios.post(
              requestUrl,
              payload,
              {
                headers: {
                  'X-Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              }
            )
          }
        } else {
          // Check if error is specifically about aspect_ratio or dimension
          if (errorMessageStr.toLowerCase().includes('aspect') || errorMessageStr.toLowerCase().includes('ratio') || errorMessageStr.toLowerCase().includes('dimension')) {
            console.error(`[HeyGen] ❌ Video config error:`, {
              aspectRatio: request.aspect_ratio,
              outputResolution: outputResolution,
              error: err.response?.data,
              errorStatus: err.response?.status,
            })
          }
          throw err
        }
      }
    }

    console.log('HeyGen v2 API response:', {
      status: response.status,
      data: response.data,
    })

    // HeyGen v2 API returns: { code: 100, data: { video_id: "...", ... }, message: "Success" }
    const data = response.data?.data || response.data
    const videoId = data.video_id || data.id || data.videoId

    if (!videoId) {
      throw new Error('Failed to get video_id from HeyGen response. Response: ' + JSON.stringify(response.data))
    }

    return {
      video_id: videoId,
      status: data.status || 'pending',
      video_url: data.video_url || data.videoUrl || data.url || null,
    }
  } catch (error: any) {
    console.error('HeyGen API error (generateVideo):', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
    })

    // Extract detailed error message
    let errorMessage = 'Failed to generate video'
    // Map HeyGen error code 400116 (Voice not found) with actionable guidance
    const errorCode =
      error.response?.data?.code ||
      error.response?.data?.error_code ||
      error.response?.data?.error?.code

    if (errorCode === 400116 || /voice not found/i.test(error.response?.data?.message || '')) {
      errorMessage =
        'Voice not found. Please use a valid HEYGEN_VOICE_ID from List All Voices (V2).'
    } else if (error.response?.status === 404) {
      const avatarId = request.avatar_id || request.talking_photo_id
      errorMessage = `HeyGen API endpoint not found (404). The avatar ID "${avatarId}" may not exist or may not be accessible. Please verify the avatar ID is correct and belongs to your HeyGen account.`
    } else if (error.response?.status === 401) {
      errorMessage = 'HeyGen API authentication failed. Please check your HEYGEN_KEY environment variable.'
    } else if (error.response?.status === 429) {
      errorMessage = 'HeyGen API rate limit exceeded. Please try again later.'
    } else if (error.response?.status >= 500) {
      errorMessage = 'HeyGen API server error. Please try again later.'
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : JSON.stringify(error.response.data.error)
    } else if (error.message) {
      errorMessage = error.message
    }

    throw new Error(errorMessage)
  }
}

/**
 * Fetch template details to see available variables and nodes
 */
export async function getTemplateDetails(templateId: string): Promise<any> {
  try {
    const apiKey = getHeyGenKey()
    const endpoint = `${HEYGEN_V2_API_URL}/template/${encodeURIComponent(templateId.trim())}`
    
    const response = await axios.get(endpoint, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })
    
    return response.data?.data || response.data
  } catch (error: any) {
    console.error('Failed to fetch template details:', error?.response?.data || error?.message)
    throw error
  }
}

export async function generateVideoFromTemplate(
  request: GenerateTemplateVideoRequest
): Promise<HeyGenVideoResponse> {
  try {
    const apiKey = getHeyGenKey()

    if (!request.template_id || !request.template_id.trim()) {
      throw new Error('template_id is required for template video generation')
    }

    if (!request.variables || Object.keys(request.variables).length === 0) {
      throw new Error('At least one template variable is required for template video generation')
    }

    const formatTemplateVariables = (variables: Record<string, any>): Record<string, any> => {
      const formatted: Record<string, any> = {}
      for (const [key, rawValue] of Object.entries(variables || {})) {
        if (
          rawValue &&
          typeof rawValue === 'object' &&
          !Array.isArray(rawValue) &&
          'type' in rawValue &&
          'properties' in rawValue
        ) {
          formatted[key] = rawValue
          continue
        }
        formatted[key] = {
          name: key,
          type: 'text',
          properties: {
            content: typeof rawValue === 'string' ? rawValue : String(rawValue ?? ''),
          },
        }
      }
      return formatted
    }

    // HeyGen template API only accepts boolean for caption, not an object
    // Convert caption to boolean (default to false if not provided)
    const captionValue = typeof request.caption === 'boolean' ? request.caption : (request.caption ? true : false)

    const payload: Record<string, any> = {
      variables: formatTemplateVariables(request.variables),
      title: request.title || 'Untitled Video',
      caption: captionValue,
      include_gif: request.include_gif ?? false,
      enable_sharing: request.enable_sharing ?? false,
    }

    if (request.callback_url) {
      payload.callback_url = request.callback_url
    }

    const resolvedDimension = sanitizeDimensionInput(request.dimension)
    if (resolvedDimension) {
      payload.dimension = {
        width: resolvedDimension.width.toString(),
        height: resolvedDimension.height.toString(),
      }
    }

    if (request.overrides && Object.keys(request.overrides).length > 0) {
      payload.overrides = request.overrides
    }

    const endpoint = `${HEYGEN_V2_API_URL}/template/${encodeURIComponent(
      request.template_id.trim()
    )}/generate`

    const response = await axios.post(endpoint, payload, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    const data = response.data?.data || response.data
    const videoId = data.video_id || data.id || data.videoId

    if (!videoId) {
      throw new Error(
        'Failed to get video_id from HeyGen template response. Response: ' + JSON.stringify(response.data)
      )
    }

    return {
      video_id: videoId,
      status: data.status || 'pending',
      video_url: data.video_url || data.videoUrl || data.url || null,
    }
  } catch (error: any) {
    console.error('HeyGen API error (generateVideoFromTemplate):', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      // Note: we can't log the full payload here because it's out of scope;
      // the caller (videoService) logs the payload before calling this function.
    })

    let errorMessage = 'Failed to generate video from template'
    if (error.response?.status === 401) {
      errorMessage = 'HeyGen API authentication failed. Please check your HEYGEN_KEY.'
    } else if (error.response?.status === 404) {
      errorMessage = 'HeyGen template not found. Please verify the template ID.'
    } else if (error.response?.status === 405) {
      errorMessage =
        'HeyGen template endpoint rejected the HTTP method. Ensure you are using POST /v2/template/{template_id}/generate and that your account has template access.'
    } else if (error.response?.status === 429) {
      errorMessage = 'HeyGen API rate limit exceeded. Please try again later.'
    } else if (error.response?.status >= 500) {
      // For 500 errors, include more details about what might be wrong
      const errorData = error.response?.data
      if (errorData?.error?.code === 'internal_error') {
        errorMessage = `HeyGen API internal error: ${errorData.error.message || 'Something is wrong with the HeyGen API. Please check the payload format and template configuration.'}`
      } else {
        errorMessage = 'HeyGen API server error. Please try again later.'
      }
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.response?.data?.error) {
      errorMessage =
        typeof error.response.data.error === 'string'
          ? error.response.data.error
          : JSON.stringify(error.response.data.error)
    } else if (error.message) {
      errorMessage = error.message
    }

    throw new Error(errorMessage)
  }
}

/**
 * Upload image to HeyGen Asset Storage
 * Returns the image_key needed for avatar group creation
 * Based on HeyGen docs: https://docs.heygen.com/reference/upload-asset
 * 
 * The correct endpoint is: https://upload.heygen.com/v1/asset
 * It expects raw binary image data in the body (not multipart/form-data)
 * 
 * Note: HeyGen supports JPEG and PNG, but not WebP. WebP images will be converted to JPEG.
 */
export async function uploadImageToHeyGen(photoUrl: string): Promise<string> {
  const apiKey = getHeyGenKey()
  const HEYGEN_UPLOAD_URL = 'https://upload.heygen.com/v1/asset'

  // First, download the image from the URL to get the buffer
  let imageBuffer: Buffer
  let contentType: string = 'image/jpeg'

  try {
    if (photoUrl.startsWith('data:')) {
      // Handle base64 data URL
      const base64Data = photoUrl.split(',')[1]
      imageBuffer = Buffer.from(base64Data, 'base64')
      const mimeMatch = photoUrl.match(/data:([^;]+)/)
      if (mimeMatch) {
        contentType = mimeMatch[1]
      }
    } else {
      // Download from URL
      const imageResponse = await axios.get(photoUrl, {
        responseType: 'arraybuffer',
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
      })
      imageBuffer = Buffer.from(imageResponse.data)
      contentType = imageResponse.headers['content-type'] || 'image/jpeg'
    }
  } catch (err: any) {
    throw new Error(`Failed to download image: ${err.message}`)
  }

  // Validate and process image to meet HeyGen requirements
  // Requirements: JPG/PNG, under 50MB, less than 2K resolution (max 2048px on longest side)
  let sharp: any = null
  try {
    sharp = await import('sharp').catch(() => null)
  } catch (err) {
    // sharp not available, will handle below
  }

  // Check file size (50MB limit)
  const fileSizeMB = imageBuffer.length / (1024 * 1024)
  if (fileSizeMB > 50) {
    throw new Error(
      `Image file size (${fileSizeMB.toFixed(2)}MB) exceeds HeyGen's 50MB limit. Please compress or resize the image.`
    )
  }

  // Convert WebP to JPEG if needed (HeyGen doesn't support WebP)
  // Supported formats: JPEG, PNG
  const needsConversion = contentType === 'image/webp' || contentType.includes('webp')

  if (needsConversion) {
    if (!sharp || !sharp.default) {
      throw new Error(
        'WebP format is not supported by HeyGen. Please install "sharp" package to enable automatic conversion: npm install sharp. ' +
        'Alternatively, upload a JPEG or PNG image instead.'
      )
    }
    try {
      console.log('Converting WebP image to JPEG for HeyGen compatibility...')
      imageBuffer = await sharp.default(imageBuffer)
        .jpeg({ quality: 90 })
        .toBuffer()
      contentType = 'image/jpeg'
      console.log('✅ Successfully converted WebP to JPEG')
    } catch (convError: any) {
      throw new Error(
        `Failed to convert WebP image to JPEG: ${convError.message}. ` +
        'HeyGen only supports JPEG and PNG formats. Please convert your image to JPEG or PNG before uploading.'
      )
    }
  }

  // Validate and resize image if needed (HeyGen requires less than 2K resolution = max 2048px)
  if (sharp && sharp.default) {
    try {
      const image = sharp.default(imageBuffer)
      const metadata = await image.metadata()
      const width = metadata.width || 0
      const height = metadata.height || 0
      const maxDimension = Math.max(width, height)
      const MAX_RESOLUTION = 2048 // 2K resolution limit

      console.log(`Image dimensions: ${width}x${height} (max dimension: ${maxDimension}px)`)

      if (maxDimension > MAX_RESOLUTION) {
        console.log(`Image exceeds 2K resolution limit (${maxDimension}px > ${MAX_RESOLUTION}px). Resizing...`)

        // Calculate new dimensions maintaining aspect ratio
        let newWidth = width
        let newHeight = height
        if (width > height) {
          newWidth = MAX_RESOLUTION
          newHeight = Math.round((height / width) * MAX_RESOLUTION)
        } else {
          newHeight = MAX_RESOLUTION
          newWidth = Math.round((width / height) * MAX_RESOLUTION)
        }

        console.log(`Resizing to: ${newWidth}x${newHeight}`)

        // Resize and convert to JPEG for consistency
        imageBuffer = await image
          .resize(newWidth, newHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 90 })
          .toBuffer()

        contentType = 'image/jpeg'
        console.log(`✅ Successfully resized image to ${newWidth}x${newHeight}`)
      } else {
        // Ensure it's JPEG or PNG format
        if (!contentType.includes('jpeg') && !contentType.includes('jpg') && !contentType.includes('png')) {
          console.log(`Converting ${contentType} to JPEG...`)
          imageBuffer = await image
            .jpeg({ quality: 90 })
            .toBuffer()
          contentType = 'image/jpeg'
        }
      }
    } catch (processError: any) {
      console.warn('⚠️ Failed to process image with sharp (continuing anyway):', processError.message)
      // Continue with original image if processing fails
    }
  } else {
    console.warn('⚠️ Sharp not available - cannot validate/resize image. Image may not meet HeyGen requirements if it exceeds 2K resolution.')
  }

  // Final format validation (fallback if sharp wasn't available earlier)
  if (!contentType.includes('jpeg') && !contentType.includes('jpg') && !contentType.includes('png')) {
    throw new Error(
      `Unsupported image format: ${contentType}. HeyGen only supports JPEG and PNG formats. ` +
      `Please convert your image to JPEG or PNG, or install the "sharp" package for automatic conversion.`
    )
  }

  try {
    console.log(`Uploading image to HeyGen Upload Asset endpoint: ${HEYGEN_UPLOAD_URL}`)
    console.log(`Content-Type: ${contentType}, Size: ${imageBuffer.length} bytes`)

    // Upload raw binary data to HeyGen Upload Asset endpoint
    // According to HeyGen docs: https://docs.heygen.com/reference/upload-asset
    // The endpoint expects raw binary image data in the body (not multipart/form-data)
    const uploadResponse = await axios.post(
      HEYGEN_UPLOAD_URL,
      imageBuffer,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': contentType,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000, // 30 seconds timeout for upload
      }
    )

    console.log('Upload response:', {
      status: uploadResponse.status,
      dataKeys: Object.keys(uploadResponse.data || {}),
      data: uploadResponse.data,
    })

    // Extract image_key from response
    // Based on HeyGen docs, response should contain 'id' and 'image_key'
    const imageKey = uploadResponse.data?.data?.image_key ||
      uploadResponse.data?.image_key ||
      uploadResponse.data?.data?.id || // Fallback to id if image_key not present
      uploadResponse.data?.id

    if (imageKey) {
      console.log(`✅ Successfully uploaded image to HeyGen, got image_key: ${imageKey}`)
      return imageKey
    } else {
      // Log the full response for debugging
      console.error('Upload succeeded but image_key not found in response:', JSON.stringify(uploadResponse.data, null, 2))
      throw new Error('Upload succeeded but image_key not found in response. Response: ' + JSON.stringify(uploadResponse.data))
    }
  } catch (err: any) {
    console.error('HeyGen Upload Asset API error:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      error: err.response?.data?.error || err.message,
      responseData: err.response?.data,
    })

    let errorMessage = 'Failed to upload image to HeyGen'
    if (err.response?.data?.error) {
      errorMessage = typeof err.response.data.error === 'string'
        ? err.response.data.error
        : JSON.stringify(err.response.data.error)
    } else if (err.response?.data?.message) {
      errorMessage = err.response.data.message
    } else if (err.message) {
      errorMessage = err.message
    }

    throw new Error(errorMessage)
  }
}

export async function createAvatarFromPhoto(
  photoUrl: string,
  avatarName: string,
  additionalPhotoUrls: string[] = []
): Promise<{ avatar_id: string; status: string }> {
  try {
    const apiKey = getHeyGenKey()

    // Step 1: Upload image to HeyGen and get image_key
    // According to HeyGen support: https://docs.heygen.com/reference/upload-asset
    // This is required - we must upload the image first to get an image_key
    console.log('Step 1: Uploading image to HeyGen Upload Asset endpoint...')
    const imageKeys: string[] = []

    try {
      const primaryImageKey = await uploadImageToHeyGen(photoUrl)
      imageKeys.push(primaryImageKey)
      console.log('✅ Successfully uploaded image to HeyGen, got image_key:', primaryImageKey)
    } catch (uploadError: any) {
      console.error('❌ Image upload failed:', uploadError.message)
      throw new Error(
        `Failed to upload image to HeyGen: ${uploadError.message}. ` +
        `Please check your HEYGEN_KEY and ensure the image is accessible.`
      )
    }

    if (Array.isArray(additionalPhotoUrls) && additionalPhotoUrls.length > 0) {
      for (const [index, extraUrl] of additionalPhotoUrls.entries()) {
        if (!extraUrl || typeof extraUrl !== 'string') continue
        try {
          const extraImageKey = await uploadImageToHeyGen(extraUrl)
          imageKeys.push(extraImageKey)
          console.log(
            `✅ Successfully uploaded additional image #${index + 1} to HeyGen, got image_key: ${extraImageKey}`
          )
        } catch (extraUploadErr: any) {
          console.warn(
            `⚠️ Failed to upload additional image #${index + 1} to HeyGen:`,
            extraUploadErr.message
          )
        }
      }
    }

    // Step 2: Create Photo Avatar Group using the image_key
    // Based on https://docs.heygen.com/docs/create-and-train-photo-avatar-groups
    console.log('Step 2: Creating Photo Avatar Group with image_key...')
    let createGroupResponse: any
    const createTimeout = 30000 // 30 seconds timeout

    try {
      createGroupResponse = await axios.post(
        `${HEYGEN_V2_API_URL}/photo_avatar/avatar_group/create`,
        {
          name: avatarName,
          image_key: imageKeys[0],
        },
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: createTimeout,
        }
      )
      console.log('✅ Avatar group created successfully')
    } catch (err: any) {
      console.error('❌ Failed to create avatar group:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        error: err.response?.data?.error || err.message,
        responseData: err.response?.data,
      })

      let errorMessage = 'Failed to create avatar group'
      if (err.response?.data?.error) {
        errorMessage = typeof err.response.data.error === 'string'
          ? err.response.data.error
          : JSON.stringify(err.response.data.error)
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }

      throw new Error(`Failed to create Photo Avatar Group: ${errorMessage}`)
    }

    console.log('Avatar group creation response:', createGroupResponse.data)

    const groupId = createGroupResponse.data?.data?.id ||
      createGroupResponse.data?.data?.group_id ||
      createGroupResponse.data?.id ||
      createGroupResponse.data?.group_id

    if (!groupId) {
      throw new Error('Failed to get group_id from avatar group creation response')
    }

    console.log(`Successfully created avatar group: ${groupId}`)

    // Step 3: Add uploaded image(s) as look(s) inside the group
    // According to HeyGen workflow: After creating the group, we need to add looks
    // The group creation with image_key may not automatically create a trainable look,
    // so we explicitly add all images (including the primary) as looks
    let lookIds: string[] = []
    try {
      console.log(`Step 3: Adding ${imageKeys.length} image(s) as look(s) in the avatar group...`)
      console.log('Image keys to add:', imageKeys)

      const addLookResponse = await addLooksToAvatarGroup({
        group_id: groupId,
        image_keys: imageKeys, // Add ALL images, including the primary one
        name: avatarName,
      })

      if (!addLookResponse.photo_avatar_list?.length) {
        console.warn('⚠️ addLooksToAvatarGroup returned no looks; training may fail without at least one valid look.')
        throw new Error('No looks were added to the avatar group. Cannot proceed with training.')
      }

      lookIds = addLookResponse.photo_avatar_list
        .map((look: any) => look?.id)
        .filter((id: any): id is string => typeof id === 'string' && id.trim().length > 0)

      console.log(
        `✅ Added ${addLookResponse.photo_avatar_list.length} look(s) to group ${groupId} (requested ${imageKeys.length})`
      )
      console.log('Look IDs:', lookIds)
      console.log('Look details:', addLookResponse.photo_avatar_list.map((l: any) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        image_url: l.image_url?.substring(0, 100),
      })))
    } catch (addLookErr: any) {
      console.error('❌ Failed to add look to avatar group:', addLookErr.response?.data || addLookErr.message)
      throw new Error(
        addLookErr.response?.data?.error?.message ||
        addLookErr.response?.data?.message ||
        addLookErr.message ||
        'Failed to add image to avatar group.'
      )
    }

    if (!lookIds.length) {
      throw new Error('Failed to determine look IDs after adding images. Cannot start training.')
    }

    console.log('Verifying looks exist in group and waiting for upload processing to complete...')
    let looksReadyResult: { readyLooks: PhotoAvatarLook[]; snapshot: PhotoAvatarLook[] }
    try {
      looksReadyResult = await waitForLooksReady(groupId, lookIds, {
        minReadyLooks: 1,
      })
    } catch (looksErr: any) {
      console.error('❌ Looks did not finish processing before training could start:', looksErr.message)
      throw new Error(
        looksErr.message ||
        'Looks did not finish uploading in time. Please try again with a different photo.'
      )
    }

    console.log('✅ Looks verified and ready for training', {
      groupId,
      readyLooks: looksReadyResult.readyLooks.map((look) => ({
        id: look.id,
        status: look.status,
        reason: look.upscale_availability?.reason,
      })),
      totalLooks: lookIds.length,
    })

    // Step 4: Training is now MANUAL - do not start automatically
    // User must manually trigger training via the UI button
    console.log('Step 4: Avatar group created. Training must be started manually via the UI.')
    console.log('Avatar group ID:', groupId, 'Look IDs:', lookIds)

    return {
      avatar_id: groupId,
      status: 'pending', // Set to pending until user manually starts training
    }
  } catch (error: any) {
    console.error('HeyGen API error (createAvatarFromPhoto):', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    })

    let errorMessage = 'Failed to create avatar from photo'
    if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : JSON.stringify(error.response.data.error)
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    throw new Error(errorMessage)
  }
}

/**
 * Generate AI Avatar Photo
 * Based on https://docs.heygen.com/docs/generate-ai-avatar-photos
 */
export interface GenerateAIAvatarRequest {
  name: string
  age: 'Young Adult' | 'Early Middle Age' | 'Late Middle Age' | 'Senior' | 'Unspecified'
  gender: 'Man' | 'Woman'
  ethnicity: string
  orientation: 'horizontal' | 'vertical' | 'square'
  pose: 'half_body' | 'full_body' | 'close_up'
  style: 'Realistic' | 'Cartoon' | 'Anime'
  appearance: string
}

export interface GenerateAIAvatarResponse {
  generation_id: string
}

export async function generateAIAvatar(
  request: GenerateAIAvatarRequest
): Promise<GenerateAIAvatarResponse> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await retryWithBackoff(
      async () =>
        axios.post(`${HEYGEN_V2_API_URL}/photo_avatar/photo/generate`, request, {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 20000, // allow slower responses
        }),
      2,
      750
    )

    return {
      generation_id: response.data?.data?.generation_id || response.data?.generation_id,
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('[HeyGen] generateAIAvatar timed out after retries:', error.message)
    }
    console.error('HeyGen API error (generateAIAvatar):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Check generation status for AI avatar or look generation
 */
export interface GenerationStatus {
  id: string
  status: 'in_progress' | 'success' | 'failed'
  msg?: string | null
  image_url_list?: string[]
  image_key_list?: string[]
}

export async function checkGenerationStatus(
  generationId: string
): Promise<GenerationStatus> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await axios.get(
      `${HEYGEN_V2_API_URL}/photo_avatar/generation/${generationId}`,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = response.data?.data || response.data
    return {
      id: data.id || generationId,
      status: data.status || 'in_progress',
      msg: data.msg || null,
      image_url_list: data.image_url_list || [],
      image_key_list: data.image_key_list || [],
    }
  } catch (error: any) {
    console.error('HeyGen API error (checkGenerationStatus):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Add looks to avatar group
 * Based on https://docs.heygen.com/docs/create-and-train-photo-avatar-groups
 */
export interface AddLooksRequest {
  group_id: string
  image_keys: string[]
  name?: string
}

export interface AddLooksResponse {
  photo_avatar_list: Array<{
    id: string
    image_url: string
    name: string
    status: string
    group_id: string
  }>
}

export async function addLooksToAvatarGroup(
  request: AddLooksRequest
): Promise<AddLooksResponse> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await axios.post(
      `${HEYGEN_V2_API_URL}/photo_avatar/avatar_group/add`,
      request,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      photo_avatar_list: response.data?.data?.photo_avatar_list || response.data?.photo_avatar_list || [],
    }
  } catch (error: any) {
    console.error('HeyGen API error (addLooksToAvatarGroup):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Check training status for avatar group
 */
export interface TrainingStatus {
  status: 'pending' | 'training' | 'ready' | 'failed' | 'empty' | 'processing'
  error_msg?: string | null
  created_at?: number
  updated_at?: number | null
}

export interface PhotoAvatarDetails {
  id: string
  name?: string
  status?: string
  group_id?: string
  image_url?: string
  preview_url?: string
  thumbnail_url?: string
  created_at?: number
  updated_at?: number | null
  [key: string]: any
}

interface ResolvedPhotoAvatarTarget {
  photoAvatarId: string
  groupId?: string
  details?: PhotoAvatarDetails
}

const fetchPhotoAvatarDetails = async (
  photoAvatarId: string
): Promise<PhotoAvatarDetails> => {
  const apiKey = getHeyGenKey()
  try {
    const response = await retryWithBackoff(async () => {
      return axios.get(`${HEYGEN_V2_API_URL}/photo_avatar/details/${photoAvatarId}`, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 20000, // increase timeout to 20s to handle HeyGen slowness
      })
    }, 2, 750)

    const data = response.data?.data || response.data
    if (!data) {
      throw new Error('Failed to fetch photo avatar details')
    }

    return {
      id: data.id || photoAvatarId,
      ...data,
    }
  } catch (error: any) {
    // If 404, it might be a group_id instead of a photo_avatar_id
    if (error.response?.status === 404) {
      throw new Error(`Photo avatar not found: ${photoAvatarId}. This might be a group ID instead of an individual avatar ID.`)
    }
    throw error
  }
}

const resolvePhotoAvatarTarget = async (
  identifier: string,
  options: { includeDetails?: boolean } = {}
): Promise<ResolvedPhotoAvatarTarget> => {
  // First, try to treat the identifier as a direct photo_avatar_id
  try {
    const details = await fetchPhotoAvatarDetails(identifier)
    return {
      photoAvatarId: identifier,
      groupId: details.group_id,
      details,
    }
  } catch (err: any) {
    if (err?.response?.status && err.response.status !== 404) {
      throw err
    }
  }

  // Otherwise, treat it as a group_id and fetch the first look
  const apiKey = getHeyGenKey()
  const groupResponse = await retryWithBackoff(async () => {
    return axios.get(`${HEYGEN_V2_API_URL}/avatar_group/${identifier}/avatars`, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 20000, // increase timeout to 20s
    })
  }, 2, 750)

  const avatarList =
    groupResponse.data?.data?.avatar_list ||
    groupResponse.data?.avatar_list ||
    groupResponse.data?.data ||
    []

  if (!Array.isArray(avatarList) || avatarList.length === 0) {
    throw new Error(`No avatars found in group ${identifier}`)
  }

  const photoAvatarId = avatarList[0].id
  const details = options.includeDetails ? await fetchPhotoAvatarDetails(photoAvatarId) : undefined

  return {
    photoAvatarId,
    groupId: identifier,
    details,
  }
}

/**
 * Train avatar group
 */
export async function trainAvatarGroup(
  groupId: string,
  lookIds: string[]
): Promise<any> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await axios.post(
      `${HEYGEN_V2_API_URL}/photo_avatar/train`,
      {
        group_id: groupId,
        photo_avatar_ids: lookIds,
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data?.data || response.data
  } catch (error: any) {
    console.error('HeyGen API error (trainAvatarGroup):', error.response?.data || error.message)
    throw error
  }
}

export async function checkTrainingStatus(
  groupId: string
): Promise<TrainingStatus> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await retryWithBackoff(
      async () =>
        axios.get(`${HEYGEN_V2_API_URL}/photo_avatar/train/status/${groupId}`, {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 20000, // 20s to ride out slow HeyGen responses
        }),
      2,
      750
    )

    const data = response.data?.data || response.data
    return {
      status: data.status || 'pending',
      error_msg: data.error_msg || null,
      created_at: data.created_at,
      updated_at: data.updated_at || null,
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn('[Avatar Details] Training status timeout, returning processing fallback', {
        groupId,
        message: error.message,
      })
      return { status: 'processing', error_msg: 'timeout' }
    }
    console.error('HeyGen API error (checkTrainingStatus):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Wait for training to complete (polling with status checks)
 * According to HeyGen support: Training is mandatory and must complete before generating looks
 * 
 * @param groupId - The avatar group ID
 * @param options - Configuration options
 * @returns Promise that resolves when training is ready or rejects if training fails
 */
export async function waitForTrainingComplete(
  groupId: string,
  options: {
    maxWaitTime?: number // Maximum time to wait in milliseconds (default: 10 minutes)
    pollInterval?: number // Time between status checks in milliseconds (default: 10 seconds)
    onStatusUpdate?: (status: TrainingStatus) => void // Callback for status updates
  } = {}
): Promise<TrainingStatus> {
  const maxWaitTime = options.maxWaitTime || 10 * 60 * 1000 // 10 minutes default
  const pollInterval = options.pollInterval || 10 * 1000 // 10 seconds default
  const startTime = Date.now()

  console.log(`[Training Monitor] Starting to monitor training for group ${groupId}...`)

  while (true) {
    const elapsed = Date.now() - startTime
    if (elapsed > maxWaitTime) {
      throw new Error(
        `Training did not complete within ${maxWaitTime / 1000 / 60} minutes. ` +
        `Please check training status manually for group ${groupId}.`
      )
    }

    try {
      const status = await checkTrainingStatus(groupId)

      if (options.onStatusUpdate) {
        options.onStatusUpdate(status)
      }

      console.log(`[Training Monitor] Status check: ${status.status} (elapsed: ${Math.round(elapsed / 1000)}s)`)

      if (status.status === 'ready') {
        console.log(`✅ [Training Monitor] Training completed successfully for group ${groupId}`)
        return status
      }

      if (status.status === 'failed') {
        const errorMsg = status.error_msg || 'Training failed with unknown error'
        throw new Error(
          `Training failed for group ${groupId}: ${errorMsg}. ` +
          `Please check the uploaded images and try again.`
        )
      }

      // Status is 'pending' or 'training', continue polling
      if (status.status === 'pending' || status.status === 'training') {
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        continue
      }

      // Unknown status, log warning but continue
      console.warn(`[Training Monitor] Unknown training status: ${status.status}, continuing to poll...`)
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    } catch (error: any) {
      // If it's a status check error (not a training failure), retry
      if (error.message && !error.message.includes('Training failed')) {
        console.warn(`[Training Monitor] Error checking status, will retry:`, error.message)
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        continue
      }
      // Otherwise, re-throw (this is a training failure)
      throw error
    }
  }
}

export async function getPhotoAvatarDetails(
  identifier: string
): Promise<PhotoAvatarDetails> {
  try {
    const resolved = await resolvePhotoAvatarTarget(identifier, { includeDetails: true })
    if (resolved.details) {
      return resolved.details
    }
    return fetchPhotoAvatarDetails(resolved.photoAvatarId)
  } catch (error: any) {
    // If it's a 404 or "not found", it might be a group_id or deleted avatar
    if (error.response?.status === 404 || 
        error.message?.includes('not found') || 
        error.message?.includes('No avatars found') ||
        (error.response?.data?.error?.message && error.response.data.error.message.includes('not found'))) {
      // Don't log as error - this is expected for group IDs or deleted avatars
      // Return basic structure with status 'unknown' so it can be marked as deleted
      return {
        id: identifier,
        group_id: identifier,
        status: 'unknown',
      }
    }
    // For timeouts or other errors, return a soft fallback so callers can proceed
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn('[Avatar Details] Timeout fetching photo avatar details, returning unknown:', {
        identifier,
        message: error.message,
      })
      return {
        id: identifier,
        group_id: identifier,
        status: 'unknown',
      }
    }
    // Only log actual errors (not 404s/timeouts handled above)
    if (error.response?.status !== 404) {
      console.error('HeyGen API error (getPhotoAvatarDetails):', error.response?.data || error.message)
    }
    throw error
  }
}

export async function upscalePhotoAvatar(
  identifier: string
): Promise<{ job_id?: string; status?: string; message?: string }> {
  try {
    const { photoAvatarId } = await resolvePhotoAvatarTarget(identifier)
    const apiKey = getHeyGenKey()

    const response = await axios.post(
      `${HEYGEN_V2_API_URL}/photo_avatar/upscale`,
      {
        photo_avatar_id: photoAvatarId,
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data?.data || response.data || {}
  } catch (error: any) {
    console.error('HeyGen API error (upscalePhotoAvatar):', error.response?.data || error.message)
    throw error
  }
}

export async function deletePhotoAvatar(identifier: string): Promise<void> {
  try {
    const { photoAvatarId } = await resolvePhotoAvatarTarget(identifier)
    const apiKey = getHeyGenKey()

    await axios.delete(`${HEYGEN_V2_API_URL}/photo_avatar/${photoAvatarId}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error('HeyGen API error (deletePhotoAvatar):', error.response?.data || error.message)
    throw error
  }
}

export async function deletePhotoAvatarGroup(groupId: string): Promise<void> {
  try {
    const apiKey = getHeyGenKey()

    await axios.delete(`${HEYGEN_V2_API_URL}/photo_avatar/avatar_group/${groupId}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error('HeyGen API error (deletePhotoAvatarGroup):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Add motion to a photo avatar or look using the HeyGen Add Motion API
 * This enhances the avatar with natural movement, gestures, and expressions
 * 
 * @param id - Unique identifier of the avatar/look (can be avatar ID or look ID)
 * @param prompt - Text prompt describing the avatar's movement (optional)
 * @param motionType - Motion engine to use (defaults to 'expressive' for maximum movement)
 * @returns Response from the Add Motion API
 * 
 * @see https://docs.heygen.com/reference/add-motion
 */
export async function addMotionToPhotoAvatar(
  id: string,
  prompt?: string,
  motionType: 'consistent' | 'expressive' | 'consistent_gen_3' | 'hailuo_2' | 'veo2' | 'seedance_lite' | 'kling' = 'expressive'
): Promise<any> {
  try {
    const apiKey = getHeyGenKey()
    const endpoint = `${HEYGEN_V2_API_URL}/photo_avatar/add_motion`
    
    const payload: any = {
      id: id.trim(),
    }
    
    // Add prompt if provided - use enhanced prompt for maximum movement
    if (prompt) {
      payload.prompt = prompt
    } else {
      // Default enhanced prompt for maximum movement
      payload.prompt = 'Full body motion with expressive hand gestures, natural head movements, engaging body language, waving, pointing, and emphasis gestures throughout'
    }
    
    // Use expressive motion type for maximum movement
    payload.motion_type = motionType
    
    console.log('[Add Motion] Calling HeyGen Add Motion API:', {
      id,
      motionType,
      hasPrompt: !!payload.prompt,
      promptPreview: payload.prompt?.substring(0, 100),
    })
    
    const response = await axios.post(endpoint, payload, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })
    
    console.log('[Add Motion] Successfully added motion to photo avatar:', {
      id,
      response: response.data,
    })
    
    return response.data?.data || response.data
  } catch (error: any) {
    console.error('[Add Motion] HeyGen API error:', {
      id,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })
    // Don't throw - motion enhancement is optional, continue with video generation
    return null
  }
}

/**
 * Generate additional looks for avatar group
 */
export interface GenerateLookRequest {
  group_id: string
  prompt: string
  orientation: 'horizontal' | 'vertical' | 'square'
  pose: 'half_body' | 'full_body' | 'close_up'
  style: 'Realistic' | 'Pixar' | 'Cinematic' | 'Vintage' | 'Noir' | 'Cyberpunk' | 'Unspecified' | 'Cartoon' | 'Anime'
  photo_avatar_id?: string // Optional: use selected look as base for generation
}

export async function generateAvatarLook(
  request: GenerateLookRequest
): Promise<{ generation_id: string }> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await axios.post(
      `${HEYGEN_V2_API_URL}/photo_avatar/look/generate`,
      request,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      generation_id: response.data?.data?.generation_id || response.data?.generation_id,
    }
  } catch (error: any) {
    console.error('HeyGen API error (generateAvatarLook):', JSON.stringify(error.response?.data || error.message, null, 2))

    let errorMessage = 'Failed to generate avatar look'
    if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : (error.response.data.error.message || JSON.stringify(error.response.data.error))
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    // Attach response status if available to help with debugging
    const enhancedError: any = new Error(errorMessage)
    if (error.response) {
      enhancedError.response = error.response
    }
    throw enhancedError
  }
}

export async function getVideoStatus(
  videoId: string
): Promise<HeyGenVideoResponse & { progress?: number }> {
  const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
  const apiKey = getHeyGenKey()

  // Try multiple v2 endpoint formats
  const v2Endpoints = [
    `${HEYGEN_V2_API_URL}/video_status/${videoId}`, // Template videos might use this
    `${HEYGEN_V2_API_URL}/video/${videoId}`, // Standard video endpoint
  ]

  for (const endpoint of v2Endpoints) {
    try {
      const response = await axios.get(endpoint, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      })

      const data = response.data?.data || response.data

      return {
        video_id: videoId,
        status: data.status || 'pending',
        video_url: data.video_url || data.videoUrl || data.url || null,
        error: data.error || data.error_message || null,
        progress: data.progress || data.progress_percentage || undefined,
      }
    } catch (v2Error: any) {
      const v2Status = v2Error.response?.status
      // If it's not a 404, this endpoint format might be wrong, try next
      // If it's 404, this endpoint doesn't exist, try next format
      if (v2Status !== 404 && v2Status < 500) {
        // Non-404 client error (400, 401, 403) - this endpoint format is wrong, try next
        continue
      }
      // For 404 or 5xx errors, try next endpoint format
      if (endpoint === v2Endpoints[v2Endpoints.length - 1]) {
        // Last v2 endpoint failed, try v1
        break
      }
      continue
    }
  }

  // All v2 endpoints failed, try v1 API as fallback
  try {
    console.warn(`All v2 API endpoints failed, trying v1 for video ${videoId}`)
    const response = await axios.get(
      `${HEYGEN_API_URL}/video_status.get`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        params: {
          video_id: videoId,
        },
        timeout: 30000,
      }
    )

    const data = response.data.data || response.data

    return {
      video_id: videoId,
      status: data.status || 'pending',
      video_url: data.video_url || data.videoUrl || data.url || null,
      error: data.error || data.error_message || null,
    }
  } catch (v1Error: any) {
    // If v1 also fails, throw error but with more context
    // The calling code should handle this gracefully and retry later
    const errorMessage = `HeyGen API error: All endpoints failed for video ${videoId}. v1 error: ${v1Error.response?.status || v1Error.message}`
    console.error('HeyGen API error (getVideoStatus):', {
      videoId,
      v1Error: v1Error.response?.status || v1Error.message,
      v1ErrorData: v1Error.response?.data,
    })
    throw new Error(errorMessage)
  }
}

/**
 * Get sharable video URL from HeyGen
 * Based on: https://docs.heygen.com/reference/retrieve-sharable-video-url
 */
export async function getSharableVideoUrl(
  videoId: string
): Promise<{ share_url: string }> {
  try {
    const apiKey = getHeyGenKey()

    const response = await axios.post(
      `${HEYGEN_API_URL}/video/share`,
      {
        video_id: videoId,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = response.data?.data || response.data

    return {
      share_url: data.share_url || data.shareUrl || data.url,
    }
  } catch (error: any) {
    console.error('HeyGen API error (getSharableVideoUrl):', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get sharable video URL'
    )
  }
}

