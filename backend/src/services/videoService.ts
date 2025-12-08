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
  status?: string
}

const isAvatarNotFoundError = (error: any): boolean => {
  const code = error?.response?.data?.error?.code
  const message =
    error?.response?.data?.error?.message ||
    error?.response?.data?.error?.error ||
    error?.message ||
    ''
  const lower = `${message}`.toLowerCase()
  return (
    code === 'avatar_not_found' ||
    lower.includes('avatar not found') ||
    lower.includes('look not found') ||
    lower.includes('look_id') ||
    lower.includes('endpoint not found') ||
    (error?.response?.status === 404 && lower.includes('avatar'))
  )
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
      // Fallback: use first active avatar if no default is set
      const userAvatars = await AvatarService.getUserAvatars(userId)
      const firstActiveAvatar = userAvatars.find((avatar: AvatarRecord) => avatar.status === 'active')
      if (firstActiveAvatar) {
        return mapAvatarRecord(firstActiveAvatar)
      }
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
  dimension?: HeyGenDimensionInput,
  motionConfig?: import('../lib/heygen.js').MotionConfig // Optional motion configuration
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

  // Add motion configuration if provided
  if (motionConfig) {
    payload.motion_config = motionConfig
  }

  // Log payload details including aspect ratio
  if (aspectRatio) {
    console.log(`[HeyGen Payload] Built payload with aspect_ratio: ${aspectRatio}`, {
      hasAspectRatio: !!aspectRatio,
      aspectRatio,
      outputResolution: resolvedOutputResolution,
      hasAvatar: !!avatarId,
      dimension: resolvedDimension,
      hasMotionConfig: !!motionConfig,
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
  dimension?: HeyGenDimensionInput,
  allowAvatarFallback: boolean = true
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
    // If avatar is invalid/missing in HeyGen, retry once with user's default avatar
    if (allowAvatarFallback && isAvatarNotFoundError(error)) {
      try {
        console.warn('Avatar not found, attempting fallback to default avatar', {
          videoId: video.id,
          userId: video.user_id,
          badAvatarId: avatarId,
        })
        const { avatarId: fallbackAvatarId, isPhotoAvatar: fallbackIsPhoto } = await resolveAvatarContext(
          video.user_id,
          null
        )
        if (fallbackAvatarId && fallbackAvatarId !== avatarId) {
          await runHeygenGeneration(
            video,
            fallbackAvatarId,
            fallbackIsPhoto,
            outputResolution,
            planItemId,
            aspectRatio,
            dimension,
            false // prevent recursion
          )
          return
        }
      } catch (fallbackError) {
        console.error('Avatar fallback failed:', fallbackError)
      }
    }

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
  // Always use the default template for everyone
  const DEFAULT_TEMPLATE_ID = 'baf2ab03a4354aebac815fd42c10895b'
  
  return {
    templateId: DEFAULT_TEMPLATE_ID,
    scriptKey: 'script', // Default script variable key
    variables: {},
    overrides: {},
  }
}

async function runTemplateGeneration(
  video: Video,
  preference: TemplatePreference,
  scriptText: string,
  planItemId?: string | null,
  avatarId?: string,
  isPhotoAvatar?: boolean,
  generateCaption?: boolean
): Promise<void> {
  try {
    console.log('[Template Generation] Starting template video generation:', {
      videoId: video.id,
      templateId: preference.templateId,
      scriptKey: preference.scriptKey,
      scriptLength: scriptText?.length || 0,
      topic: video.topic,
    })
    
    const variables: Record<string, any> = {
      ...preference.variables,
    }

    const scriptKey = preference.scriptKey || 'script'
    const scriptValue = scriptText || video.topic || ''
    if (scriptValue) {
      variables[scriptKey] = scriptValue
    }

    // Build overrides to set avatar in template nodes
    let overrides: Record<string, any> = { ...preference.overrides }
    
    // Detect avatar capabilities for motion features in templates
    let avatarCapabilities: import('../lib/heygen.js').AvatarCapabilities | null = null
    let motionConfig: import('../lib/heygen.js').MotionConfig | null = null
    
    if (avatarId) {
      try {
        const { detectAvatarCapabilities, buildGestureArray } = await import('../lib/heygen.js')
        avatarCapabilities = await detectAvatarCapabilities(avatarId, !!isPhotoAvatar)
        
        // Auto-generate motion config for templates
        const gestures = avatarCapabilities.supportsGestureControl
          ? buildGestureArray(scriptText || video.topic || '', video.duration)
          : undefined
        
        // Create enhanced motion config for maximum movement
        // Use more explicit prompts for full body motion, hand gestures, and head movement
        const enhancedMotionPrompt = avatarCapabilities.supportsFullBodyMovement
          ? 'Full body motion with expressive hand gestures, natural head movements, and engaging body language. Include waving, pointing, and emphasis gestures throughout the video.'
          : avatarCapabilities.supportsCustomMotionPrompt
          ? 'Expressive head movements with natural hand gestures, friendly facial expressions, and engaging body language. Include waving, pointing, and emphasis gestures.'
          : 'Natural head movement with friendly expressions, engaging gestures, and expressive body language'
        
        motionConfig = {
          gestures,
          customMotionPrompt: avatarCapabilities.supportsCustomMotionPrompt || avatarCapabilities.supportsFullBodyMovement
            ? enhancedMotionPrompt
            : undefined,
          enhanceCustomMotionPrompt: avatarCapabilities.supportsCustomMotionPrompt || avatarCapabilities.supportsFullBodyMovement,
          enableHeadMovement: avatarCapabilities.supportsHeadMovement,
          enableEnhancedExpressions: avatarCapabilities.supportsEnhancedExpressions,
        }
        
        console.log('[Template Motion] Avatar capabilities detected:', {
          avatarId,
          isPhotoAvatar,
          capabilities: avatarCapabilities,
          motionConfig: motionConfig ? {
            hasGestures: !!motionConfig.gestures,
            gestureCount: motionConfig.gestures?.length || 0,
            hasCustomMotionPrompt: !!motionConfig.customMotionPrompt,
          } : null,
        })
      } catch (capabilityError: any) {
        console.warn('[Template Motion] Could not detect avatar capabilities, proceeding without motion features:', capabilityError.message)
      }
    }
    
    if (avatarId) {
      // Try to fetch template details to see if it has an avatar_id variable
      let hasAvatarIdVariable = false
      let templateNodes: any[] = []
      try {
        const { getTemplateDetails } = await import('../lib/heygen.js')
        const templateDetails = await getTemplateDetails(preference.templateId)
        
        // Log full template details to understand structure
        console.log('[Template Generation] Full template details response:', {
          templateId: preference.templateId,
          hasData: !!templateDetails?.data,
          hasNodes: !!templateDetails?.nodes,
          keys: Object.keys(templateDetails || {}),
          fullResponse: JSON.stringify(templateDetails, null, 2).substring(0, 1000), // First 1000 chars
        })
        
        // Check if template has avatar_id variable
        const templateVariables = templateDetails?.variables || templateDetails?.data?.variables || {}
        hasAvatarIdVariable = 'avatar_id' in templateVariables
        
        if (hasAvatarIdVariable) {
          console.log('[Template Generation] Template has avatar_id variable, will replace character_id with selected avatar and also override via nodes_override')
          
          // Use a sanitized avatar_id variable so type matches the avatar we pass
          const targetType = isPhotoAvatar ? 'talking_photo' : 'avatar'
          variables['avatar_id'] = {
            name: 'avatar_id',
            type: 'character',
            properties: {
              character_id: avatarId,
              type: targetType,
            },
          }

          const originalCharacterId =
            (templateVariables as any)?.avatar_id?.properties?.character_id || null
          console.log('[Template Generation] Set avatar_id variable (replaced character_id):', {
            originalCharacterId,
            newCharacterId: avatarId,
            finalVariable: JSON.stringify(variables['avatar_id'], null, 2),
          })
          
          // Still use nodes_override to ensure avatar is actually set in all character nodes
          if (!overrides.nodes_override) {
            overrides.nodes_override = []
          }
          if (!Array.isArray(overrides.nodes_override)) {
            overrides.nodes_override = [overrides.nodes_override]
          }
          
          const characterOverride = isPhotoAvatar
            ? {
                type: 'talking_photo',
                talking_photo_id: avatarId,
              }
            : {
                type: 'avatar',
                avatar_id: avatarId,
              }
          
          const nodesToOverride = Array.from({ length: 6 }, (_, i) => ({ index: i }))
          for (const nodeInfo of nodesToOverride) {
            const nodeIndex = nodeInfo.index
            while (overrides.nodes_override.length <= nodeIndex) {
              overrides.nodes_override.push({})
            }
            
            // Get the existing template node to preserve its motion settings
            const existingNode = templateNodes[nodeIndex] || {}
            
            // Preserve ALL node properties except the old character, then override with new character
            // This ensures motion settings and all other template configurations are preserved
            const { character: oldCharacter, ...restOfNode } = existingNode
            
            // Build the override object - preserve all node properties, only override character
            const nodeOverride: any = {
              ...restOfNode, // Preserve ALL existing node properties (motion settings, configs, etc.)
              character: characterOverride, // Override only the character
            }
            
            // Also preserve motion settings that might be nested in the old character object
            if (oldCharacter && typeof oldCharacter === 'object') {
              const charMotionFields = ['motion_engine', 'generation_mode', 'full_body_motion', 'generation_mode']
              for (const field of charMotionFields) {
                if (oldCharacter[field] !== undefined) {
                  // Merge motion settings from old character into new character override
                  nodeOverride.character = {
                    ...characterOverride,
                    [field]: oldCharacter[field],
                  }
                  console.log(`[Template Generation] Preserving character motion field: ${field} = ${JSON.stringify(oldCharacter[field])}`)
                }
              }
            }
            
            // Log what we're preserving for debugging
            const preservedFields = Object.keys(restOfNode).filter(k => 
              k.toLowerCase().includes('motion') || 
              k.toLowerCase().includes('generation') ||
              k.toLowerCase().includes('engine')
            )
            if (preservedFields.length > 0) {
              console.log(`[Template Generation] Preserving fields from template node[${nodeIndex}]:`, preservedFields)
            }
            
            // ALWAYS add motion features to ensure maximum movement, even if template has some motion settings
            // This ensures we get full body motion, hand gestures, and head movement
            if (motionConfig && avatarCapabilities) {
              // Add gestures if avatar supports gesture control (always add for maximum motion)
              if (motionConfig.gestures && motionConfig.gestures.length > 0 && avatarCapabilities.supportsGestureControl) {
                nodeOverride.gestures = motionConfig.gestures
                console.log(`[Template Generation] Added gestures to node[${nodeIndex}]:`, motionConfig.gestures.length, 'gestures')
              }
              
              // Always add enhanced custom motion prompt for maximum movement
              if (motionConfig.customMotionPrompt) {
                // Override template's motion prompt with our enhanced one for maximum motion
                nodeOverride.custom_motion_prompt = motionConfig.customMotionPrompt
                
                if (motionConfig.enhanceCustomMotionPrompt) {
                  nodeOverride.enhance_custom_motion_prompt = true
                }
                console.log(`[Template Generation] Added enhanced motion prompt to node[${nodeIndex}]:`, motionConfig.customMotionPrompt.substring(0, 100))
              } else if (!avatarCapabilities.supportsGestureControl && avatarCapabilities.supportsCustomMotionPrompt) {
                // Fallback: use enhanced motion prompt if gestures not supported
              const fallbackPrompt = 'Expressive head movements with natural hand gestures, friendly facial expressions, and engaging body language. Include waving, pointing, and emphasis gestures throughout.'
              nodeOverride.custom_motion_prompt = fallbackPrompt
              nodeOverride.enhance_custom_motion_prompt = true
              console.log(`[Template Generation] Added fallback motion prompt to node[${nodeIndex}]`)
            }
            
            // Note: head_movement and enhanced_expressions are typically automatic
            // for photo avatars when custom_motion_prompt is used with enhance_custom_motion_prompt
            // We don't need to set these explicitly as they might not be valid fields for template API
            }
            
            overrides.nodes_override[nodeIndex] = nodeOverride
          }
          console.log('[Template Generation] Also set nodes_override as backup:', {
            nodesCount: overrides.nodes_override.length,
            hasMotionFeatures: !!(motionConfig && avatarCapabilities),
          })
        }
        
        // Try multiple possible paths for nodes
        // HeyGen template structure can vary, so check multiple locations
        templateNodes = 
          templateDetails?.nodes || 
          templateDetails?.data?.nodes || 
          templateDetails?.data?.template?.nodes ||
          templateDetails?.template?.nodes ||
          templateDetails?.structure?.nodes ||
          (Array.isArray(templateDetails) ? templateDetails : [])
        
        // If still no nodes, check if there's a scenes or timeline structure
        if (templateNodes.length === 0) {
          const scenes = templateDetails?.scenes || templateDetails?.data?.scenes || templateDetails?.data?.template?.scenes
          const timeline = templateDetails?.timeline || templateDetails?.data?.timeline || templateDetails?.data?.template?.timeline
          if (scenes && Array.isArray(scenes)) {
            templateNodes = scenes
          } else if (timeline && Array.isArray(timeline)) {
            templateNodes = timeline
          }
        }
        
        // Log template structure for debugging motion settings
        console.log('[Template Generation] Template structure:', {
          templateId: preference.templateId,
          hasScenes: !!(templateDetails?.scenes || templateDetails?.data?.scenes),
          hasNodes: templateNodes.length > 0,
          templateKeys: Object.keys(templateDetails || {}),
          sampleNode: templateNodes[0] ? JSON.stringify(templateNodes[0], null, 2).substring(0, 1000) : 'none',
        })
        
        console.log('[Template Generation] Fetched template details:', {
          templateId: preference.templateId,
          hasAvatarIdVariable,
          nodesCount: templateNodes.length,
          nodes: templateNodes.map((n: any, i: number) => ({
            index: i,
            id: n.id || n.node_id,
            type: n.type,
            hasCharacter: !!n.character,
            motionFields: Object.keys(n).filter(k => k.toLowerCase().includes('motion') || k.toLowerCase().includes('generation')),
            fullNode: JSON.stringify(n, null, 2).substring(0, 500), // Log first 500 chars of node for debugging
          })),
        })
      } catch (templateError: any) {
        console.warn('[Template Generation] Could not fetch template details, using nodes_override fallback:', templateError.message)
      }
      
      // Only use nodes_override if template doesn't have avatar_id variable
      if (!hasAvatarIdVariable) {
        // Initialize nodes_override array
        if (!overrides.nodes_override) {
          overrides.nodes_override = []
        }
        if (!Array.isArray(overrides.nodes_override)) {
          overrides.nodes_override = [overrides.nodes_override]
        }
        
        // Create the character override
        const characterOverride = isPhotoAvatar
          ? {
              type: 'talking_photo',
              talking_photo_id: avatarId,
            }
          : {
              type: 'avatar',
              avatar_id: avatarId,
            }
        
        // Override strategy: Since template details may not expose nodes correctly,
        // we'll override multiple nodes to ensure the character is set
        // If we have template nodes, use them; otherwise override nodes 0-5 to catch the character
        const nodesToOverride: Array<{ index: number; id?: string; hasCharacter?: boolean }> = templateNodes.length > 0 
          ? templateNodes.map((n: any, i: number) => ({ index: i, id: n.id || n.node_id, hasCharacter: !!n.character }))
          : Array.from({ length: 6 }, (_, i) => ({ index: i })) // Fallback: override nodes 0-5 to ensure we catch the character
        
        // Override all identified nodes (or first 3 as fallback)
        for (const nodeInfo of nodesToOverride) {
          const nodeIndex = nodeInfo.index
          // Ensure we have enough nodes in the override array
          while (overrides.nodes_override.length <= nodeIndex) {
            overrides.nodes_override.push({})
          }
          
          // Get the existing template node to preserve its motion settings
          const existingNode = templateNodes[nodeIndex] || {}
          
          // Preserve ALL node properties except the old character, then override with new character
          // This ensures motion settings and all other template configurations are preserved
          const { character: oldCharacter, ...restOfNode } = existingNode
          
          // Build the override object - preserve all node properties, only override character
          const nodeOverride: any = {
            ...restOfNode, // Preserve ALL existing node properties (motion settings, configs, etc.)
            character: characterOverride, // Override only the character
          }
          
          // Also preserve motion settings that might be nested in the old character object
          if (oldCharacter && typeof oldCharacter === 'object') {
            const charMotionFields = ['motion_engine', 'generation_mode', 'full_body_motion', 'generation_mode']
            for (const field of charMotionFields) {
              if (oldCharacter[field] !== undefined) {
                // Merge motion settings from old character into new character override
                nodeOverride.character = {
                  ...characterOverride,
                  [field]: oldCharacter[field],
                }
                console.log(`[Template Generation] Preserving character motion field: ${field} = ${JSON.stringify(oldCharacter[field])}`)
              }
            }
          }
          
          // Log what we're preserving for debugging
          const preservedFields = Object.keys(restOfNode).filter(k => 
            k.toLowerCase().includes('motion') || 
            k.toLowerCase().includes('generation') ||
            k.toLowerCase().includes('engine')
          )
          if (preservedFields.length > 0) {
            console.log(`[Template Generation] Preserving fields from template node[${nodeIndex}]:`, preservedFields)
          }
          
          // ALWAYS add motion features to ensure maximum movement, even if template has some motion settings
          // This ensures we get full body motion, hand gestures, and head movement
          if (motionConfig && avatarCapabilities && nodeInfo.hasCharacter) {
            // Add gestures if avatar supports gesture control (always add for maximum motion)
            if (motionConfig.gestures && motionConfig.gestures.length > 0 && avatarCapabilities.supportsGestureControl) {
              nodeOverride.gestures = motionConfig.gestures
              console.log(`[Template Generation] Added gestures to node[${nodeIndex}]:`, motionConfig.gestures.length, 'gestures')
            }
            
            // Always add enhanced custom motion prompt for maximum movement
            if (motionConfig.customMotionPrompt) {
              // Override template's motion prompt with our enhanced one for maximum motion
              nodeOverride.custom_motion_prompt = motionConfig.customMotionPrompt
              
              if (motionConfig.enhanceCustomMotionPrompt) {
                nodeOverride.enhance_custom_motion_prompt = true
              }
              console.log(`[Template Generation] Added enhanced motion prompt to node[${nodeIndex}]:`, motionConfig.customMotionPrompt.substring(0, 100))
            } else if (!avatarCapabilities.supportsGestureControl && avatarCapabilities.supportsCustomMotionPrompt) {
              // Fallback: use enhanced motion prompt if gestures not supported
              const fallbackPrompt = 'Expressive head movements with natural hand gestures, friendly facial expressions, and engaging body language. Include waving, pointing, and emphasis gestures throughout.'
              nodeOverride.custom_motion_prompt = fallbackPrompt
              nodeOverride.enhance_custom_motion_prompt = true
              console.log(`[Template Generation] Added fallback motion prompt to node[${nodeIndex}]`)
            }
            
            // Note: head_movement and enhanced_expressions are typically automatic
            // for photo avatars when custom_motion_prompt is used with enhance_custom_motion_prompt
            // We don't need to set these explicitly as they might not be valid fields
          }
          
          // Add node_id if available
          if (nodeInfo.id) {
            nodeOverride.node_id = nodeInfo.id
          }
          
          overrides.nodes_override[nodeIndex] = nodeOverride
          
          console.log(`[Template Generation] Overriding node[${nodeIndex}]:`, {
            nodeId: nodeInfo.id || 'no-id',
            characterType: isPhotoAvatar ? 'talking_photo' : 'avatar',
            talkingPhotoId: isPhotoAvatar ? avatarId : undefined,
            avatarId: !isPhotoAvatar ? avatarId : undefined,
          })
        }
        
        console.log('[Template Generation] Final nodes_override:', {
          avatarId,
          isPhotoAvatar,
          nodesCount: overrides.nodes_override.length,
          nodesOverride: JSON.stringify(overrides.nodes_override, null, 2),
        })
      }
    }

    // HeyGen template API only accepts boolean for caption, not an object
    const payload = {
      template_id: preference.templateId,
      variables,
      title: video.topic,
      caption: generateCaption ?? true, // Use boolean, not object
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    }

    console.log('[Template Generation] Calling HeyGen template API with payload:', {
      templateId: payload.template_id,
      variables: Object.keys(payload.variables),
      variableValues: payload.variables, // Log actual variable values for debugging
      hasOverrides: !!payload.overrides && Object.keys(payload.overrides).length > 0,
      overrides: payload.overrides ? JSON.stringify(payload.overrides, null, 2) : undefined,
      fullPayload: JSON.stringify(payload, null, 2), // Log full payload for debugging
    })

    const response = await generateVideoFromTemplate(payload)
    
    console.log('[Template Generation] Template video generation successful:', {
      videoId: video.id,
      heygenVideoId: response.video_id,
      status: response.status,
    })
    
    await applyManualGenerationSuccess(video.id, response)
    await updatePlanItemStatus(planItemId, response.status)
  } catch (error: any) {
    console.error('[Template Generation] Template generation error:', {
      error: error.message || error,
      errorResponse: error.response?.data,
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
    // Always use the hardcoded template for everyone
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

    // Always use template - it's hardcoded for everyone
    if (templatePreference) {
      console.log('[Video Generation] Attempting template generation:', {
        templateId: templatePreference.templateId,
        videoId: video.id,
        scriptKey: templatePreference.scriptKey,
        hasScript: !!scriptText,
        scriptLength: scriptText?.length || 0,
        avatarId: avatarId,
        isPhotoAvatar: isPhotoAvatar,
        hasAvatarId: !!avatarId,
      })
      
      // Try template generation (async, fire-and-forget with error handling)
      void runTemplateGeneration(video, templatePreference, scriptText, input.plan_item_id || null, avatarId, isPhotoAvatar, input.generate_caption).catch(
        (error: any) => {
          console.error('[Video Generation] Template generation failed; falling back to avatar-based generation:', {
            error: error?.message || error,
            errorStack: error?.stack,
            errorResponse: error?.response?.data,
            videoId: video.id,
            templateId: templatePreference.templateId,
            avatarId: avatarId,
            isPhotoAvatar: isPhotoAvatar,
          })
          // Fall back to regular generation
          void scheduleManualGeneration()
        }
      )
    } else {
      console.error('[Video Generation] ERROR: Template preference is null! This should never happen. Falling back to regular generation.')
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
