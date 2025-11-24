import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { AvatarService } from '../services/avatarService.js'
import type { Avatar } from '../services/avatarService.js'
import {
  generateAIAvatar,
  checkGenerationStatus,
  addLooksToAvatarGroup,
  checkTrainingStatus,
  generateAvatarLook,
  type GenerateAIAvatarRequest,
  type AddLooksRequest,
  type GenerateLookRequest,
} from '../lib/heygen.js'
import {
  assignAvatarSource,
  executeWithAvatarSourceFallback,
} from '../lib/avatarSourceColumn.js'
const router = Router()

// All routes require authentication
router.use(authenticate)

// Get all avatars for the current user
// Query parameter: ?all=true to show all avatars (including synced from HeyGen)
// By default, only shows user-created avatars
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const showAll = req.query.all === 'true'
    
    // Default to showing only user-created avatars unless ?all=true is specified
    const avatars = showAll 
      ? await AvatarService.getUserAvatars(userId)
      : await AvatarService.getUserCreatedAvatars(userId)
    
    // Get default avatar (only from user-created avatars)
    const defaultAvatar = showAll 
      ? await AvatarService.getDefaultAvatar(userId)
      : (await AvatarService.getUserCreatedAvatars(userId)).find(a => a.is_default) || null

    return res.json({
      avatars,
      default_avatar_id: defaultAvatar?.id || null,
      only_created: !showAll,
    })
  } catch (error: any) {
    console.error('Get avatars error:', error)
    return res.status(500).json({ error: error.message || 'Failed to get avatars' })
  }
})

// Sync avatars from HeyGen API
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const avatars = await AvatarService.syncAvatarsFromHeyGen(userId)

    return res.json({
      message: 'Avatars synced successfully',
      avatars,
      count: avatars.length,
    })
  } catch (error: any) {
    console.error('Sync avatars error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    })
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to sync avatars'
    if (error.message?.includes('HEYGEN_KEY') || error.message?.includes('Missing')) {
      errorMessage = 'HeyGen API key is not configured. Please set HEYGEN_KEY environment variable.'
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid HeyGen API key. Please check your HEYGEN_KEY environment variable.'
    } else if (error.response?.status === 404) {
      errorMessage = 'HeyGen avatar endpoint not found. The API endpoint may have changed. Please check HeyGen API documentation.'
    }
    
    return res.status(500).json({ error: errorMessage })
  }
})

// Get default avatar
router.get('/default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const avatar = await AvatarService.getDefaultAvatar(userId)

    if (!avatar) {
      return res.status(404).json({ error: 'No default avatar set' })
    }

    return res.json({ avatar })
  } catch (error: any) {
    console.error('Get default avatar error:', error)
    return res.status(500).json({ error: error.message || 'Failed to get default avatar' })
  }
})

// Set default avatar
router.post('/:id/set-default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const avatar = await AvatarService.setDefaultAvatar(id, userId)

    return res.json({
      message: 'Default avatar updated',
      avatar,
    })
  } catch (error: any) {
    console.error('Set default avatar error:', error)
    if (error.message === 'Avatar not found') {
      return res.status(404).json({ error: error.message })
    }
    return res.status(500).json({ error: error.message || 'Failed to set default avatar' })
  }
})

// Add avatar from HeyGen
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { heygen_avatar_id } = req.body

    if (!heygen_avatar_id) {
      return res.status(400).json({ error: 'heygen_avatar_id is required' })
    }

    const avatar = await AvatarService.addAvatarFromHeyGen(userId, heygen_avatar_id)

    return res.status(201).json({
      message: 'Avatar added successfully',
      avatar,
    })
  } catch (error: any) {
    console.error('Add avatar error:', error)
    return res.status(500).json({ error: error.message || 'Failed to add avatar' })
  }
})

// Delete avatar
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const removeRemote =
      req.query.remove_remote === 'true' ||
      req.body?.remove_remote === true

    await AvatarService.deleteAvatar(id, userId, { removeRemote })

    return res.status(204).send()
  } catch (error: any) {
    console.error('Delete avatar error:', error)
    if (error.message === 'Avatar not found') {
      return res.status(404).json({ error: error.message })
    }
    if (error.message.includes('default avatar')) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(500).json({ error: error.message || 'Failed to delete avatar' })
  }
})

// Upload photo to storage and create avatar
router.post('/upload-photo', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { photo_data, photo_url, avatar_name, additional_photos } = req.body

    console.log('Upload photo request received:', {
      hasPhotoData: !!photo_data,
      hasPhotoUrl: !!photo_url,
      avatarName: avatar_name,
      userId,
      additionalPhotosCount: Array.isArray(additional_photos) ? additional_photos.length : 0,
    })

    if (!avatar_name || typeof avatar_name !== 'string') {
      return res.status(400).json({ error: 'avatar_name is required' })
    }

    const primaryInput: string | null =
      typeof photo_data === 'string' && photo_data.length > 0
        ? photo_data
        : typeof photo_url === 'string' && photo_url.length > 0
          ? photo_url
          : null

    if (!primaryInput) {
      return res.status(400).json({ error: 'photo_data (base64) or photo_url is required' })
    }

    const { supabase } = await import('../lib/supabase.js')

    const ensureBucketReady = async () => {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
      if (bucketError) {
        console.error('Error checking buckets:', bucketError)
        return
      }
      const bucketExists = buckets?.some((b) => b.name === 'avatars')
      if (buckets && !bucketExists) {
        console.error('Avatars bucket does not exist. Please create it in Supabase Dashboard > Storage.')
        throw new Error(
          'Storage bucket "avatars" does not exist. Please create it in Supabase Dashboard > Storage with public access. You can run the SQL migration file: database/migrations/006_avatars_storage_bucket.sql'
        )
      }
    }

    await ensureBucketReady()

    const uploadBase64Photo = async (dataUrl: string, label: string): Promise<string> => {
      const base64Regex = /^data:([^;]+);base64,(.+)$/
      const match = dataUrl.match(base64Regex)
      if (!match) {
        throw new Error('photo_data must be a base64-encoded data URL (e.g., data:image/jpeg;base64,...)')
      }
      let mimeType = match[1]
      const base64Data = match[2]
      let buffer: Buffer = Buffer.from(base64Data, 'base64')

      const normalizedMime = (mimeType || '').toLowerCase()
    let extension = 'jpg'
      if (normalizedMime.includes('png')) extension = 'png'
      else if (normalizedMime.includes('webp')) extension = 'webp'
    
      const safeLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'avatar'
      const fileName = `avatars/${userId}/${Date.now()}-${safeLabel}-${Math.random().toString(36).slice(2, 8)}.${extension}`
    
    console.log('Processing image upload:', {
      fileName,
      mimeType,
      bufferSize: buffer.length,
      extension,
    })
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, buffer, {
        contentType: mimeType || `image/${extension}`,
        upsert: false,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      if (uploadError.message?.includes('Bucket') || uploadError.message?.includes('not found')) {
          throw new Error(
            `Storage bucket "avatars" not found. Please create it in Supabase Dashboard > Storage with public access. Error: ${uploadError.message}`
          )
      }
      throw new Error(`Failed to upload image to storage: ${uploadError.message}`)
    }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    const publicUrl = urlData?.publicUrl
    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image')
    }
    
    console.log('Image uploaded successfully, public URL:', publicUrl)
      return publicUrl
    }

    const processPhotoInput = async (input: string, label: string): Promise<string> => {
      if (typeof input !== 'string' || input.trim().length === 0) {
        throw new Error('Invalid photo input')
      }
      if (/^https?:\/\//i.test(input.trim())) {
        return input.trim()
      }
      // Assume it's a base64 data URL
      return uploadBase64Photo(input, label)
    }

    const primaryPhotoUrl = await processPhotoInput(primaryInput, avatar_name)

    const extraPhotoUrls: string[] = []
    if (Array.isArray(additional_photos)) {
      for (const [index, extra] of additional_photos.entries()) {
        if (typeof extra !== 'string' || extra.trim().length === 0) continue
        try {
          const extraUrl = await processPhotoInput(extra, `${avatar_name}_extra_${index + 1}`)
          extraPhotoUrls.push(extraUrl)
        } catch (extraErr: any) {
          console.warn(
            `Failed to process additional photo #${index + 1}:`,
            extraErr?.message || extraErr
          )
        }
      }
    }

    let avatar
    let autoLookResult: { type: 'ai_generation' | 'photo_look'; id: string } | null = null
    try {
      console.log('Creating avatar with HeyGen using photo URL:', primaryPhotoUrl, {
        additionalPhotos: extraPhotoUrls.length,
      })
      avatar = await AvatarService.createAvatarFromPhoto(userId, primaryPhotoUrl, avatar_name, extraPhotoUrls)
      console.log('Avatar created successfully with HeyGen:', avatar.id)
      autoLookResult = await AvatarService.autoGenerateVerticalLook(
        avatar.heygen_avatar_id,
        primaryPhotoUrl,
        avatar_name
      )
    } catch (heygenError: any) {
      console.error('HeyGen avatar creation failed:', {
        message: heygenError?.message,
        stack: heygenError?.stack,
        response: heygenError?.response?.data,
        status: heygenError?.response?.status,
        name: heygenError?.name,
        code: heygenError?.code,
      })
      
      throw heygenError
    }

    return res.status(201).json({
      message: 'Avatar created successfully. Training has completed and the avatar is ready to use.',
      avatar,
      photo_url: primaryPhotoUrl,
      additional_photo_urls: extraPhotoUrls,
      auto_look: autoLookResult
        ? {
            type: autoLookResult.type,
            id: autoLookResult.id,
            note:
              autoLookResult.type === 'ai_generation'
                ? 'AI-generated 9:16 look is being created based on your photo. This may take a few minutes.'
                : 'Photo added as look.',
          }
        : null,
    })
  } catch (error: any) {
    // Log full error details for debugging
    console.error('Upload photo and create avatar error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      name: error.name,
      code: error.code,
      fullError: error,
    })
    
    // Extract detailed error message
    let errorMessage = 'Failed to upload photo and create avatar'
    
    // Try to get the most specific error message
    if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : JSON.stringify(error.response.data.error)
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    if (/no valid image/i.test(errorMessage)) {
      errorMessage =
        'HeyGen could not use this photo (usually because the face is blurry, too dark, or out of frame). Try a brighter front-facing selfie on a plain background.'
    }
    
    // Add more context if available
    if (error.response?.status) {
      if (error.response.status === 404) {
        if (errorMessage.includes('bucket') || errorMessage.includes('Bucket')) {
          errorMessage = 'Storage bucket "avatars" not found. Please create it in Supabase Dashboard > Storage with public access.'
        } else {
          errorMessage = `HeyGen API endpoint not found (404). Error: ${errorMessage}`
        }
      } else if (error.response.status === 401) {
        errorMessage = 'HeyGen API authentication failed. Please check your HEYGEN_KEY environment variable.'
      } else if (error.response.status === 403) {
        errorMessage = 'Access denied. Please check your HeyGen API key permissions.'
      } else if (error.response.status === 400) {
        errorMessage = `Invalid request: ${errorMessage}`
      }
    }
    
    // Include more details in development
    const statusCode = error.response?.status || 500
    return res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        originalMessage: error.message,
        stack: error.stack,
        responseData: error.response?.data,
      } : undefined,
    })
  }
})

// Create avatar from photo (legacy - accepts photo_url)
router.post('/create-from-photo', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { photo_url, avatar_name } = req.body

    if (!photo_url || !avatar_name) {
      return res.status(400).json({ error: 'photo_url and avatar_name are required' })
    }

    const avatar = await AvatarService.createAvatarFromPhoto(userId, photo_url, avatar_name)

    return res.status(201).json({
      message: 'Avatar creation started. It may take a few minutes to train.',
      avatar,
    })
  } catch (error: any) {
    console.error('Create avatar from photo error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    })
    
    const errorMessage = 
      error.message || 
      error.response?.data?.message ||
      'Failed to create avatar from photo'
    
    return res.status(500).json({ error: errorMessage })
  }
})

// Generate AI Avatar
router.post('/generate-ai', async (req: AuthRequest, res: Response) => {
  console.log('✅ Generate AI avatar endpoint hit!', {
    method: req.method,
    path: req.path,
    userId: req.userId,
    bodyKeys: Object.keys(req.body || {}),
  })
  
  try {
    const userId = req.userId!
    const request: GenerateAIAvatarRequest = req.body

    console.log('Generate AI avatar request:', {
      userId,
      hasName: !!request.name,
      hasAge: !!request.age,
      hasGender: !!request.gender,
      hasEthnicity: !!request.ethnicity,
      hasOrientation: !!request.orientation,
      hasPose: !!request.pose,
      hasStyle: !!request.style,
      hasAppearance: !!request.appearance,
    })

    if (!request.name || !request.age || !request.gender || !request.ethnicity || !request.orientation || !request.pose || !request.style || !request.appearance) {
      return res.status(400).json({ error: 'All fields are required for AI avatar generation' })
    }

    const result = await generateAIAvatar(request)

    console.log('HeyGen AI avatar generation response:', result)

    // Save generation_id to database for tracking
    const { supabase } = await import('../lib/supabase.js')
    const avatarPayload = {
      user_id: userId,
      heygen_avatar_id: result.generation_id,
      avatar_name: request.name,
      avatar_url: null,
      preview_url: null,
      thumbnail_url: null,
      gender: request.gender,
      status: 'generating',
      is_default: false,
    }

    assignAvatarSource(avatarPayload, 'ai_generated')

    const { data, error } = await executeWithAvatarSourceFallback<Avatar>(
      avatarPayload,
      () =>
        supabase
          .from('avatars')
          .insert(avatarPayload)
          .select()
          .single()
    )

    if (error) {
      console.error('Failed to save avatar generation to database:', error)
      throw new Error(`Failed to save avatar generation: ${error.message}`)
    }

    console.log('Avatar generation saved to database:', data?.id)

    return res.json({
      message: 'AI avatar generation started',
      generation_id: result.generation_id,
    })
  } catch (error: any) {
    console.error('Generate AI avatar error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
    })
    
    let errorMessage = 'Failed to generate AI avatar'
    
    if (error.response?.status === 404) {
      errorMessage = 'HeyGen AI avatar generation endpoint not found (404). The API endpoint may have changed or the feature may not be available in your HeyGen plan.'
    } else if (error.response?.status === 401) {
      errorMessage = 'HeyGen API authentication failed. Please check your HEYGEN_KEY environment variable.'
    } else if (error.response?.status === 403) {
      errorMessage = 'Access denied. AI avatar generation may not be available in your HeyGen plan.'
    } else if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : JSON.stringify(error.response.data.error)
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return res.status(error.response?.status || 500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        originalMessage: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
      } : undefined,
    })
  }
})

// Check generation status
router.get('/generation-status/:generationId', async (req: AuthRequest, res: Response) => {
  try {
    const { generationId } = req.params
    const status = await checkGenerationStatus(generationId)

    return res.json(status)
  } catch (error: any) {
    console.error('Check generation status error:', error)
    return res.status(500).json({ error: error.message || 'Failed to check generation status' })
  }
})

// Complete AI avatar generation (create avatar group from generated images)
router.post('/complete-ai-generation', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { generation_id, image_keys, avatar_name, image_urls } = req.body

    if (!generation_id || !image_keys || !Array.isArray(image_keys) || image_keys.length === 0 || !avatar_name) {
      return res.status(400).json({ error: 'generation_id, image_keys array, and avatar_name are required' })
    }

    const avatar = await AvatarService.completeAIAvatarGeneration(
      userId,
      generation_id,
      image_keys,
      avatar_name,
      image_urls
    )

    return res.json({
      message: 'AI avatar created successfully',
      avatar,
    })
  } catch (error: any) {
    console.error('Complete AI generation error:', error)
    return res.status(500).json({ error: error.message || 'Failed to complete AI avatar generation' })
  }
})

// Check training status
router.get('/training-status/:groupId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { groupId } = req.params
    const status = await checkTrainingStatus(groupId)
    const normalizedStatus = status.status === 'ready' ? 'active' : status.status

    try {
      const { supabase } = await import('../lib/supabase.js')
      await supabase
        .from('avatars')
        .update({
          status: normalizedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('heygen_avatar_id', groupId)
    } catch (dbError) {
      console.warn('Failed to persist training status locally:', dbError)
    }

    return res.json(status)
  } catch (error: any) {
    console.error('Check training status error:', error)
    return res.status(500).json({ error: error.message || 'Failed to check training status' })
  }
})

// Photo avatar details
router.get('/:avatarId/details', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { avatarId } = req.params
    const details = await AvatarService.fetchPhotoAvatarDetails(avatarId, userId)

    return res.json(details)
  } catch (error: any) {
    console.error('Get avatar details error:', error)
    if (error.message === 'Avatar not found') {
      return res.status(404).json({ error: error.message })
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch avatar details' })
  }
})

// Set default look for avatar
router.post('/:avatarId/set-default-look', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { avatarId } = req.params
    const { look_id } = req.body

    if (!look_id) {
      return res.status(400).json({ error: 'look_id is required' })
    }

    // Verify avatar ownership
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, user_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      return res.status(404).json({ error: 'Avatar not found' })
    }

    // Update the default_look_id
    const { error: updateError } = await supabase
      .from('avatars')
      .update({ default_look_id: look_id })
      .eq('id', avatarId)
      .eq('user_id', userId)

    if (updateError) {
      throw updateError
    }

    return res.json({
      message: 'Default look updated successfully',
      default_look_id: look_id,
    })
  } catch (error: any) {
    console.error('Set default look error:', error)
    return res.status(500).json({ error: error.message || 'Failed to set default look' })
  }
})

// Delete look from avatar
router.delete('/:avatarId/looks/:lookId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { avatarId, lookId } = req.params

    // Verify avatar ownership
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, user_id, default_look_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      return res.status(404).json({ error: 'Avatar not found' })
    }

    // Prevent deleting the selected/default look
    if (avatar.default_look_id === lookId) {
      return res.status(400).json({ error: 'Cannot delete the selected look. Please select a different look first.' })
    }

    // Delete look from HeyGen
    const { deletePhotoAvatar } = await import('../lib/heygen.js')
    await deletePhotoAvatar(lookId)

    return res.json({
      message: 'Look deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete look error:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete look' })
  }
})

// Upscale photo avatar
router.post('/:avatarId/upscale', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { avatarId } = req.params
    const result = await AvatarService.upscaleAvatar(avatarId, userId)

    return res.json({
      message: 'Upscale requested successfully',
      result,
    })
  } catch (error: any) {
    console.error('Upscale avatar error:', error)
    if (error.message === 'Avatar not found') {
      return res.status(404).json({ error: error.message })
    }
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to upscale avatar',
    })
  }
})

// Add looks to avatar group
router.post('/add-looks', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const request: AddLooksRequest = req.body

    if (!request.group_id || !request.image_keys || !Array.isArray(request.image_keys) || request.image_keys.length === 0) {
      return res.status(400).json({ error: 'group_id and image_keys array are required' })
    }

    const result = await addLooksToAvatarGroup(request)

    // Sync the new looks to database
    await AvatarService.syncAvatarsFromHeyGen(userId)

    return res.json({
      message: 'Looks added successfully',
      photo_avatar_list: result.photo_avatar_list,
    })
  } catch (error: any) {
    console.error('Add looks error:', error)
    return res.status(500).json({ error: error.message || 'Failed to add looks' })
  }
})

// Generate additional look for avatar group
router.post('/generate-look', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const request: GenerateLookRequest = req.body

    if (!request.group_id || !request.prompt || !request.orientation || !request.pose || !request.style) {
      return res.status(400).json({ error: 'All fields are required for look generation' })
    }

    // Get the avatar to find the default look
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar } = await supabase
      .from('avatars')
      .select('id, default_look_id, heygen_avatar_id')
      .eq('heygen_avatar_id', request.group_id)
      .eq('user_id', userId)
      .single()

    // Use the default look as the base photo_avatar_id if available
    if (avatar?.default_look_id) {
      request.photo_avatar_id = avatar.default_look_id
      console.log('[Generate Look] Using default look as base:', avatar.default_look_id)
    }

    // Check training status before generating look
    const { checkTrainingStatus } = await import('../lib/heygen.js')
    try {
      const trainingStatus = await checkTrainingStatus(request.group_id)
      if (trainingStatus.status !== 'ready') {
        if (trainingStatus.status === 'empty') {
          return res.status(400).json({ 
            error: 'Avatar group is not trained yet. Please wait for training to complete before generating looks.' 
          })
        } else if (trainingStatus.status === 'failed') {
          return res.status(400).json({ 
            error: `Avatar training failed: ${trainingStatus.error_msg || 'Unknown error'}. Cannot generate looks.` 
          })
        } else if (trainingStatus.status === 'training' || trainingStatus.status === 'pending') {
          return res.status(400).json({ 
            error: `Avatar is still training (status: ${trainingStatus.status}). Please wait for training to complete before generating looks.` 
          })
        }
      }
    } catch (statusError: any) {
      // If we can't check status, log warning but continue (might work if training is complete)
      console.warn('[Generate Look] Failed to check training status:', statusError.message)
    }

    console.log('[Generate Look] Request:', request)
    const result = await generateAvatarLook(request)

    return res.json({
      message: 'Look generation started',
      generation_id: result.generation_id,
    })
  } catch (error: any) {
    console.error('Generate look error:', error)
    
    // Provide more user-friendly error messages
    let errorMessage = error.message || 'Failed to generate look'
    if (error.response?.data?.error) {
      const apiError = error.response.data.error
      if (typeof apiError === 'string') {
        errorMessage = apiError
      } else if (apiError.message) {
        errorMessage = apiError.message
        // Special handling for "Model not found" error
        if (apiError.message === 'Model not found' || apiError.code === 'invalid_parameter') {
          errorMessage = 'Avatar is not trained yet. Please wait for training to complete before generating looks.'
        }
      }
    }
    
    return res.status(error.response?.status || 500).json({ error: errorMessage })
  }
})

// Upload look image to HeyGen and get image_key
router.post('/upload-look-image', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { photo_data } = req.body // photo_data is base64 data URL

    if (!photo_data) {
      return res.status(400).json({ error: 'photo_data is required' })
    }

    // Import uploadImageToHeyGen function
    const { uploadImageToHeyGen } = await import('../lib/heygen.js')
    
    // Upload to HeyGen and get image_key
    const imageKey = await uploadImageToHeyGen(photo_data)

    return res.json({
      image_key: imageKey,
    })
  } catch (error: any) {
    console.error('Upload look image error:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to upload look image' 
    })
  }
})

export default router
