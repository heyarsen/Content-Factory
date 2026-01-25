import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getSupabaseClientForUser } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { createUserProfile, generateUserAccessLink, getUserProfile } from '../lib/uploadpost.js'

const router = Router()

// Map our platform names to Upload-Post API platform names
// Note: We use 'x' internally to match Upload-Post API (no mapping needed)
function mapPlatformToUploadPost(platform: string): string {
  // All platforms match Upload-Post API format, just return as-is
  return platform.toLowerCase()
}

// Helper to determine if Upload-Post profile shows the platform as connected
// According to Upload-Post API docs:
// - social_accounts[platform] is an object with display_name, username, social_images if connected
// - social_accounts[platform] is null or empty string if NOT connected
function isUploadPostPlatformConnected(profile: any, platform: string): boolean {
  if (!profile || !platform) {
    console.log('[Connection Check] No profile or platform provided')
    return false
  }

  const platformLower = platform.toLowerCase()

  // Log the profile structure for debugging
  console.log('[Connection Check] Checking platform:', platform, 'Profile keys:', Object.keys(profile || {}))

  // Handle response structure: profile might be nested in a "profile" key
  const actualProfile = profile.profile || profile

  // Check social_accounts object - this is the official way according to Upload-Post API
  if (actualProfile.social_accounts && typeof actualProfile.social_accounts === 'object') {
    const socialAccounts = actualProfile.social_accounts

    // Map our platform name to Upload-Post API format (e.g., twitter -> x)
    const uploadPostPlatformName = mapPlatformToUploadPost(platform)
    const uploadPostPlatformLower = uploadPostPlatformName.toLowerCase()

    // Check if the platform exists in social_accounts
    const platformAccount = socialAccounts[platformLower] ||
      socialAccounts[platform] ||
      socialAccounts[uploadPostPlatformLower] ||
      socialAccounts[uploadPostPlatformName]

    console.log('[Connection Check] social_accounts for platform:', platform, '(Upload-Post name:', uploadPostPlatformName, ') =', platformAccount)

    // If platformAccount is an object (not null, not empty string), it's connected
    if (platformAccount && typeof platformAccount === 'object') {
      // Verify it has connection data (display_name, username, etc.)
      if (platformAccount.display_name || platformAccount.username || Object.keys(platformAccount).length > 0) {
        console.log('[Connection Check] ✓ Platform is CONNECTED. Account data:', platformAccount)
        return true
      }
    }

    // If platformAccount is null, empty string, or undefined, it's NOT connected
    if (platformAccount === null || platformAccount === '' || platformAccount === undefined) {
      console.log('[Connection Check] ✗ Platform is NOT connected (null/empty)')
      return false
    }
  }

  // Fallback: if social_accounts doesn't exist, check if it's in the root profile
  if (profile.social_accounts && typeof profile.social_accounts === 'object') {
    const socialAccounts = profile.social_accounts
    const platformAccount = socialAccounts[platformLower] || socialAccounts[platform]

    if (platformAccount && typeof platformAccount === 'object') {
      if (platformAccount.display_name || platformAccount.username || Object.keys(platformAccount).length > 0) {
        console.log('[Connection Check] ✓ Platform is CONNECTED (root level). Account data:', platformAccount)
        return true
      }
    }

    if (platformAccount === null || platformAccount === '' || platformAccount === undefined) {
      console.log('[Connection Check] ✗ Platform is NOT connected (root level, null/empty)')
      return false
    }
  }

  // If we get here, social_accounts doesn't exist or platform isn't in it
  console.log('[Connection Check] ✗ NO connection evidence found. social_accounts:',
    actualProfile.social_accounts || profile.social_accounts || 'not found')
  console.log('[Connection Check] Full profile structure (first 1500 chars):',
    JSON.stringify(actualProfile || profile, null, 2).substring(0, 1500))
  return false
}

// List connected accounts
router.get('/accounts', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

    const { data, error } = await userSupabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('connected_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ error: 'Failed to fetch social accounts' })
    }

    // Fetch account info from Upload-Post for connected accounts
    const accountsWithInfo = await Promise.all(
      (data || []).map(async (account) => {
        if (account.status === 'connected' && account.platform_account_id) {
          try {
            const profile = await getUserProfile(account.platform_account_id)
            const actualProfile = profile.profile || profile

            // Extract account info from Upload-Post profile
            const socialAccounts = actualProfile?.social_accounts || profile?.social_accounts || {}
            const platformName = mapPlatformToUploadPost(account.platform)
            const platformAccount = socialAccounts[platformName] ||
              socialAccounts[account.platform] ||
              socialAccounts[platformName.toLowerCase()] ||
              socialAccounts[account.platform.toLowerCase()]

            if (platformAccount && typeof platformAccount === 'object') {
              return {
                ...account,
                account_info: {
                  username: platformAccount.username || platformAccount.display_name || null,
                  display_name: platformAccount.display_name || platformAccount.username || null,
                  avatar_url: platformAccount.social_images?.profile_picture ||
                    platformAccount.profile_picture ||
                    platformAccount.avatar_url ||
                    null,
                },
              }
            }
          } catch (profileError: any) {
            console.error(`Failed to fetch profile for ${account.platform}:`, profileError.message)
            // Continue without account info if profile fetch fails
          }
        }

        return {
          ...account,
          account_info: null,
        }
      })
    )

    res.json({ accounts: accountsWithInfo || [] })
  } catch (error: any) {
    console.error('List accounts error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get or create Upload-Post user profile and generate access link for linking accounts
router.post('/connect', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.body
    const userId = req.userId!
    const user = req.user!

    // Supported platforms according to Upload-Post API: instagram, tiktok, youtube, facebook, x (Twitter), linkedin, pinterest, threads
    // Note: snapchat is NOT supported by Upload-Post
    const supportedPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'threads']
    if (!platform || !supportedPlatforms.includes(platform)) {
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

    // Determine the final username to use (don't create account yet - only when actually connecting)
    const finalUsername = uploadPostUsername || derivedUsername || userId.replace(/-/g, '_')

    if (!finalUsername || finalUsername.trim() === '') {
      throw new Error('Unable to generate username for Upload-Post profile')
    }

    // Use the derived username for link generation
    const usernameForLink = finalUsername

    if (!usernameForLink || usernameForLink.trim() === '') {
      throw new Error('Upload-Post username could not be determined')
    }

    // Ensure user profile exists on Upload-Post before generating link
    try {
      console.log('Ensuring Upload-Post user profile exists for:', usernameForLink)
      await createUserProfile({
        username: usernameForLink,
        email: userEmail || undefined,
        name: userName || undefined
      })
    } catch (profileError: any) {
      // Ignore "already exists" errors, but log others
      console.warn('Upload-Post profile creation notice (may already exist):', profileError.message)
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

      // Generate access link with retry logic for rate limiting
      let accessLink
      let retries = 3
      let lastError: any = null

      while (retries > 0) {
        try {
          // Map platform name to Upload-Post API format (e.g., twitter -> x)
          const uploadPostPlatform = mapPlatformToUploadPost(platform)
          accessLink = await generateUserAccessLink(usernameForLink, {
            platforms: [uploadPostPlatform as any],
            redirectUrl,
            redirectButtonText: 'Back to Content Factory',
          })
          break
        } catch (linkError: any) {
          lastError = linkError
          const status = linkError.response?.status

          // If 429 rate limit, wait and retry
          if (status === 429 && retries > 1) {
            const retryAfter = linkError.response?.headers?.['retry-after'] || '5'
            const waitTime = parseInt(retryAfter, 10) * 1000 || 5000
            console.log(`Rate limited (429), waiting ${waitTime}ms before retry (${retries - 1} retries left)`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            retries--
            continue
          }

          // For other errors or last retry, throw
          throw linkError
        }
      }

      if (!accessLink) {
        throw lastError || new Error('Failed to generate access link after retries')
      }

      // Use user-specific client for RLS to work properly
      const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

      const { data: existing, error: findError } = await userSupabase
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
        const { error: updateError } = await userSupabase
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
        const { data: newAccount, error: insertError } = await userSupabase
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
router.post('/callback', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, uploadPostUsername } = req.body
    const userId = req.userId!
    const user = req.user!

    if (!platform || !uploadPostUsername) {
      return res.status(400).json({ error: 'Platform and Upload-Post username are required' })
    }

    // Check if user already has an upload-post account
    const { data: existingAccounts } = await supabase
      .from('social_accounts')
      .select('platform_account_id')
      .eq('user_id', userId)
      .not('platform_account_id', 'is', null)
      .limit(1)

    let uploadPostAccountUsername: string | undefined = existingAccounts?.[0]?.platform_account_id || undefined

    // If no upload-post account exists, create it now (when actually connecting)
    if (!uploadPostAccountUsername) {
      const userEmail = user.email || user.user_metadata?.email
      const userName = user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        (userEmail ? userEmail.split('@')[0] : undefined)

      let derivedUsername = user.user_metadata?.username
      if (!derivedUsername && userEmail) {
        derivedUsername = userEmail.replace(/\./g, '_')
      }
      if (!derivedUsername) {
        derivedUsername = userId.replace(/-/g, '_')
      }

      const finalUsername = derivedUsername || userId.replace(/-/g, '_')

      try {
        console.log('Creating Upload-Post profile on account connection:', finalUsername, 'email:', userEmail)

        const uploadPostProfile = await createUserProfile({
          username: finalUsername,
          email: userEmail,
          name: userName,
        })

        const returnedUsername = uploadPostProfile?.username ||
          uploadPostProfile?.user_id ||
          uploadPostProfile?.userId ||
          uploadPostProfile?.user?.username

        if (returnedUsername && typeof returnedUsername === 'string') {
          uploadPostAccountUsername = returnedUsername
        } else {
          uploadPostAccountUsername = finalUsername
        }

        console.log('Upload-Post account created:', uploadPostAccountUsername)
      } catch (createError: any) {
        const errorStatus = createError.response?.status
        const errorData = createError.response?.data

        // If 429 rate limit, return a helpful error
        if (errorStatus === 429) {
          return res.status(429).json({
            error: 'Rate limit exceeded. Please wait a few moments and try connecting again.',
            retryAfter: errorData?.retryAfter || 60,
          })
        }

        // If account already exists, use the username
        if (errorStatus === 409 || errorData?.message?.toLowerCase?.().includes('already exists')) {
          console.log('Upload-Post user already exists, using derived username')
          uploadPostAccountUsername = finalUsername
        } else {
          console.error('Failed to create Upload-Post account:', createError)
          return res.status(500).json({
            error: 'Failed to create Upload-Post account. Please try again.',
            details: createError.message,
          })
        }
      }
    }

    try {
      const usernameToVerify = uploadPostAccountUsername || uploadPostUsername
      const userProfile = await getUserProfile(usernameToVerify)

      // Log the full profile for debugging
      console.log('[Callback] Full Upload-Post profile:', JSON.stringify(userProfile, null, 2))

      // Use user-specific client for RLS to work properly
      const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

      const { data: existing } = await userSupabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .maybeSingle()

      // Use the upload-post account username we created/verified
      const finalUploadPostUsername = uploadPostAccountUsername || uploadPostUsername

      // Check if platform is actually connected - be VERY strict about this
      const platformConnected = isUploadPostPlatformConnected(userProfile, platform)

      console.log('[Callback] Platform connection check result:', platformConnected, 'for platform:', platform)

      // If platform is NOT connected, update status to pending and return error
      if (!platformConnected) {
        console.log('[Callback] Platform NOT connected. Setting status to pending.')

        if (existing) {
          const { error: updateError } = await userSupabase
            .from('social_accounts')
            .update({
              platform_account_id: finalUploadPostUsername,
              status: 'pending',
              connected_at: null,
            })
            .eq('id', existing.id)

          if (updateError) {
            console.error('[Callback] Error updating to pending:', updateError)
          }
        } else {
          const { error: insertError } = await userSupabase
            .from('social_accounts')
            .insert({
              user_id: userId,
              platform,
              platform_account_id: finalUploadPostUsername,
              status: 'pending',
            })

          if (insertError) {
            console.error('[Callback] Error inserting pending account:', insertError)
          }
        }

        return res.status(400).json({
          error: 'Account not connected. Please complete the connection process in Upload-Post and try again.',
          platformConnected: false,
        })
      }

      console.log('[Callback] Platform IS connected. Proceeding with connection.')

      if (existing) {
        const { error } = await userSupabase
          .from('social_accounts')
          .update({
            platform_account_id: finalUploadPostUsername,
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
        const { data, error } = await userSupabase
          .from('social_accounts')
          .insert({
            user_id: userId,
            platform,
            platform_account_id: finalUploadPostUsername,
            status: 'connected',
            connected_at: new Date().toISOString(),
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
router.delete('/accounts/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

    const { error } = await userSupabase
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
router.get('/accounts/:id/status', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

    const { data, error } = await userSupabase
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

