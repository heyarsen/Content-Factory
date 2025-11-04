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
    console.error('Sync avatars error:', error)
    return res.status(500).json({ error: error.message || 'Failed to sync avatars' })
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

export default router
