import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { retrySupabaseOperation } from '../lib/supabaseRetry.js'

export interface AuthRequest extends Request {
  userId?: string
  user?: any
  userToken?: string
  role?: string
}

export async function authenticate(
  req: any,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    // Log the existence of the authorization header (but not the sensitive value)
    if (!authHeader) {
      console.warn(`[Auth Debug] MISSING Authorization header for req: ${req.path}`)
      console.log(`[Auth Debug] All received headers:`, JSON.stringify(req.headers))
      return res.status(401).json({ error: 'Missing token' })
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.warn(`[Auth Debug] MALFORMED Authorization header for req: ${req.path}`)
      return res.status(401).json({ error: 'Missing token' })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error } = await retrySupabaseOperation(
      () => supabase.auth.getUser(token),
      2,
      500
    )

    if (error || !user) {
      const projId = process.env.SUPABASE_URL?.split('//')[1]?.split('.')[0]
      console.warn(`[Auth Debug] Token rejected for ${req.path}: ${error?.message || 'No user'}`)
      return res.status(401).json({
        error: 'Invalid token',
        details: error?.message,
        projectId: projId
      })
    }

    req.userId = user.id
    req.user = user
    req.userToken = token

    // Get role
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
    req.role = profile?.role || 'user'

    console.log(`[Auth Debug] OK: ${user.email} -> ${req.path}`)
    next()
  } catch (error: any) {
    console.error('[Auth Debug] Critical Error:', error.message)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

export async function isAdmin(req: any, res: Response, next: NextFunction) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Admin required' })
  next()
}

export async function requireSubscription(req: any, res: Response, next: NextFunction) {
  const { SubscriptionService } = await import('../services/subscriptionService.js')
  const hasSub = await SubscriptionService.hasActiveSubscription(req.userId)
  if (!hasSub) return res.status(403).json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' })
  next()
}
