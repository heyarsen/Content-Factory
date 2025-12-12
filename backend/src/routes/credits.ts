import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CreditsService } from '../services/creditsService.js'

const router = Router()

/**
 * GET /api/credits
 * Get user's current credits
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const credits = await CreditsService.getUserCredits(userId)
    res.json({ credits, unlimited: credits === null })
  } catch (error: any) {
    console.error('Get credits error:', error)
    res.status(500).json({ error: 'Failed to get credits' })
  }
})

export default router

