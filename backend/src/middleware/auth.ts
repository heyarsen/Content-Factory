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
    
    // Check if user is admin
    const { data: adminCheck } = await supabase.rpc('is_admin', { user_uuid: user.id })
    req.isAdmin = adminCheck === true
    
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

