import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { initiateOAuthConnection, handleOAuthCallback } from '../lib/uploadpost.js'

const router = Router()

// List connected accounts
router.get('/accounts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('connected_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ error: 'Failed to fetch social accounts' })
    }

    res.json({ accounts: data || [] })
  } catch (error: any) {
    console.error('List accounts error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Initiate OAuth connection
router.post('/connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.body
    const userId = req.userId!

    if (!platform || !['instagram', 'tiktok', 'youtube', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' })
    }

    const redirectUri = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/social/callback?platform=${platform}`

    const { authUrl } = await initiateOAuthConnection({
      platform: platform as 'instagram' | 'tiktok' | 'youtube' | 'facebook',
      redirectUri,
    })

    res.json({ authUrl })
  } catch (error: any) {
    console.error('Connect account error:', error)
    res.status(500).json({ error: error.message || 'Failed to initiate connection' })
  }
})

// Handle OAuth callback
router.post('/callback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code, platform } = req.body
    const userId = req.userId!

    if (!code || !platform) {
      return res.status(400).json({ error: 'Code and platform are required' })
    }

    const { accountId, accessToken, refreshToken } = await handleOAuthCallback(
      code,
      platform
    )

    // Check if account already exists
    const { data: existing } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single()

    if (existing) {
      // Update existing account
      const { error } = await supabase
        .from('social_accounts')
        .update({
          platform_account_id: accountId,
          access_token: accessToken,
          refresh_token: refreshToken || null,
          status: 'connected',
          connected_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Update error:', error)
        return res.status(500).json({ error: 'Failed to update account' })
      }

      res.json({ message: 'Account updated successfully', accountId: existing.id })
    } else {
      // Create new account
      const { data, error } = await supabase
        .from('social_accounts')
        .insert({
          user_id: userId,
          platform,
          platform_account_id: accountId,
          access_token: accessToken,
          refresh_token: refreshToken || null,
          status: 'connected',
        })
        .select()
        .single()

      if (error) {
        console.error('Insert error:', error)
        return res.status(500).json({ error: 'Failed to save account' })
      }

      res.json({ message: 'Account connected successfully', account: data })
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    res.status(500).json({ error: error.message || 'Failed to handle callback' })
  }
})

// Disconnect account
router.delete('/accounts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { error } = await supabase
      .from('social_accounts')
      .update({
        status: 'disconnected',
        access_token: null,
        refresh_token: null,
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Disconnect error:', error)
      return res.status(500).json({ error: 'Failed to disconnect account' })
    }

    res.json({ message: 'Account disconnected successfully' })
  } catch (error: any) {
    console.error('Disconnect account error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get account status
router.get('/accounts/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Account not found' })
    }

    res.json({ account: data })
  } catch (error: any) {
    console.error('Get account status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

