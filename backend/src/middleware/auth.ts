import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { retrySupabaseOperation } from '../lib/supabaseRetry.js'

export interface AuthRequest extends Request {
  userId?: string
  user?: any
  userToken?: string // Store the JWT token for RLS
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

