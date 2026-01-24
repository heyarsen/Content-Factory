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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' })
    }

    const token = authHeader.substring(7)

    // DEBUG: Log first bit of project URL to check for mismatch
    const subUrl = (process.env.SUPABASE_URL || '').substring(0, 30)
    console.log(`[Auth Debug] Verifying token against URL: ${subUrl}...`)

    const { data: { user }, error } = await retrySupabaseOperation(
      () => supabase.auth.getUser(token),
      2,
      500
    )

    if (error || !user) {
      console.warn('[Auth Debug] Token rejection:', error?.message || 'No user returned')
      return res.status(401).json({
        error: 'Invalid token',
        details: error?.message,
        projectId: process.env.SUPABASE_URL?.split('//')[1]?.split('.')[0]
      })
    }

    req.userId = user.id
    req.user = user
    req.userToken = token

    // Get role
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
    req.role = profile?.role || 'user'

    console.log(`[Auth Debug] Success: ${user.email} Role: ${req.role}`)
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
