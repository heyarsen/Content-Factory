import { Router, Response } from 'express'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { searchShortFormTrends } from '../services/trendSearcherService.js'

const router = Router()

router.post('/search', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const { query = '', limit = 9 } = req.body || {}
    const result = await searchShortFormTrends(String(query || ''), Number(limit) || 9)
    return res.json(result)
  } catch (error: any) {
    console.error('Trend search route error:', error)
    return res.status(500).json({ error: error.message || 'Failed to search trends' })
  }
})

export default router
