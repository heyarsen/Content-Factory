import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { retrySupabaseOperation } from '../lib/supabaseRetry.js'

export interface AuthRequest extends Request {
  userId?: string
  user?: any
  userToken?: string // Store the JWT token for RLS
  role?: string
  body: any
  query: any
  params: any
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.substring(7)

    // Retry on connection timeout
    const { data: { user }, error } = await retrySupabaseOperation(
      () => supabase.auth.getUser(token),
      3,
      1000
    )

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.userId = user.id
    req.user = user
    req.userToken = token // Store token for RLS

    // Fetch role and attach to request for authorization
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // If profile is missing, create it automatically (lazy initialization)
    if (profileError && profileError.code === 'PGRST116') { // single row not found
      console.log(`[Auth] Profile missing for user ${user.id}, creating...`)

      // Auto-promote admin email
      const isAdminEmail = user.email === 'heyarsen@icloud.com'
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({ id: user.id, credits: 3, role: isAdminEmail ? 'admin' : 'user' })
        .select('role')
        .single()

      if (!createError) {
        profile = newProfile
        if (isAdminEmail) {
          console.log(`[Auth] Auto-promoted ${user.email} to admin`)
        }
      } else {
        console.error('[Auth] Failed to lazy-create profile:', createError)
      }
    }

    if (profile) {
      (req as any).role = profile.role
    }

    next()
  } catch (error: any) {
    console.error('Auth error:', {
      message: error?.message,
      code: error?.cause?.code,
      isTimeout: error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT',
    })

    // Return more specific error for timeout
    if (error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(503).json({
        error: 'Service temporarily unavailable - connection timeout',
        retry: true
      })
    }

    return res.status(401).json({ error: 'Unauthorized' })
  }
}

export async function isAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const role = (req as any).role
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admin privileges required' })
  }
  next()
}

export async function requireSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId!
    const userRole = (req as any).role

    console.log('[Subscription Middleware] Checking subscription:', {
      userId,
      userRole,
      endpoint: req.path,
      method: req.method
    })

    // Allow admins to bypass subscription check
    if (userRole === 'admin') {
      console.log('[Subscription Middleware] Admin bypass for user:', userId)
      return next()
    }

    // Import SubscriptionService to check subscription status
    const { SubscriptionService } = await import('../services/subscriptionService.js')

    const hasActiveSubscription = await SubscriptionService.hasActiveSubscription(userId)

    console.log('[Subscription Middleware] Subscription check result:', {
      userId,
      hasActiveSubscription,
      userRole
    })

    if (!hasActiveSubscription) {
      console.log('[Subscription Middleware] Access denied: No active subscription', {
        userId,
        userRole,
        endpoint: req.path
      })
      return res.status(403).json({
        error: 'Active subscription required to connect social media accounts',
        code: 'SUBSCRIPTION_REQUIRED'
      })
    }

    console.log('[Subscription Middleware] Access granted: Active subscription found', {
      userId,
      endpoint: req.path
    })
    next()
  } catch (error: any) {
    console.error('[Subscription Middleware] Subscription check error:', error)
    return res.status(500).json({ error: 'Failed to verify subscription status' })
  }
}
