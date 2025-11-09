import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Signup
router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const redirectUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173'
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectUrl}/verify-email`,
      },
    })

    if (error) {
      // If user already exists, don't automatically resend (could hit rate limits)
      if (error.message.includes('already registered') || 
          error.message.includes('already exists') ||
          error.message.includes('User already registered')) {
        return res.status(400).json({ 
          error: 'An account with this email already exists.',
          message: 'If you need to verify your email, please use the resend verification option.',
          canLogin: true,
          email: email,
        })
      }

      return res.status(400).json({ error: error.message })
    }

    res.json({
      message: 'Signup successful. Please check your email for verification.',
      user: data.user,
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    console.log(`[Auth] Login request received:`, {
      hasEmail: !!email,
      hasPassword: !!password,
      email: email ? `${email.substring(0, 3)}***` : 'missing',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    if (!email || !password) {
      console.log('[Auth] Login failed: Missing email or password')
      return res.status(400).json({ error: 'Email and password are required' })
    }

    console.log(`[Auth] Login attempt for email: ${email}`)
    console.log(`[Auth] Supabase URL: ${process.env.SUPABASE_URL ? 'Set' : 'Missing'}`)
    console.log(`[Auth] Service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'Missing'}`)
    console.log(`[Auth] Anon key: ${process.env.SUPABASE_ANON_KEY ? 'Set (length: ' + process.env.SUPABASE_ANON_KEY.length + ')' : 'Missing'}`)

    // Try with service role key first, then fallback to anon key if needed
    let data: any = null
    let error: any = null
    let authClient = supabase

    // For signInWithPassword, we can use either service role or anon key
    // Anon key is actually preferred for user authentication operations
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
    
    // Helper function to create a fetch with increased timeout for connection issues
    const createFetchWithTimeout = (timeoutMs: number = 90000) => {
      return async (url: string, options: any = {}) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          return response
        } catch (error: any) {
          clearTimeout(timeoutId)
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`)
          }
          throw error
        }
      }
    }
    
    if (supabaseUrl && supabaseAnonKey) {
      // Create a client with anon key for authentication (preferred for user auth)
      const { createClient } = await import('@supabase/supabase-js')
      // Use custom fetch with increased timeout (90 seconds) for connection issues
      const customFetch = createFetchWithTimeout(90000)
      authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          fetch: customFetch as any,
          headers: {
            'x-client-info': 'content-factory-backend-auth',
          },
        },
      })
      console.log(`[Auth] Using anon key for authentication with 90s timeout`)
    } else {
      console.log(`[Auth] Using service role key for authentication (anon key not available)`)
    }

    // Retry logic for connection timeout errors
    let lastError: any = null
    const maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await authClient.auth.signInWithPassword({
          email,
          password,
        })
        data = result.data
        error = result.error
        break // Success, exit retry loop
      } catch (authError: any) {
        lastError = authError
        
        // Check if it's a connection timeout error
        const isTimeoutError = 
          authError?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          authError?.message?.includes('timeout') ||
          authError?.message?.includes('fetch failed') ||
          authError?.message?.includes('Connect Timeout') ||
          authError?.name === 'AuthRetryableFetchError'
        
        if (isTimeoutError && attempt < maxRetries - 1) {
          const waitTime = 2000 * Math.pow(2, attempt) // Exponential backoff: 2s, 4s, 8s
          console.log(`[Auth] Connection timeout on attempt ${attempt + 1}/${maxRetries}, retrying in ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        // For non-timeout errors or last attempt, log and break
        console.error(`[Auth] Exception during signInWithPassword (attempt ${attempt + 1}/${maxRetries}):`, {
          message: authError.message,
          stack: authError.stack,
          name: authError.name,
          code: authError.code,
          cause: authError.cause,
        })
        
        // Convert exception to error format
        error = {
          message: authError.message || 'Authentication failed',
          status: authError.status || 500,
          name: authError.name || 'AuthError',
        }
        break
      }
    }

    if (error) {
      console.error(`[Auth] Login failed for ${email}:`, {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as any).code,
        errorString: String(error),
        errorType: typeof error,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      })
      
      // Check for specific error types
      const errorMsg = error.message || String(error) || 'Unknown error'
      const errorMsgLower = errorMsg.toLowerCase()
      
      // Provide more user-friendly error messages
      let errorMessage = errorMsg
      if (errorMsgLower.includes('invalid login credentials') || 
          errorMsgLower.includes('invalid credentials') ||
          errorMsgLower.includes('invalid_credentials') ||
          errorMsgLower.includes('invalid_grant')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else if (errorMsgLower.includes('email not confirmed') || 
                 errorMsgLower.includes('email_not_confirmed') ||
                 errorMsgLower.includes('confirmation')) {
        errorMessage = 'Please verify your email before signing in. Check your inbox for a verification link.'
      } else if (errorMsgLower.includes('rate limit') || 
                 errorMsgLower.includes('too_many_requests') ||
                 errorMsgLower.includes('too many')) {
        errorMessage = 'Too many login attempts. Please try again in a few minutes.'
      } else if (errorMsgLower.includes('network') || 
                 errorMsgLower.includes('fetch') ||
                 errorMsgLower.includes('failed to fetch') ||
                 errorMsgLower.includes('connection') ||
                 errorMsgLower.includes('timeout') ||
                 errorMsgLower.includes('econnrefused') ||
                 errorMsgLower.includes('connect timeout')) {
        errorMessage = 'Unable to connect to authentication service. The connection timed out. This might be a temporary network issue. Please try again in a few moments.'
        // Log this as a critical error
        console.error(`[Auth] CRITICAL: Backend cannot connect to Supabase (connection timeout)!`, {
          supabaseUrl: process.env.SUPABASE_URL,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          errorCode: (error as any).cause?.code,
          errorMessage: errorMsg,
        })
      }
      
      return res.status(401).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          originalMessage: errorMsg,
          errorType: error.name,
          errorCode: (error as any).code,
        } : undefined,
      })
    }

    if (!data.session) {
      console.error(`[Auth] Login succeeded but no session for ${email}`, {
        hasUser: !!data.user,
        hasSession: !!data.session,
      })
      return res.status(500).json({ error: 'Failed to create session' })
    }

    console.log(`[Auth] Login successful for ${email}`, {
      userId: data.user?.id,
      hasAccessToken: !!data.session.access_token,
      hasRefreshToken: !!data.session.refresh_token,
    })

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    })
  } catch (error: any) {
    console.error('[Auth] Login exception:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.substring(7)

    if (token) {
      await supabase.auth.signOut()
    }

    res.json({ message: 'Logged out successfully' })
  } catch (error: any) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ user: req.user })
  } catch (error: any) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Verify email
router.post('/verify-email', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const redirectUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173'
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${redirectUrl}/verify-email`,
      },
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Verification email sent' })
  } catch (error: any) {
    console.error('Verify email error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Request password reset
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/reset-password`,
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Password reset email sent' })
  } catch (error: any) {
    console.error('Reset password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Confirm password reset
router.post('/reset-password/confirm', authLimiter, async (req: Request, res: Response) => {
  try {
    const { password, access_token } = req.body

    if (!password || !access_token) {
      return res.status(400).json({ error: 'Password and access token are required' })
    }

    // Create a Supabase client with the user's access token
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    })

    // Set the session with the access token
    await userClient.auth.setSession({
      access_token,
      refresh_token: access_token, // Use access_token as fallback
    })

    // Update password using the authenticated client
    const { error } = await userClient.auth.updateUser({
      password,
    })

    if (error) {
      console.error('Password reset error:', error)
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Password reset successful' })
  } catch (error: any) {
    console.error('Confirm password reset error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Update user profile
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { email, old_password, new_password } = req.body

    if (!email && !new_password) {
      return res.status(400).json({ error: 'email or new_password is required' })
    }

    // Update email if provided
    if (email) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        email: email,
        email_confirm: false, // Require email confirmation
      })

      if (updateError) {
        console.error('Update email error:', updateError)
        return res.status(500).json({ error: 'Failed to update email' })
      }

      return res.json({ 
        message: 'Email update initiated. Please check your email to confirm the new address.',
        email 
      })
    }

    // Update password if provided
    if (new_password) {
      if (!old_password) {
        return res.status(400).json({ error: 'old_password is required to change password' })
      }

      // Verify old password by attempting to sign in
      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      
      if (!userData?.user?.email) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Verify old password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: old_password,
      })

      if (signInError) {
        return res.status(401).json({ error: 'Invalid current password' })
      }

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: new_password,
      })

      if (updateError) {
        console.error('Update password error:', updateError)
        return res.status(500).json({ error: 'Failed to update password' })
      }

      return res.json({ message: 'Password updated successfully' })
    }

    return res.status(400).json({ error: 'Invalid request' })
  } catch (error: any) {
    console.error('Update profile exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

