import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { AvatarService } from '../services/avatarService.js'

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
    const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Determine file extension from data URL
    const mimeMatch = photo_data.match(/data:image\/(\w+);base64/)
    const extension = mimeMatch ? mimeMatch[1] : 'jpg'
    const fileName = `avatars/${userId}/${Date.now()}-${avatar_name.replace(/[^a-z0-9]/gi, '_')}.${extension}`
    
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
        contentType: `image/${extension}`,
        upsert: false,
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

    // Create avatar using the public URL
    console.log('Creating avatar with HeyGen using URL:', publicUrl)
    const avatar = await AvatarService.createAvatarFromPhoto(userId, publicUrl, avatar_name)
    console.log('Avatar created successfully:', avatar.id)

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
    })
    
    const errorMessage = 
      error.message || 
      error.response?.data?.message ||
      'Failed to upload photo and create avatar'
    
    return res.status(500).json({ error: errorMessage })
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

export default router
