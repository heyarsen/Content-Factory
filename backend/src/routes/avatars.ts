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
import {
  saveUntrainedAvatarToTest,
  loadUntrainedAvatarsFromTest,
  getUntrainedAvatarFromTest,
  clearTestAvatars,
  syncUntrainedAvatarsFromDatabase,
} from '../lib/testFixtures.js'
const router = Router()

// Helper function to poll for look generation status and add looks when complete
async function pollLookGenerationStatus(generationId: string, groupId: string, lookName?: string): Promise<void> {
  const maxAttempts = 30 // Poll for up to 5 minutes (30 * 10 seconds)
  const pollInterval = 10000 // 10 seconds

  console.log(`[Generate Look] Starting background polling for generation ${generationId}`)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    try {
      const status = await checkGenerationStatus(generationId)
      console.log(`[Generate Look] Poll attempt ${attempt}/${maxAttempts} - Status:`, status)

      if (status.status === 'success') {
        console.log(`[Generate Look] ✅ Generation completed successfully!`, {
          generationId,
          groupId,
          imageCount: status.image_url_list?.length || 0,
        })

        // Now add the generated images as looks to the avatar group
        if (status.image_key_list && status.image_key_list.length > 0) {
          try {
            console.log(`[Generate Look] Adding ${status.image_key_list.length} generated images as looks to group ${groupId}`)

            const addLooksRequest: AddLooksRequest = {
              group_id: groupId,
              image_keys: status.image_key_list,
              name: lookName || `Generated Look ${new Date().toISOString().split('T')[0]}`,
            }

            const addLooksResult = await addLooksToAvatarGroup(addLooksRequest)
            console.log(`[Generate Look] ✅ Successfully added ${addLooksResult.photo_avatar_list?.length || 0} looks to avatar group!`, {
              groupId,
              lookIds: addLooksResult.photo_avatar_list?.map(l => l.id),
            })
          } catch (addError: any) {
            console.error(`[Generate Look] ❌ Failed to add generated images as looks:`, addError.response?.data || addError.message)
          }
        } else {
          console.warn(`[Generate Look] ⚠️ Generation succeeded but no image keys returned`)
        }
        return
      } else if (status.status === 'failed') {
        console.error(`[Generate Look] ❌ Generation failed:`, {
          generationId,
          groupId,
          error: status.msg,
        })
        return
      }
      // Status is still 'in_progress' or 'pending', continue polling
    } catch (error: any) {
      console.warn(`[Generate Look] Poll attempt ${attempt} failed:`, error.message)
      // Continue polling despite errors
    }
  }

  console.warn(`[Generate Look] ⚠️ Polling timed out after ${maxAttempts} attempts for generation ${generationId}`)
}

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

// Update avatar
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { avatar_name, gender } = req.body

    // Verify avatar ownership
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      return res.status(404).json({ error: 'Avatar not found' })
    }

    // Update avatar
    const updateData: any = {}
    if (avatar_name !== undefined) updateData.avatar_name = avatar_name
    if (gender !== undefined) updateData.gender = gender

    const { data: updatedAvatar, error: updateError } = await supabase
      .from('avatars')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return res.json({
      message: 'Avatar updated successfully',
      avatar: updatedAvatar,
    })
  } catch (error: any) {
    console.error('Update avatar error:', error)
    return res.status(500).json({ error: error.message || 'Failed to update avatar' })
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

    // Save untrained avatar to test fixtures for testing
    if (avatar && (avatar.status === 'training' || avatar.status === 'pending' || avatar.status === 'generating')) {
      saveUntrainedAvatarToTest(avatar, {
        photo_url: primaryPhotoUrl,
        additional_photo_urls: extraPhotoUrls,
        avatar_name: avatar_name,
      })
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

    // Save untrained avatar to test fixtures for testing
    if (data) {
      saveUntrainedAvatarToTest(data, request)
    }

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
    console.log('[Generation Status] Checking status for:', generationId)
    const status = await checkGenerationStatus(generationId)
    console.log('[Generation Status] Result:', status)

    return res.json(status)
  } catch (error: any) {
    console.error('Check generation status error:', error)
    console.error('Check generation status response:', error.response?.data)
    return res.status(500).json({
      error: error.message || 'Failed to check generation status',
      details: error.response?.data
    })
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

    // Log avatar info for debugging
    console.log('[Generate Look] Avatar from database:', avatar ? {
      id: avatar.id,
      heygen_avatar_id: avatar.heygen_avatar_id,
      default_look_id: avatar.default_look_id,
    } : 'not found')

    // IMPORTANT: Do NOT set photo_avatar_id
    // The group_id alone should be sufficient for HeyGen to generate a look
    // that matches the avatar's identity. Setting photo_avatar_id incorrectly
    // can cause HeyGen to generate looks from a different avatar.
    // 
    // The photo_avatar_id parameter is meant for using a specific look as
    // a style reference, not for identifying which avatar to use.
    console.log('[Generate Look] Using group_id only (no photo_avatar_id) to ensure correct avatar identity')

    // Check training status before generating look (with timeout)
    const { checkTrainingStatus } = await import('../lib/heygen.js')
    console.log('[Generate Look] Checking training status for group:', request.group_id)

    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Training status check timed out after 10s')), 10000)
      )

      const trainingStatus = await Promise.race([
        checkTrainingStatus(request.group_id),
        timeoutPromise
      ])

      console.log('[Generate Look] Training status result:', trainingStatus)
      if (trainingStatus.status !== 'ready') {
        if (trainingStatus.status === 'empty') {
          console.log('[Generate Look] Training status is empty, returning error')
          return res.status(400).json({
            error: 'Avatar group is not trained yet. Please wait for training to complete before generating looks.'
          })
        } else if (trainingStatus.status === 'failed') {
          console.log('[Generate Look] Training failed, returning error')
          return res.status(400).json({
            error: `Avatar training failed: ${trainingStatus.error_msg || 'Unknown error'}. Cannot generate looks.`
          })
        } else if (trainingStatus.status === 'training' || trainingStatus.status === 'pending') {
          console.log('[Generate Look] Training in progress, returning error')
          return res.status(400).json({
            error: `Avatar is still training (status: ${trainingStatus.status}). Please wait for training to complete before generating looks.`
          })
        }
      }
      console.log('[Generate Look] Training status is ready, proceeding with look generation')
    } catch (statusError: any) {
      // If we can't check status, log warning but continue (might work if training is complete)
      console.warn('[Generate Look] Failed to check training status:', statusError.message)
      console.warn('[Generate Look] Full error:', statusError)
      console.warn('[Generate Look] Will attempt to generate look anyway')
    }

    console.log('[Generate Look] Calling generateAvatarLook with request:', JSON.stringify(request, null, 2))

    try {
      const result = await generateAvatarLook(request)
      console.log('[Generate Look] Generation result:', result)

      // Start polling for generation status in the background
      // When complete, it will automatically add the generated images as looks
      if (result.generation_id) {
        const lookName = request.prompt || `Look ${new Date().toISOString().split('T')[0]}`
        pollLookGenerationStatus(result.generation_id, request.group_id, lookName).catch(err => {
          console.error('[Generate Look] Background polling failed:', err.message)
        })
      }

      return res.json({
        message: 'Look generation started',
        generation_id: result.generation_id,
      })
    } catch (genError: any) {
      console.error('[Generate Look] generateAvatarLook failed:', genError.message)
      console.error('[Generate Look] Full generation error:', genError)
      console.error('[Generate Look] Response data:', genError.response?.data)
      throw genError
    }
  } catch (error: any) {
    console.error('Generate look error:', error)

    // Provide more user-friendly error messages
    let errorMessage = error.message || 'Failed to generate look'
    let errorCode: string | undefined

    if (error.response?.data?.error) {
      const apiError = error.response.data.error
      if (typeof apiError === 'string') {
        errorMessage = apiError
      } else if (apiError.message) {
        errorMessage = apiError.message
        errorCode = apiError.code
        // Special handling for "Model not found" error
        if (apiError.message === 'Model not found' || apiError.code === 'invalid_parameter') {
          errorMessage = 'Avatar is not trained yet. Please wait for training to complete before generating looks.'
        }
      }
    }

    return res.status(error.response?.status || 500).json({
      error: errorMessage,
      code: errorCode
    })
  }
})

// Trigger training for an avatar that wasn't trained
router.post('/:id/train', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { supabase } = await import('../lib/supabase.js')

    // Get the avatar
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      return res.status(404).json({ error: 'Avatar not found' })
    }

    const groupId = avatar.heygen_avatar_id
    console.log('[Train Avatar] Starting training for avatar:', avatar.avatar_name, 'group:', groupId)

    // Check current training status
    const { checkTrainingStatus } = await import('../lib/heygen.js')
    const currentStatus = await checkTrainingStatus(groupId)
    console.log('[Train Avatar] Current training status:', currentStatus)

    if (currentStatus.status === 'ready') {
      // Update avatar status in database
      await supabase
        .from('avatars')
        .update({ status: 'active' })
        .eq('id', id)

      return res.json({
        message: 'Avatar is already trained and ready to use',
        status: 'ready'
      })
    }

    if (currentStatus.status === 'training' || currentStatus.status === 'pending') {
      return res.json({
        message: `Avatar is currently ${currentStatus.status}. Please wait for training to complete.`,
        status: currentStatus.status
      })
    }

    // Status is 'empty' or 'failed' - need to trigger training
    // First, we need to get the looks/photos for this avatar using the avatar_group endpoint
    const { default: axios } = await import('axios')
    const apiKey = process.env.HEYGEN_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'HeyGen API key not configured' })
    }

    let looks: any[] = []
    try {
      // Use the avatar_group endpoint which works for these avatars
      const looksResponse = await axios.get(
        `${process.env.HEYGEN_V2_API_URL || 'https://api.heygen.com/v2'}/avatar_group/${groupId}/avatars`,
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      )

      const avatarList =
        looksResponse.data?.data?.avatar_list ||
        looksResponse.data?.avatar_list ||
        looksResponse.data?.data ||
        []

      if (Array.isArray(avatarList)) {
        looks = avatarList.map((look: any) => ({
          id: look.id,
          name: look.name,
          status: look.status,
        }))
      }
      console.log('[Train Avatar] Found', looks.length, 'looks for avatar')
    } catch (detailsError: any) {
      console.warn('[Train Avatar] Could not get avatar looks:', detailsError.message)
      console.warn('[Train Avatar] Response:', detailsError.response?.data)
    }

    if (looks.length === 0) {
      return res.status(400).json({
        error: 'No photos found for this avatar. Please add photos before training.'
      })
    }

    // Use the default_look_id if set, otherwise use all looks
    let lookIds: string[]

    if (avatar.default_look_id) {
      // User has selected a specific look - use only that one
      console.log('[Train Avatar] Using selected look:', avatar.default_look_id)
      lookIds = [avatar.default_look_id]
    } else {
      // No specific look selected - use all ready looks
      console.log('[Train Avatar] No specific look selected, using all ready looks')
      lookIds = looks
        .filter((look: any) => look.status === 'uploaded' || look.status === 'ready' || !look.status)
        .map((look: any) => look.id)
    }

    if (lookIds.length === 0) {
      return res.status(400).json({
        error: 'No photos are ready for training. Please wait for photo upload to complete or select a look first.'
      })
    }

    console.log('[Train Avatar] Triggering training with look IDs:', lookIds)

    // Trigger training
    const HEYGEN_V2_API_URL = process.env.HEYGEN_V2_API_URL || 'https://api.heygen.com/v2'

    const trainResponse = await axios.post(
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

    console.log('[Train Avatar] Training started:', trainResponse.data)

    // Update avatar status to training
    await supabase
      .from('avatars')
      .update({ status: 'training' })
      .eq('id', id)

    return res.json({
      message: 'Training started successfully. This may take a few minutes.',
      status: 'training',
      data: trainResponse.data?.data || trainResponse.data,
    })
  } catch (error: any) {
    console.error('[Train Avatar] Error:', error)
    console.error('[Train Avatar] Response data:', error.response?.data)

    let errorMessage = error.message || 'Failed to start training'
    if (error.response?.data?.error) {
      errorMessage = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : error.response.data.error.message || JSON.stringify(error.response.data.error)
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

// Test fixtures endpoints for managing untrained avatars
// GET /avatars/test-fixtures - List all saved untrained avatars
router.get('/test-fixtures', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const avatars = loadUntrainedAvatarsFromTest()
    return res.json({
      count: avatars.length,
      avatars: avatars.map((item) => ({
        id: item.avatar.id,
        avatar_name: item.avatar.avatar_name,
        heygen_avatar_id: item.avatar.heygen_avatar_id,
        status: item.avatar.status,
        source: item.avatar.source,
        saved_at: item.saved_at,
      })),
    })
  } catch (error: any) {
    console.error('List test fixtures error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to list test fixtures',
    })
  }
})

// POST /avatars/test-fixtures/sync - Sync existing avatars from database to test fixtures
// Query param: ?all=false to only sync untrained avatars (default: true, syncs all user-created avatars)
router.post('/test-fixtures/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const allAvatars = req.query.all !== 'false' // Default to true, sync all user-created avatars
    const result = await syncUntrainedAvatarsFromDatabase(userId, allAvatars)
    
    return res.json({
      message: `Synced ${result.saved} avatars to test fixtures (${result.total} total found)`,
      saved_count: result.saved,
      total_count: result.total,
      by_status: result.byStatus,
      all_avatars: allAvatars,
    })
  } catch (error: any) {
    console.error('Sync test fixtures error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to sync test fixtures',
    })
  }
})

// GET /avatars/test-fixtures/:id - Get a specific test avatar
router.get('/test-fixtures/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const fixture = getUntrainedAvatarFromTest(id)

    if (!fixture) {
      return res.status(404).json({ error: 'Test avatar not found' })
    }

    return res.json(fixture)
  } catch (error: any) {
    console.error('Get test fixture error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to get test fixture',
    })
  }
})

// DELETE /avatars/test-fixtures - Clear all test avatars
router.delete('/test-fixtures', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    clearTestAvatars()
    return res.json({ message: 'Test avatars cleared successfully' })
  } catch (error: any) {
    console.error('Clear test fixtures error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to clear test fixtures',
    })
  }
})

export default router
