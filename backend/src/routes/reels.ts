import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { ReelService } from '../services/reelService.js'
import { VideoService } from '../services/videoService.js'
import { JobService } from '../services/jobService.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

router.use(authenticate)

// Get all reels for user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { status } = req.query
    
    let reels
    if (status === 'pending') {
      reels = await ReelService.getPendingReels(userId)
    } else {
      // Get all reels for user
      const { data, error } = await supabase
        .from('reels')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        throw new Error(error.message)
      }
      reels = data || []
    }
    
    return res.json({ reels })
  } catch (error: any) {
    console.error('Get reels error:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch reels' })
  }
})

// Get pending reels
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const reels = await ReelService.getPendingReels(userId)
    return res.json({ reels })
  } catch (error: any) {
    console.error('Get pending reels error:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch pending reels' })
  }
})

// Approve a reel (replaces Telegram confirm)
router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const reel = await ReelService.getReelById(id)
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' })
    }

    if (reel.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    if (reel.status !== 'pending') {
      return res.status(400).json({ error: `Reel is already ${reel.status}` })
    }

    // Approve reel
    const approvedReel = await ReelService.approveReel(id)

    // Schedule video generation
    await JobService.scheduleJob('video_generation', { reel_id: id })

    return res.json({ reel: approvedReel, message: 'Reel approved. Video generation started.' })
  } catch (error: any) {
    console.error('Approve reel error:', error)
    return res.status(500).json({ error: error.message || 'Failed to approve reel' })
  }
})

// Reject a reel (replaces Telegram cancel)
router.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const reel = await ReelService.getReelById(id)
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' })
    }

    if (reel.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    if (reel.status !== 'pending') {
      return res.status(400).json({ error: `Reel is already ${reel.status}` })
    }

    const rejectedReel = await ReelService.rejectReel(id)

    return res.json({ reel: rejectedReel, message: 'Reel rejected.' })
  } catch (error: any) {
    console.error('Reject reel error:', error)
    return res.status(500).json({ error: error.message || 'Failed to reject reel' })
  }
})

// Generate video for approved reel
router.post('/:id/generate-video', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const reel = await ReelService.getReelById(id)
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' })
    }

    if (reel.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    if (reel.status !== 'approved') {
      return res.status(400).json({ error: 'Reel must be approved before generating video' })
    }

    if (!reel.script) {
      return res.status(400).json({ error: 'Reel must have a script' })
    }

    // Generate video
    const videoData = await VideoService.generateVideoForReel(reel)

    // Update reel with video information
    await ReelService.updateReelVideo(id, {
      video_url: videoData.video_url ?? null,
      heygen_video_id: videoData.video_id,
      template: videoData.template?.id ?? null,
    })

    return res.json({ 
      message: 'Video generation started',
      video_id: videoData.video_id,
      video_url: videoData.video_url,
    })
  } catch (error: any) {
    console.error('Generate video error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate video' })
  }
})

// Get reel by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const reel = await ReelService.getReelById(id)
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' })
    }

    if (reel.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    return res.json({ reel })
  } catch (error: any) {
    console.error('Get reel error:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch reel' })
  }
})

export default router

