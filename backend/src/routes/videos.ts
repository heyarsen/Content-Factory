import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { VideoService } from '../services/videoService.js'

const router = Router()

function handleServiceError(res: Response, error: any, fallbackMessage: string) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message })
  }

  console.error(fallbackMessage, error)
  return res.status(500).json({ error: 'Internal server error' })
}

// Generate video
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, script, style, duration } = req.body
    const userId = req.userId!

    if (!topic || !style || !duration) {
      return res.status(400).json({ error: 'Topic, style, and duration are required' })
    }

    if (duration < 15 || duration > 180) {
      return res.status(400).json({ error: 'Duration must be between 15 and 180 seconds' })
    }

    const video = await VideoService.requestManualVideo(userId, {
      topic,
      script: script || undefined,
      style,
      duration,
    })

    res.json({ video })
  } catch (error: any) {
    handleServiceError(res, error, 'Generate video error:')
  }
})

// List videos
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined

    const videos = await VideoService.listVideos(userId, {
      status: status && status !== 'all' ? status : undefined,
      search,
    })

    res.json({ videos })
  } catch (error: any) {
    handleServiceError(res, error, 'List videos error:')
  }
})

// Get video by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const video = await VideoService.getVideoForUser(id, userId)

    if (!video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    res.json({ video })
  } catch (error: any) {
    handleServiceError(res, error, 'Get video error:')
  }
})

// Get video status
router.get('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const video = await VideoService.refreshVideoStatus(id, userId)

    if (!video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    res.json({ video })
  } catch (error: any) {
    handleServiceError(res, error, 'Get video status error:')
  }
})

// Delete video
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await VideoService.deleteVideo(id, userId)

    res.json({ message: 'Video deleted successfully' })
  } catch (error: any) {
    handleServiceError(res, error, 'Delete video error:')
  }
})

// Retry failed generation
router.post('/:id/retry', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await VideoService.retryVideo(id, userId)

    res.json({ message: 'Retry initiated' })
  } catch (error: any) {
    handleServiceError(res, error, 'Retry video error:')
  }
})

export default router

