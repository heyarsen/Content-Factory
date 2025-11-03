import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { createUserProfile, generateUserAccessLink, getUserProfile } from '../lib/uploadpost.js'

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

// Get or create Upload-Post user profile and generate access link for linking accounts
router.post('/connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.body
    const userId = req.userId!
    const user = req.user!

    if (!platform || !['instagram', 'tiktok', 'youtube', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' })
    }

    const { data: existingAccounts } = await supabase
      .from('social_accounts')
      .select('platform_account_id')
      .eq('user_id', userId)
      .not('platform_account_id', 'is', null)
      .limit(1)

    let uploadPostUsername: string | undefined = existingAccounts?.[0]?.platform_account_id || undefined

    const userEmail = user.email || user.user_metadata?.email
    const userName = user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (userEmail ? userEmail.split('@')[0] : undefined)

    // Username used for Upload-Post profile creation and linking
    // Use full email as username to avoid conflicts (e.g., heyarsen@icloud.com vs heyarsen@gmail.com)
    // Sanitize: Username may contain only letters, numbers, underscores, @ and hyphens
    // So we replace dots with underscores
    let derivedUsername = user.user_metadata?.username
    if (!derivedUsername && userEmail) {
      // Replace dots with underscores, keep @ and other allowed characters
      derivedUsername = userEmail.replace(/\./g, '_')
    }
    if (!derivedUsername) {
      derivedUsername = userId.replace(/-/g, '_')
    }

    // Determine the final username to use
    const finalUsername = uploadPostUsername || derivedUsername || userId.replace(/-/g, '_')
    
    if (!finalUsername || finalUsername.trim() === '') {
      throw new Error('Unable to generate username for Upload-Post profile')
    }

    // If we don't have an existing username, create the profile
    if (!uploadPostUsername) {
      try {
        console.log('Creating Upload-Post profile with username:', finalUsername, 'email:', userEmail)

        const uploadPostProfile = await createUserProfile({
          username: finalUsername,
          email: userEmail,
          name: userName,
        })

        console.log('Upload-Post user response:', {
          profile: uploadPostProfile,
          keys: uploadPostProfile ? Object.keys(uploadPostProfile) : [],
        })

        const returnedUsername = uploadPostProfile?.username ||
          uploadPostProfile?.user_id ||
          uploadPostProfile?.userId ||
          uploadPostProfile?.user?.username

        if (returnedUsername && typeof returnedUsername === 'string') {
          uploadPostUsername = returnedUsername
        } else {
          uploadPostUsername = finalUsername
        }
      } catch (createError: any) {
        const errorStatus = createError.response?.status
        const errorData = createError.response?.data

        console.error('Failed to create Upload-Post user:', {
          message: createError.message,
          status: errorStatus,
          userEmail,
          userMetadata: user.user_metadata,
          errorResponse: errorData,
        })

        if (errorStatus === 409 || errorData?.message?.toLowerCase?.().includes('already exists')) {
          console.log('Upload-Post user already exists, reusing derived username')
          uploadPostUsername = finalUsername
        } else {
          return res.status(500).json({
            error: 'Failed to create Upload-Post profile. Please try again.',
            details: createError.message,
            apiError: errorData?.message || errorData?.error,
            ...(process.env.NODE_ENV === 'development' && {
              stack: createError.stack,
              userEmail,
              fullError: errorData,
            }),
          })
        }
      }
    }

    // Use the final username (either existing or newly created)
    const usernameForLink = uploadPostUsername || finalUsername
    
    if (!usernameForLink || usernameForLink.trim() === '') {
      throw new Error('Upload-Post username could not be determined')
    }

    try {
      console.log('Generating Upload-Post access link for username:', usernameForLink)

      const frontendBaseUrl =
        process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173'

      const normalizedFrontendBase = frontendBaseUrl.endsWith('/')
        ? frontendBaseUrl.slice(0, -1)
        : frontendBaseUrl

      const redirectUrl = `${normalizedFrontendBase}/social/callback?platform=${encodeURIComponent(
        platform
      )}&uploadpost_username=${encodeURIComponent(usernameForLink)}`

      const accessLink = await generateUserAccessLink(usernameForLink, {
        platforms: [platform as 'instagram' | 'tiktok' | 'youtube' | 'facebook'],
        redirectUrl,
        redirectButtonText: 'Back to Content Fabrica',
      })

      const { data: existing, error: findError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .maybeSingle()

      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding existing account:', findError)
        throw new Error(`Database error: ${findError.message}`)
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('social_accounts')
          .update({
            platform_account_id: usernameForLink,
            status: 'pending',
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('Error updating account:', updateError)
          throw new Error(`Failed to update account: ${updateError.message}`)
        }
        console.log('Updated existing account:', existing.id)
      } else {
        const { data: newAccount, error: insertError } = await supabase
          .from('social_accounts')
          .insert({
            user_id: userId,
            platform: platform as any,
            platform_account_id: usernameForLink,
            status: 'pending',
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting account:', insertError)
          throw new Error(`Failed to create account: ${insertError.message}`)
        }
        console.log('Created new account:', newAccount?.id)
      }

      res.json({
        accessUrl: accessLink.accessUrl,
        duration: accessLink.duration,
        uploadPostUsername: usernameForLink,
        platform,
        redirectUrl,
        message: 'Account linking initiated. Follow the accessUrl to connect through Upload-Post.',
        success: accessLink.success ?? true,
      })
    } catch (linkError: any) {
      console.error('Failed in access link generation or account storage:', {
        message: linkError.message,
        stack: linkError.stack,
        usernameForLink,
        errorResponse: linkError.response?.data,
      })
      
      const errorMessage = linkError.message || 'Failed to complete account setup'
      const apiError = linkError.response?.data?.message || linkError.response?.data?.error
      
      return res.status(500).json({
        error: errorMessage || 'Failed to complete account setup',
        details: apiError || linkError.message || 'Unknown error occurred',
        ...(process.env.NODE_ENV === 'development' && {
          stack: linkError.stack,
          fullError: linkError.response?.data,
        }),
      })
    }
  } catch (error: any) {
    console.error('Connect account error:', {
      message: error.message,
      stack: error.stack,
      errorResponse: error.response?.data,
      userId: req.userId,
    })
    
    const errorMessage = error.message || 'Failed to initiate connection'
    const apiError = error.response?.data?.message || error.response?.data?.error || error.response?.data?.details
    
    res.status(500).json({
      error: errorMessage,
      details: apiError || errorMessage,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        fullError: error.response?.data,
      }),
    })
  }
})

// Handle account connection confirmation (after user links account via Upload-Post UI)
router.post('/callback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, uploadPostUsername } = req.body
    const userId = req.userId!

    if (!platform || !uploadPostUsername) {
      return res.status(400).json({ error: 'Platform and Upload-Post username are required' })
    }

    try {
      const userProfile = await getUserProfile(uploadPostUsername)

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
            platform_account_id: uploadPostUsername,
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) {
          console.error('Update error:', error)
          return res.status(500).json({ error: 'Failed to update account' })
        }

        res.json({ message: 'Account connected successfully', account: existing, profile: userProfile })
      } else {
        const { data, error } = await supabase
          .from('social_accounts')
          .insert({
            user_id: userId,
            platform,
            platform_account_id: uploadPostUsername,
            status: 'connected',
          })
          .select()
          .single()

        if (error) {
          console.error('Insert error:', error)
          return res.status(500).json({ error: 'Failed to save account' })
        }

        res.json({ message: 'Account connected successfully', account: data, profile: userProfile })
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

