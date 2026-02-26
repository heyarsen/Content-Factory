import express, { Response } from 'express'
import axios from 'axios'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CreditsService } from '../services/creditsService.js'

const router = express.Router()

const KIE_API_URL = 'https://api.kie.ai/api/v1'

type NanoBananaTier = 'nano-banana' | 'nano-banana-pro'

const NANO_BANANA_COSTS: Record<NanoBananaTier, number> = {
  'nano-banana': 0.5,
  'nano-banana-pro': 1,
}

router.use(authenticate)

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : ''
    const providerTier: NanoBananaTier = req.body.providerTier === 'nano-banana-pro' ? 'nano-banana-pro' : 'nano-banana'
    const imageSize = typeof req.body.image_size === 'string' ? req.body.image_size : '1:1'
    const outputFormat = typeof req.body.output_format === 'string' ? req.body.output_format : 'png'

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    if (!process.env.KIE_API_KEY) {
      return res.status(500).json({ error: 'Missing KIE API configuration' })
    }

    const cost = NANO_BANANA_COSTS[providerTier]
    const { hasSubscription, hasCredits, credits } = await CreditsService.hasEnoughCredits(userId, cost)
    if (!hasSubscription && !hasCredits) {
      return res.status(402).json({
        error: `Insufficient credits. You have ${credits ?? 0} credits but need ${cost} credits.`,
      })
    }

    let creditsDeducted = false

    try {
      await CreditsService.deductCredits(userId, cost, `NANO_BANANA_IMAGE_${providerTier.toUpperCase()}`)
      creditsDeducted = true

      const response = await axios.post(
        `${KIE_API_URL}/jobs/createTask`,
        {
          model: 'google/nano-banana',
          input: {
            prompt,
            image_size: imageSize,
            output_format: outputFormat,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.KIE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        },
      )

      const taskId = response.data?.data?.taskId
      if (!taskId) {
        throw new Error('Provider did not return a task ID')
      }

      return res.json({ taskId, providerTier, cost })
    } catch (error) {
      if (creditsDeducted) {
        await CreditsService.addCredits(userId, cost, 'Refund for failed Nano Banana image generation')
      }
      throw error
    }
  } catch (error: any) {
    console.error('[Nano Banana] Generate image error:', error.response?.data || error.message)
    return res.status(500).json({ error: error.response?.data?.msg || 'Failed to start image generation' })
  }
})

router.get('/status/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId
    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' })
    }

    if (!process.env.KIE_API_KEY) {
      return res.status(500).json({ error: 'Missing KIE API configuration' })
    }

    const response = await axios.get(`${KIE_API_URL}/jobs/recordInfo`, {
      params: { taskId },
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      },
      timeout: 45000,
    })

    return res.json(response.data)
  } catch (error: any) {
    console.error('[Nano Banana] Status error:', error.response?.data || error.message)
    return res.status(500).json({ error: error.response?.data?.msg || 'Failed to fetch image status' })
  }
})

export default router
