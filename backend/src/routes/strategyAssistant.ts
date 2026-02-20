import { Router, Response } from 'express'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { generateStrategyGuide, Platform, ToneOption } from '../services/strategyAssistantService.js'

const router = Router()

const VALID_PLATFORMS: Platform[] = ['x', 'linkedin', 'instagram']
const VALID_TONES: ToneOption[] = ['professional', 'conversational', 'bold', 'playful']

router.post('/guide', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const {
      goals = '',
      audience = '',
      offer = '',
      concept = '',
      draftContent = '',
      callToAction = '',
      platform = 'linkedin',
      tone = 'professional',
      targetMonth = '',
      engagement = {},
    } = req.body || {}

    if (!goals.trim() || !audience.trim() || !offer.trim()) {
      return res.status(400).json({ error: 'goals, audience, and offer are required' })
    }

    const safePlatform: Platform = VALID_PLATFORMS.includes(platform) ? platform : 'linkedin'
    const safeTone: ToneOption = VALID_TONES.includes(tone) ? tone : 'professional'

    const result = await generateStrategyGuide({
      goals,
      audience,
      offer,
      concept,
      draftContent,
      callToAction,
      platform: safePlatform,
      tone: safeTone,
      targetMonth,
      engagement: {
        impressions: Number(engagement.impressions) || 0,
        likes: Number(engagement.likes) || 0,
        comments: Number(engagement.comments) || 0,
        shares: Number(engagement.shares) || 0,
        saves: Number(engagement.saves) || 0,
        clicks: Number(engagement.clicks) || 0,
      },
    })

    return res.json({ guide: result })
  } catch (error: any) {
    console.error('Strategy assistant route error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate strategic guide' })
  }
})

export default router
