import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { AvatarService } from '../services/avatarService.js'
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

const router = Router()

// All routes require authentication
router.use(authenticate)

// Get all avatars for the current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const avatars = await AvatarService.getUserAvatars(userId)
    const defaultAvatar = await AvatarService.getDefaultAvatar(userId)

    return res.json({
      avatars,
      default_avatar_id: defaultAvatar?.id || null,
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

    await AvatarService.deleteAvatar(id, userId)

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
    const { photo_data, avatar_name } = req.body // photo_data is base64 data URL

    if (!photo_data || !avatar_name) {
      return res.status(400).json({ error: 'photo_data and avatar_name are required' })
    }

    // Convert base64 data URL to buffer
    let base64Data: string
    let mimeType: string
    
    if (photo_data.startsWith('data:')) {
      const match = photo_data.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        throw new Error('Invalid base64 data URL format')
      }
      mimeType = match[1]
      base64Data = match[2]
    } else {
      // Assume it's already base64 without data URL prefix
      base64Data = photo_data
      mimeType = 'image/jpeg'
    }
    
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Determine file extension from mime type
    let extension = 'jpg'
    if (mimeType.includes('png')) extension = 'png'
    else if (mimeType.includes('webp')) extension = 'webp'
    else if (mimeType.includes('gif')) extension = 'gif'
    
    const fileName = `avatars/${userId}/${Date.now()}-${avatar_name.replace(/[^a-z0-9]/gi, '_')}.${extension}`
    
    console.log('Processing image upload:', {
      fileName,
      mimeType,
      bufferSize: buffer.length,
      extension,
    })
    
    // Upload to Supabase Storage
    const { supabase } = await import('../lib/supabase.js')
    
    // Check if bucket exists first
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    
    if (bucketError) {
      console.error('Error checking buckets:', bucketError)
      // Continue anyway - might not have permission to list buckets, but can still try to upload
    }
    
    const bucketExists = buckets?.some(b => b.name === 'avatars')
    
    if (buckets && !bucketExists) {
      console.error('Avatars bucket does not exist. Please create it in Supabase Dashboard > Storage.')
      throw new Error('Storage bucket "avatars" does not exist. Please create it in Supabase Dashboard > Storage with public access. You can run the SQL migration file: database/migrations/006_avatars_storage_bucket.sql')
    }
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: mimeType || `image/${extension}`,
        upsert: false,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      if (uploadError.message?.includes('Bucket') || uploadError.message?.includes('not found')) {
        throw new Error(`Storage bucket "avatars" not found. Please create it in Supabase Dashboard > Storage with public access. Error: ${uploadError.message}`)
      }
      throw new Error(`Failed to upload image to storage: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const publicUrl = urlData?.publicUrl
    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image')
    }
    
    console.log('Image uploaded successfully, public URL:', publicUrl)

    // Create avatar using HeyGen API
    // Following the correct HeyGen API flow:
    // 1. Upload image to https://upload.heygen.com/v1/asset to get image_key
    // 2. Create Photo Avatar Group using image_key
    // 3. Optionally train the avatar group
    let avatar
    try {
      console.log('Creating avatar with HeyGen using photo URL:', publicUrl)
      avatar = await AvatarService.createAvatarFromPhoto(userId, publicUrl, avatar_name)
      console.log('Avatar created successfully with HeyGen:', avatar.id)
    } catch (heygenError: any) {
      console.error('HeyGen avatar creation failed:', heygenError)
      
      // Re-throw the error - we now use the correct API endpoint so errors should be meaningful
      throw heygenError
    }

    return res.status(201).json({
      message: 'Avatar creation started. It may take a few minutes to train.',
      avatar,
      photo_url: publicUrl,
    })
  } catch (error: any) {
    console.error('Upload photo and create avatar error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      name: error.name,
    })
    
    // Extract detailed error message
    let errorMessage = 'Failed to upload photo and create avatar'
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
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
      }
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
  try {
    const userId = req.userId!
    const request: GenerateAIAvatarRequest = req.body

    if (!request.name || !request.age || !request.gender || !request.ethnicity || !request.orientation || !request.pose || !request.style || !request.appearance) {
      return res.status(400).json({ error: 'All fields are required for AI avatar generation' })
    }

    const result = await generateAIAvatar(request)

    // Save generation_id to database for tracking
    const { supabase } = await import('../lib/supabase.js')
    await supabase
      .from('avatars')
      .insert({
        user_id: userId,
        heygen_avatar_id: result.generation_id,
        avatar_name: request.name,
        avatar_url: null,
        preview_url: null,
        thumbnail_url: null,
        gender: request.gender,
        status: 'generating',
        is_default: false,
      })

    return res.json({
      message: 'AI avatar generation started',
      generation_id: result.generation_id,
    })
  } catch (error: any) {
    console.error('Generate AI avatar error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate AI avatar' })
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

// Check training status
router.get('/training-status/:groupId', async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params
    const status = await checkTrainingStatus(groupId)

    return res.json(status)
  } catch (error: any) {
    console.error('Check training status error:', error)
    return res.status(500).json({ error: error.message || 'Failed to check training status' })
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

    const result = await generateAvatarLook(request)

    return res.json({
      message: 'Look generation started',
      generation_id: result.generation_id,
    })
  } catch (error: any) {
    console.error('Generate look error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate look' })
  }
})

export default router
