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
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({ id: user.id, credits: 3, role: 'user' })
        .select('role')
        .single()

      if (!createError) {
        profile = newProfile
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
