import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { VideoService } from '../services/videoService.js'
import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const router = Router()

function handleServiceError(res: Response, error: any, fallbackMessage: string) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message })
  }

  console.error(fallbackMessage, error)
  
  // Extract meaningful error message
  const errorMessage = 
    error?.message || 
    error?.response?.data?.message || 
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    (typeof error === 'string' ? error : 'Internal server error')
  
  return res.status(500).json({ error: errorMessage })
}

// Generate video
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('✅ Video generation endpoint hit!', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    userId: req.userId,
    bodyKeys: Object.keys(req.body || {}),
  })
  
  try {
    const { topic, script, style, duration, avatar_id, talking_photo_id, look_id, generate_caption, aspect_ratio, dimension } = req.body
    const userId = req.userId!
    
    console.log('Video generation request:', {
      userId,
      hasTopic: !!topic,
      hasScript: !!script,
      scriptLength: script?.length,
      style,
      duration,
      avatar_id,
      talking_photo_id,
      look_id,
      generate_caption,
    })

    if (!topic || !style || !duration) {
      return res.status(400).json({ error: 'Topic, style, and duration are required' })
    }

    if (duration < 15 || duration > 180) {
      return res.status(400).json({ error: 'Duration must be between 15 and 180 seconds' })
    }

    // Check and deduct credits
    const { CreditsService } = await import('../services/creditsService.js')
    try {
      await CreditsService.checkAndDeduct(userId, CreditsService.COSTS.VIDEO_GENERATION, 'video generation')
    } catch (creditError: any) {
      return res.status(402).json({ error: creditError.message || 'Insufficient credits' })
    }

    const video = await VideoService.requestManualVideo(userId, {
      topic,
      script: script || undefined,
      style,
      duration,
      avatar_id: avatar_id || undefined,
      talking_photo_id: talking_photo_id || look_id || undefined,
      generate_caption: generate_caption !== false, // Default to true if not specified
      aspect_ratio: typeof aspect_ratio === 'string' ? aspect_ratio : undefined,
      dimension: typeof dimension === 'object' ? dimension : undefined,
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

// Generate social media description
router.post('/:id/generate-description', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { topic, script } = req.body

    // Verify video exists and belongs to user
    const video = await VideoService.getVideoForUser(id, userId)
    if (!video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    if (!topic && !script) {
      return res.status(400).json({ error: 'Topic or script is required' })
    }

    const prompt = `Generate a compelling social media caption/description for a short video post. 

${topic ? `Topic: ${topic}` : ''}
${script ? `Script: ${script.substring(0, 500)}` : ''}

Requirements:
- Engaging and click-worthy
- Include relevant hashtags (3-5)
- Platform-optimized (works for Instagram, TikTok, YouTube Shorts, etc.)
- 100-200 characters for the main caption
- Include a call-to-action
- Professional but approachable tone

Output ONLY the caption text, nothing else.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a social media content writer specializing in video captions for short-form content platforms.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    })

    const description = completion.choices[0]?.message?.content?.trim() || ''

    res.json({ description })
  } catch (error: any) {
    handleServiceError(res, error, 'Generate description error:')
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

// Get sharable video URL
router.post('/:id/share', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const video = await VideoService.getVideoForUser(id, userId)
    if (!video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    if (!video.heygen_video_id) {
      return res.status(400).json({ error: 'Video does not have a HeyGen video ID' })
    }

    const { getSharableVideoUrl } = await import('../lib/heygen.js')
    const { share_url } = await getSharableVideoUrl(video.heygen_video_id)

    res.json({ share_url })
  } catch (error: any) {
    handleServiceError(res, error, 'Get sharable URL error:')
  }
})

export default router

