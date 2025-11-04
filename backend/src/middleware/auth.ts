import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'

export interface AuthRequest extends Request {
  userId?: string
  user?: any
  userToken?: string // Store the JWT token for RLS
  isAdmin?: boolean // Whether user has admin role
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
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.userId = user.id
    req.user = user
    req.userToken = token // Store token for RLS
    
    // Check if user is admin using user-specific client for RLS
    try {
      const { getSupabaseClientForUser } = await import('../lib/supabase.js')
      const userSupabase = getSupabaseClientForUser(token)
      const { data: adminCheck, error } = await userSupabase.rpc('is_admin', { user_uuid: user.id })
      
      if (error) {
        console.error('[Auth] Admin check error:', error)
        req.isAdmin = false
      } else {
        req.isAdmin = adminCheck === true
        console.log('[Auth] User:', user.id, 'Admin status:', req.isAdmin)
      }
    } catch (error) {
      console.error('[Auth] Admin check failed:', error)
      req.isAdmin = false
    }
    
    next()
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

// Middleware to require admin role
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // First authenticate
  authenticate(req, res, () => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  })
}

