import { Router, Response } from 'express'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { VideoService } from '../services/videoService.js'
import { detectLanguage, enhancePromptWithLanguage } from '../lib/languageDetection.js'
import { enforceScriptWordLimit, getMaxWordsForDuration } from '../lib/scriptLimits.js'
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
    const { topic, script, style, duration, avatar_id, talking_photo_id, generate_caption, aspect_ratio, dimension, language, generateScript, description } = req.body
    const userId = req.userId!
    const durationSeconds = Number(duration) || 60

    // Detect language from topic and script if not explicitly provided
    const textToAnalyze = script || topic || description || ''
    const detectedLanguage = language || await detectLanguage(textToAnalyze)

    console.log('Video generation request:', {
      userId,
      hasTopic: !!topic,
      hasScript: !!script,
      hasDescription: !!description,
      generateScript,
      style,
      duration,
      avatar_id,
      talking_photo_id,
      generate_caption,
      aspect_ratio,
      dimension,
      detectedLanguage: detectedLanguage.language,
      confidence: detectedLanguage.confidence,
    })

    // Validate required fields
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Topic is required' })
    }

    // If generateScript is true, we need to generate a script first
    let finalScript = script?.trim() || null
    const provider = req.body.provider || 'sora'

    if (generateScript && !finalScript && provider !== 'sora') {
      // Generate script using OpenAI
      const scriptPrompt = `
Create a 10-second video script that is engaging, specific, and has personality. 

TOPIC: ${topic}
DETAILS: ${description || 'No additional details provided'}

SCRIPT REQUIREMENTS:
- Between 40-45 words total (fits in 15 seconds when spoken naturally)
- Start with a shocking question, surprising fact, or bold statement
- Include 1-2 specific tips or examples (keep it concise)
- Add personality with conversational, energetic tone
- Include at least one surprising element or "wow" factor
- End with "Follow for daily tips!"
- Use simple, punchy sentences - no complex words or long phrases

FORMAT: Write as a continuous spoken script without timing cues. Make it sound like you're talking to a friend.
`

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert short-form video script writer for TikTok, Instagram Reels, and YouTube Shorts."
          },
          {
            role: "user",
            content: scriptPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })

      finalScript = completion.choices[0]?.message?.content?.trim() || null
    } else if (generateScript && !finalScript && provider === 'sora') {
      // For Sora "Direct to Sora", we skip OpenAI pre-generation
      // and let Sora's service handle the combined prompt
      console.log('[Videos Route] Direct to Sora: Skipping OpenAI script generation')
      finalScript = description?.trim() || null
    }

    if (finalScript) {
      const maxWords = getMaxWordsForDuration(durationSeconds)
      const { script: trimmedScript, wasTrimmed, wordCount, maxCharacters, characterCount } =
        enforceScriptWordLimit(finalScript, durationSeconds)

      if (script && (wordCount > maxWords || characterCount > maxCharacters)) {
        return res.status(400).json({
          error: `Script is too long for a ${durationSeconds}s video. Please keep it under ${maxWords} words or ${maxCharacters} characters.`,
        })
      }

      if (wasTrimmed) {
        console.warn('[Videos Route] Script trimmed to fit duration.', {
          userId,
          durationSeconds,
          maxWords,
          maxCharacters,
          originalWordCount: wordCount,
          originalCharacterCount: characterCount,
        })
        finalScript = trimmedScript
      }
    }

    // Create the video using VideoService (which handles credit deduction)
    const video = await VideoService.requestManualVideo(userId, {
      topic: topic.trim(),
      script: finalScript,
      style: style || 'Realistic',
      duration: durationSeconds,
      avatar_id: avatar_id || null,
      talking_photo_id: talking_photo_id || null,
      generate_caption: generate_caption || false,
      aspect_ratio: aspect_ratio || null,
      dimension: dimension || null,
      provider: 'sora', // Always use Sora
      output_resolution: undefined,
      detectedLanguage, // Pass detected language
    })

    console.log('✅ Video generation initiated successfully:', {
      videoId: video.id,
      topic: video.topic,
      status: video.status,
    })

    res.json({
      success: true,
      video,
      videoId: video.id, // Add videoId for frontend compatibility
      message: 'Video generation initiated successfully',
    })
  } catch (error: any) {
    console.error('Video generation error:', {
      error: error?.message || error,
      stack: error?.stack,
      userId: req.userId,
    })

    // Return appropriate error response
    const errorMessage = error?.message || 'Video generation failed'
    res.status(500).json({ error: errorMessage })
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
