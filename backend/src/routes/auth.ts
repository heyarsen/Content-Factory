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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return res.status(401).json({ error: error.message })
    }

    res.json({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user,
    })
  } catch (error: any) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
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

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
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

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Password reset successful' })
  } catch (error: any) {
    console.error('Confirm password reset error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

