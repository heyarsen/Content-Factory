import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { createUserProfile, generateUserJWT, getUserProfile } from '../lib/uploadpost.js'

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

// Get or create Upload-Post user profile and generate JWT for linking accounts
router.post('/connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.body
    const userId = req.userId!
    const user = req.user!

    if (!platform || !['instagram', 'tiktok', 'youtube', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' })
    }

    // Check if user already has an Upload-Post profile ID stored (in any account)
    // We'll use a consistent Upload-Post user ID across all platforms
    const { data: existingAccounts } = await supabase
      .from('social_accounts')
      .select('platform_account_id')
      .eq('user_id', userId)
      .limit(1)

    let uploadPostUserId = existingAccounts?.[0]?.platform_account_id

    // Create or get Upload-Post user profile
    if (!uploadPostUserId) {
      try {
        // Ensure we have at least email for user profile (username will be derived from email)
        const userEmail = user.email || user.user_metadata?.email
        const userName = user.user_metadata?.full_name || 
                        user.user_metadata?.name ||
                        (userEmail ? userEmail.split('@')[0] : undefined)
        const username = user.user_metadata?.username || 
                         (userEmail ? userEmail.split('@')[0] : undefined)

        if (!userEmail && !username) {
          throw new Error('User email or username is required to create Upload-Post profile')
        }

        const uploadPostUser = await createUserProfile({
          email: userEmail,
          name: userName,
          username: username, // Required by Upload-Post API
        })
        
        console.log('Upload-Post user response:', {
          fullResponse: uploadPostUser,
          id: uploadPostUser?.id,
          user_id: uploadPostUser?.user_id,
          userId: uploadPostUser?.userId,
          allKeys: uploadPostUser ? Object.keys(uploadPostUser) : [],
        })
        
        // Try multiple possible field names for user ID
        uploadPostUserId = uploadPostUser?.id || 
                          uploadPostUser?.user_id || 
                          uploadPostUser?.userId ||
                          uploadPostUser?.user?.id ||
                          uploadPostUser?.data?.id ||
                          (typeof uploadPostUser === 'string' ? uploadPostUser : null)

        if (!uploadPostUserId) {
          console.error('Upload-Post response missing user ID. Full response:', JSON.stringify(uploadPostUser, null, 2))
          // If we still don't have a user ID, try using the Supabase user ID as fallback
          console.log('Using Supabase user ID as fallback:', userId)
          uploadPostUserId = userId
        }

        console.log('Created Upload-Post user profile:', uploadPostUserId)
      } catch (createError: any) {
        // If profile creation fails, check if it's because user already exists
        // or if we can proceed without it
        const errorStatus = createError.response?.status
        const errorData = createError.response?.data

        console.error('Failed to create Upload-Post user:', {
          message: createError.message,
          status: errorStatus,
          userEmail: user.email,
          userMetadata: user.user_metadata,
          errorResponse: errorData,
        })

        // If user already exists (409 or similar), try to extract user ID from error
        // Or use the Supabase user ID as fallback
        if (errorStatus === 409 || errorData?.message?.toLowerCase().includes('already exists')) {
          console.log('Upload-Post user already exists, using fallback ID')
          // Try using Supabase user ID as Upload-Post user ID
          uploadPostUserId = userId
        } else {
          // For other errors, return error to user
          return res.status(500).json({
            error: 'Failed to create Upload-Post profile. Please try again.',
            details: createError.message,
            apiError: errorData?.message || errorData?.error,
            // Include more details in development
            ...(process.env.NODE_ENV === 'development' && { 
              stack: createError.stack,
              userEmail: user.email,
              fullError: errorData 
            }),
          })
        }
      }
    }

    // Generate JWT for linking accounts
    try {
      const jwt = await generateUserJWT(uploadPostUserId)

      // Create or update account record
      const { data: existing } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .single()

      if (existing) {
        await supabase
          .from('social_accounts')
          .update({
            platform_account_id: uploadPostUserId,
            status: 'pending', // Will be 'connected' after user links account
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('social_accounts')
          .insert({
            user_id: userId,
            platform: platform as any,
            platform_account_id: uploadPostUserId,
            status: 'pending',
          })
      }

      // Return JWT and instructions for linking
      // Note: Upload-Post uses JWT-based account linking
      // The frontend needs to integrate Upload-Post's account linking UI/widget
      res.json({
        jwt,
        uploadPostUserId,
        message: 'Account linking initiated. Use the JWT to complete account linking through Upload-Post.',
        linkInstructions: 'Please check Upload-Post documentation for integrating their account linking widget/UI.',
      })
    } catch (jwtError: any) {
      console.error('Failed to generate JWT:', jwtError)
      return res.status(500).json({
        error: 'Failed to generate authentication token',
        details: jwtError.message,
      })
    }
  } catch (error: any) {
    console.error('Connect account error:', error)
    res.status(500).json({
      error: error.message || 'Failed to initiate connection',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
})

// Handle account connection confirmation (after user links account via Upload-Post UI)
router.post('/callback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, uploadPostUserId } = req.body
    const userId = req.userId!

    if (!platform || !uploadPostUserId) {
      return res.status(400).json({ error: 'Platform and Upload-Post user ID are required' })
    }

    // Verify the Upload-Post user profile exists
    try {
      const userProfile = await getUserProfile(uploadPostUserId)
      
      // Update account status to connected
      const { data: existing } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('social_accounts')
          .update({
            platform_account_id: uploadPostUserId,
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) {
          console.error('Update error:', error)
          return res.status(500).json({ error: 'Failed to update account' })
        }

        res.json({ message: 'Account connected successfully', account: existing })
      } else {
        // Create new account record
        const { data, error } = await supabase
          .from('social_accounts')
          .insert({
            user_id: userId,
            platform,
            platform_account_id: uploadPostUserId,
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
    } catch (profileError: any) {
      console.error('Failed to verify Upload-Post profile:', profileError)
      return res.status(500).json({
        error: 'Failed to verify account connection',
        details: profileError.message,
      })
    }
  } catch (error: any) {
    console.error('Callback error:', error)
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

