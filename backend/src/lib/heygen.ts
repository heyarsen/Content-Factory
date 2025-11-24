import axios from 'axios'

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

async function fetchAvatarGroupLooks(groupId: string): Promise<PhotoAvatarLook[]> {
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

interface WaitForLooksReadyOptions {
  minReadyLooks?: number
  maxWaitTime?: number
  pollInterval?: number
}

async function waitForLooksReady(
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
}

export interface GenerateTemplateVideoRequest {
  template_id: string
  variables: Record<string, string | Record<string, any>>
  title?: string
  caption?: boolean
  include_gif?: boolean
  enable_sharing?: boolean
  callback_url?: string
  dimension?: HeyGenDimensionInput
  overrides?: Record<string, any>
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
 * List available avatars from HeyGen
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

    const payload: Record<string, any> = {
      variables: formatTemplateVariables(request.variables),
      title: request.title || 'Untitled Video',
      caption: request.caption ?? false,
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
    console.error('HeyGen API error (generateVideoFromTemplate):', error.response?.data || error.message)

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
      errorMessage = 'HeyGen API server error. Please try again later.'
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

      // Step 4: Train the avatar group (MANDATORY - cannot be skipped)
      // According to HeyGen support: Training is mandatory and must complete before generating looks
      console.log('Step 4: Starting avatar group training (mandatory step)...')
      console.log('Training request:', { group_id: groupId, look_ids: lookIds })
      
      let trainingStarted = false
      const maxRetries = 3
      let lastError: any = null
      const trainingPayload: Record<string, any> = { group_id: groupId }
      if (lookIds.length) {
        trainingPayload.photo_avatar_ids = lookIds
      }

    // Retry training start with exponential backoff (HeyGen may need more time to process looks)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 2), 10000) // Exponential backoff, max 10s
          console.log(`Retrying training start (attempt ${attempt}/${maxRetries}) after ${waitTime / 1000}s...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }

          const trainResponse = await axios.post(
            `${HEYGEN_V2_API_URL}/photo_avatar/train`,
            trainingPayload,
            {
              headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
              },
            }
          )

        console.log('✅ Training started successfully:', trainResponse.data)
        trainingStarted = true
        break // Success, exit retry loop
      } catch (trainErr: any) {
        lastError = trainErr
        const trainErrorMsg = trainErr.response?.data?.error?.message || 
                             trainErr.response?.data?.message || 
                             trainErr.message
        const errorCode = trainErr.response?.data?.error?.code || 
                          trainErr.response?.data?.code
          const normalizedTrainError = (trainErrorMsg || '').toLowerCase()
          const retryableTrainingError =
            normalizedTrainError.length > 0 &&
            RETRYABLE_TRAINING_ERROR_SUBSTRINGS.some((token) =>
              normalizedTrainError.includes(token)
            )

          console.warn(`⚠️ Training start attempt ${attempt}/${maxRetries} failed:`, {
          status: trainErr.response?.status,
          statusText: trainErr.response?.statusText,
          error: trainErrorMsg,
          code: errorCode,
          groupId,
        })

          if (retryableTrainingError && attempt < maxRetries) {
            console.log('[Training] Looks may not be ready yet. Waiting before retrying...')
            try {
              await waitForLooksReady(groupId, lookIds, {
                minReadyLooks: 1,
                maxWaitTime: Math.min(LOOK_PROCESSING_TIMEOUT_MS, 60000),
              })
            } catch (waitErr: any) {
              console.warn('[Training] Additional wait for looks before retry failed:', waitErr.message)
            }
            continue
          } else if (!retryableTrainingError) {
            console.error('❌ Training failed with non-retryable error:', trainErrorMsg)
            break
          }

        // If this is the last attempt, we'll throw the error below
        if (attempt === maxRetries) {
          console.error('❌ All training start attempts failed')
        }
      }
    }

    if (!trainingStarted) {
      const trainErrorMsg = lastError?.response?.data?.error?.message || 
                           lastError?.response?.data?.message || 
                           lastError?.message || 
                           'Unknown error'
      const errorCode = lastError?.response?.data?.error?.code || 
                       lastError?.response?.data?.code
      
      console.error('❌ Training failed to start after all retries:', {
        status: lastError?.response?.status,
        statusText: lastError?.response?.statusText,
        error: trainErrorMsg,
        code: errorCode,
        groupId,
        responseData: lastError?.response?.data,
      })

      // Training is mandatory - throw error if it fails to start after retries
      throw new Error(
        `Failed to start training for avatar group ${groupId} after ${maxRetries} attempts: ${trainErrorMsg}. ` +
        `Error code: ${errorCode || 'N/A'}. ` +
        `\n\nImage Requirements:\n` +
        `- Format: JPG or PNG only\n` +
        `- Size: Under 50MB\n` +
        `- Resolution: Less than 2K (max 2048px on longest side)\n` +
        `- Content: Clear face visible, well-lit, no obstructions (sunglasses, masks, etc.)\n` +
        `- Quality: High quality, not blurry or heavily filtered\n\n` +
        `The image has been automatically resized if it exceeded 2K resolution. ` +
        `If the issue persists, the image may not meet HeyGen's face detection or quality requirements. ` +
        `Please try a different image with a clear, unobstructed face.`
      )
    }

    // Step 5: Monitor training status until complete (MANDATORY)
    // According to HeyGen support: Must monitor training status and wait for "ready" status
    console.log('Step 5: Monitoring training status until completion...')
    let finalStatus = 'training'
    
    try {
      const trainingResult = await waitForTrainingComplete(groupId, {
        maxWaitTime: 10 * 60 * 1000, // 10 minutes max wait
        pollInterval: 10 * 1000, // Check every 10 seconds
        onStatusUpdate: (status) => {
          console.log(`[Training Progress] Status: ${status.status}${status.error_msg ? `, Error: ${status.error_msg}` : ''}`)
        },
      })

      finalStatus = trainingResult.status
      console.log(`✅ Training completed with status: ${finalStatus}`)
    } catch (waitError: any) {
      console.error('❌ Error waiting for training to complete:', waitError.message)
      // If training failed, we still return the group ID but with failed status
      // The user can check status later or retry
      finalStatus = 'failed'
      throw new Error(
        `Training did not complete successfully for avatar group ${groupId}: ${waitError.message}. ` +
        `The avatar group was created but training failed. Please check the training status manually.`
      )
    }

    return {
      avatar_id: groupId,
      status: finalStatus === 'ready' ? 'active' : finalStatus,
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

    const response = await axios.post(
      `${HEYGEN_V2_API_URL}/photo_avatar/photo/generate`,
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
  status: 'pending' | 'training' | 'ready' | 'failed'
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

const fetchPhotoAvatarDetails = async (photoAvatarId: string): Promise<PhotoAvatarDetails> => {
  const apiKey = getHeyGenKey()
  const response = await axios.get(`${HEYGEN_V2_API_URL}/photo_avatar/details/${photoAvatarId}`, {
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
  })

  const data = response.data?.data || response.data
  if (!data) {
    throw new Error('Failed to fetch photo avatar details')
  }

  return {
    id: data.id || photoAvatarId,
    ...data,
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
  const groupResponse = await axios.get(`${HEYGEN_V2_API_URL}/avatar_group/${identifier}/avatars`, {
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
  })

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

export async function checkTrainingStatus(
  groupId: string
): Promise<TrainingStatus> {
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    const response = await axios.get(
      `${HEYGEN_V2_API_URL}/photo_avatar/train/status/${groupId}`,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = response.data?.data || response.data
    return {
      status: data.status || 'pending',
      error_msg: data.error_msg || null,
      created_at: data.created_at,
      updated_at: data.updated_at || null,
    }
  } catch (error: any) {
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
    console.error('HeyGen API error (getPhotoAvatarDetails):', error.response?.data || error.message)
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
 * Generate additional looks for avatar group
 */
export interface GenerateLookRequest {
  group_id: string
  prompt: string
  orientation: 'horizontal' | 'vertical' | 'square'
  pose: 'half_body' | 'full_body' | 'close_up'
  style: 'Realistic' | 'Pixar' | 'Cinematic' | 'Vintage' | 'Noir' | 'Cyberpunk' | 'Unspecified' | 'Cartoon' | 'Anime'
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
  try {
    const HEYGEN_V2_API_URL = 'https://api.heygen.com/v2'
    const apiKey = getHeyGenKey()

    // Try v2 API first
    try {
      const response = await axios.get(
        `${HEYGEN_V2_API_URL}/video/${videoId}`,
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data?.data || response.data

      return {
        video_id: videoId,
        status: data.status || 'pending',
        video_url: data.video_url || data.videoUrl || data.url || null,
        error: data.error || data.error_message || null,
        progress: data.progress || data.progress_percentage || undefined,
      }
    } catch (v2Error: any) {
      // Fallback to v1 API
      console.log(
        'v2 API failed, trying v1:',
        v2Error.response?.status ?? v2Error?.message ?? 'unknown error'
      )
      const response = await axios.get(
        `${HEYGEN_API_URL}/video_status.get`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          params: {
            video_id: videoId,
          },
        }
      )

      const data = response.data.data || response.data

      return {
        video_id: videoId,
        status: data.status,
        video_url: data.video_url || data.videoUrl || data.url,
        error: data.error || data.error_message,
      }
    }
  } catch (error: any) {
    console.error('HeyGen API error (getVideoStatus):', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || 'Failed to get video status'
    )
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

