import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Signup
router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, preferredLanguage } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const redirectUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173'

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectUrl}/verify-email`,
        data: {
          preferred_language: preferredLanguage || 'en',
        },
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

    // Update user_profiles with preferred language
    if (data.user) {
      await supabase
        .from('user_profiles')
        .update({ preferred_language: preferredLanguage || 'en' })
        .eq('id', data.user.id)
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

    // Check Supabase health before attempting authentication
    const { checkSupabaseHealth, getSupabaseClientWithHealthCheck } = await import('../lib/supabaseConnection.js')
    const { circuitBreaker } = await import('../lib/circuitBreaker.js')

    // Check circuit breaker first
    if (circuitBreaker.isOpen('supabase')) {
      const state = circuitBreaker.getState('supabase')
      const nextAttempt = state?.nextAttemptTime ? new Date(state.nextAttemptTime).toISOString() : 'unknown'
      console.log(`[Auth] Circuit breaker is open, rejecting login attempt. Next attempt: ${nextAttempt}`)
      return res.status(503).json({
        error: 'Authentication service is temporarily unavailable. Please try again in a few moments.',
        retryAfter: Math.max(0, Math.ceil((state?.nextAttemptTime || Date.now()) - Date.now()) / 1000),
        details: process.env.NODE_ENV === 'development' ? {
          circuitBreakerState: 'open',
          nextAttemptTime: nextAttempt,
        } : undefined,
      })
    }

    // For signInWithPassword, we can use either service role or anon key
    // Anon key is actually preferred for user authentication operations
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`[Auth] Missing Supabase configuration`)
      return res.status(500).json({
        error: 'Server configuration error. Please contact support.',
      })
    }

    // Get Supabase client with health check and circuit breaker
    // This ALREADY performs a health check internally, so no need to call it twice.
    const { client: healthCheckedClient, error: clientError } = await getSupabaseClientWithHealthCheck(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    if (clientError || !healthCheckedClient) {
      console.error(`[Auth] Failed to create Supabase client: ${clientError}`)
      return res.status(503).json({
        error: 'Authentication service is currently unavailable. Please try again in a few moments.',
        retryAfter: 30,
      })
    }

    authClient = healthCheckedClient
    console.log(`[Auth] Using anon key for authentication with health check and circuit breaker`)

    // Single attempt with the health-checked client
    // If health check passed, the connection should work
    try {
      const result = await authClient.auth.signInWithPassword({
        email,
        password,
      })
      data = result.data
      error = result.error

      // Record success in circuit breaker
      if (!error) {
        circuitBreaker.recordSuccess('supabase')
      }
    } catch (authError: any) {
      // Check if it's a connection timeout error
      const isTimeoutError =
        authError?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        authError?.message?.includes('timeout') ||
        authError?.message?.includes('fetch failed') ||
        authError?.message?.includes('Connect Timeout') ||
        authError?.name === 'AuthRetryableFetchError'

      if (isTimeoutError) {
        // Record failure in circuit breaker
        circuitBreaker.recordFailure('supabase')
        console.error(`[Auth] Connection timeout error:`, {
          message: authError.message,
          code: authError.cause?.code,
        })
      }

      console.error(`[Auth] Exception during signInWithPassword:`, {
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

      // Check if this is a connection/timeout error - should have been caught by health check
      // But if it still happens, treat it as service unavailable
      const isConnectionError =
        errorMsgLower.includes('network') ||
        errorMsgLower.includes('fetch') ||
        errorMsgLower.includes('failed to fetch') ||
        errorMsgLower.includes('connection') ||
        errorMsgLower.includes('timeout') ||
        errorMsgLower.includes('econnrefused') ||
        errorMsgLower.includes('connect timeout') ||
        (error as any).cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.name === 'AuthRetryableFetchError'

      if (isConnectionError) {
        // Record failure in circuit breaker
        circuitBreaker.recordFailure('supabase')

        // Return 503 Service Unavailable instead of 401
        const state = circuitBreaker.getState('supabase')
        const retryAfter = state?.nextAttemptTime
          ? Math.max(0, Math.ceil((state.nextAttemptTime - Date.now()) / 1000))
          : 30

        console.error(`[Auth] CRITICAL: Connection error after health check!`, {
          supabaseUrl: process.env.SUPABASE_URL,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          errorCode: (error as any).cause?.code,
          errorMessage: errorMsg,
          circuitBreakerState: state?.state,
          retryAfter,
        })

        return res.status(503).json({
          error: 'Authentication service is temporarily unavailable. Please try again in a few moments.',
          retryAfter,
          details: process.env.NODE_ENV === 'development' ? {
            originalMessage: errorMsg,
            errorType: error.name,
            errorCode: (error as any).code,
            circuitBreakerState: state?.state,
          } : undefined,
        })
      }

      // Provide more user-friendly error messages for other errors
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

// Delete account
router.delete('/account', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Delete account error:', error)
      return res.status(500).json({ error: 'Failed to delete account' })
    }

    res.json({ message: 'Account deleted' })
  } catch (error: any) {
    console.error('Delete account exception:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_plan_id, subscription_status, credits')
      .eq('id', req.userId)
      .single()

    const hasActiveSubscription = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'

    res.json({
      user: {
        ...req.user,
        role: (req as any).role,
        credits: profile?.credits || 0,
        subscription_plan_id: profile?.subscription_plan_id,
        subscription_status: profile?.subscription_status,
        hasActiveSubscription
      }
    })
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

// Update user language preference
router.patch('/language', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { language } = req.body

    if (!language) {
      return res.status(400).json({ error: 'Language is required' })
    }

    // Validate language code
    const validLanguages = ['en', 'ru', 'uk', 'de', 'es']
    if (!validLanguages.includes(language)) {
      return res.status(400).json({ error: 'Invalid language code' })
    }

    // Update user_profiles
    const { error } = await supabase
      .from('user_profiles')
      .update({ preferred_language: language })
      .eq('id', userId)

    if (error) {
      console.error('Update language error:', error)
      return res.status(500).json({ error: 'Failed to update language preference' })
    }

    res.json({ message: 'Language preference updated successfully', language })
  } catch (error: any) {
    console.error('Update language exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

