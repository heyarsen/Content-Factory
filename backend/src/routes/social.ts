import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getSupabaseClientForUser } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import {
  createUserProfile,
  generateUserAccessLink,
  getUserProfile,
  getInstagramDMs,
  getAnalytics,
  sendDirectMessage,
  buildUploadPostLookupFromProfile,
  getProfileAnalytics,
} from '../lib/uploadpost.js'
import { maybeEncryptToken } from '../lib/encryption.js'
import { logSocialConnectionCheck } from '../lib/logger.js'

const router = Router()

async function resolveInstagramLookupForUser(userId: string, userToken?: string) {
  const userSupabase = userToken ? getSupabaseClientForUser(userToken) : supabase

  const { data: account, error } = await userSupabase
    .from('social_accounts')
    .select('platform_account_id, status')
    .eq('user_id', userId)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .not('platform_account_id', 'is', null)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load Instagram account: ${error.message}`)
  }

  if (!account?.platform_account_id) {
    return null
  }

  const profile = await getUserProfile(account.platform_account_id)
  return buildUploadPostLookupFromProfile(profile)
}

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
    return false
  }

  const platformLower = platform.toLowerCase()

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

    // If platformAccount is an object (not null, not empty string), it's connected
    if (platformAccount && typeof platformAccount === 'object') {
      // Verify it has connection data (display_name, username, etc.)
      if (platformAccount.display_name || platformAccount.username || Object.keys(platformAccount).length > 0) {
        return true
      }
    }

    // If platformAccount is null, empty string, or undefined, it's NOT connected
    if (platformAccount === null || platformAccount === '' || platformAccount === undefined) {
      return false
    }
  }

  // Fallback: if social_accounts doesn't exist, check if it's in the root profile
  if (profile.social_accounts && typeof profile.social_accounts === 'object') {
    const socialAccounts = profile.social_accounts
    const platformAccount = socialAccounts[platformLower] || socialAccounts[platform]

    if (platformAccount && typeof platformAccount === 'object') {
      if (platformAccount.display_name || platformAccount.username || Object.keys(platformAccount).length > 0) {
        return true
      }
    }

    if (platformAccount === null || platformAccount === '' || platformAccount === undefined) {
      return false
    }
  }

  // If we get here, social_accounts doesn't exist or platform isn't in it
  return false
}

function getRequestCorrelationId(req: AuthRequest): string | undefined {
  const requestIdHeader = req.headers['x-request-id'] || req.headers['x-correlation-id']

  if (Array.isArray(requestIdHeader)) {
    return requestIdHeader[0]
  }

  return typeof requestIdHeader === 'string' ? requestIdHeader : undefined
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function sanitizeMetadataRecord(source: Record<string, unknown>) {
  const metadata: Record<string, string | number | boolean> = {}

  Object.entries(source).forEach(([key, value]) => {
    if (value === null || value === undefined) return
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      metadata[key] = value as string | number | boolean
    }
  })

  return metadata
}

// List connected accounts
router.get('/accounts', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

    const { data, error } = await userSupabase
      .from('social_accounts')
      .select('id, user_id, platform, platform_account_id, status, connected_at')
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
              const typedPlatformAccount = platformAccount as Record<string, unknown>
              const socialImages = (typedPlatformAccount.social_images || {}) as Record<string, unknown>

              return {
                ...account,
                account_info: {
                  username: toNullableString(typedPlatformAccount.username) || toNullableString(typedPlatformAccount.handle) || null,
                  display_name: toNullableString(typedPlatformAccount.display_name) || toNullableString(typedPlatformAccount.name) || null,
                  avatar_url: toNullableString(socialImages.profile_picture) ||
                    toNullableString(typedPlatformAccount.profile_picture) ||
                    toNullableString(typedPlatformAccount.avatar_url) ||
                    null,
                  bio: toNullableString(typedPlatformAccount.bio),
                  profile_url: toNullableString(typedPlatformAccount.profile_url) || toNullableString(typedPlatformAccount.url),
                  follower_count: typeof typedPlatformAccount.follower_count === 'number'
                    ? typedPlatformAccount.follower_count
                    : null,
                  following_count: typeof typedPlatformAccount.following_count === 'number'
                    ? typedPlatformAccount.following_count
                    : null,
                  post_count: typeof typedPlatformAccount.post_count === 'number'
                    ? typedPlatformAccount.post_count
                    : null,
                  verified: typeof typedPlatformAccount.verified === 'boolean'
                    ? typedPlatformAccount.verified
                    : null,
                  metadata: sanitizeMetadataRecord(typedPlatformAccount),
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

    // Supported platforms according to Upload-Post API: instagram, tiktok, youtube, facebook, x (Twitter), linkedin, threads
    // Note: snapchat is NOT supported by Upload-Post
    const supportedPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'threads']
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
    const { platform, uploadPostUsername, access_token, refresh_token } = req.body
    const userId = req.userId!
    const user = req.user!

    if (!platform || !uploadPostUsername) {
      return res.status(400).json({ error: 'Platform and Upload-Post username are required' })
    }

    // Check if user already has an upload-post account
    const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase

    const { data: existingAccounts } = await userSupabase
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

      const tokenPayload: Record<string, any> = {}
      if (typeof access_token === 'string' && access_token.trim()) {
        tokenPayload.access_token = maybeEncryptToken(access_token)
      }
      if (typeof refresh_token === 'string' && refresh_token.trim()) {
        tokenPayload.refresh_token = maybeEncryptToken(refresh_token)
      }

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
      logSocialConnectionCheck({
        platform,
        connected: platformConnected,
        requestId: getRequestCorrelationId(req),
      })

      // If platform is NOT connected, update status to pending and return error
      if (!platformConnected) {
        if (existing) {
          const { error: updateError } = await userSupabase
            .from('social_accounts')
            .update({
              platform_account_id: finalUploadPostUsername,
              status: 'pending',
              connected_at: null,
              ...tokenPayload,
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
              ...tokenPayload,
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

      if (existing) {
        const { error } = await userSupabase
          .from('social_accounts')
          .update({
            platform_account_id: finalUploadPostUsername,
            status: 'connected',
            connected_at: new Date().toISOString(),
            ...tokenPayload,
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
            ...tokenPayload,
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

router.get('/instagram/dms', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const lookup = await resolveInstagramLookupForUser(userId, req.userToken)

    if (!lookup) {
      return res.status(400).json({ error: 'Connect Instagram account first to load DMs.' })
    }

    const dms = await getInstagramDMs({
      ...lookup,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.per_page ? Number(req.query.per_page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor as string | undefined,
      platform: 'instagram',
    })

    res.json(dms)
  } catch (error: any) {
    console.error('Get Instagram DMs error:', error)
    res.status(500).json({ error: error.message || 'Failed to get Instagram DMs' })
  }
})


router.post('/instagram/dms/send', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const lookup = await resolveInstagramLookupForUser(userId, req.userToken)

    if (!lookup) {
      return res.status(400).json({ error: 'Connect Instagram account first to send DMs.' })
    }

    const recipientId = typeof req.body?.recipient_id === 'string' ? req.body.recipient_id.trim() : ''
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''

    if (!recipientId || !message) {
      return res.status(400).json({ error: 'Missing required fields: recipient_id, message' })
    }

    const result = await sendDirectMessage({
      ...lookup,
      platform: 'instagram',
      recipientId,
      message,
    })

    return res.json(result)
  } catch (error: any) {
    console.error('Send Instagram DM error:', error)
    return res.status(500).json({ error: error.message || 'Failed to send Instagram DM' })
  }
})

router.get('/instagram/analytics', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const lookup = await resolveInstagramLookupForUser(userId, req.userToken)

    if (!lookup) {
      return res.status(400).json({ error: 'Connect Instagram account first to load analytics.' })
    }

    const metrics = typeof req.query.metrics === 'string'
      ? req.query.metrics.split(',').map((metric) => metric.trim()).filter(Boolean)
      : undefined

    const dimensions = typeof req.query.dimensions === 'string'
      ? req.query.dimensions.split(',').map((dimension) => dimension.trim()).filter(Boolean)
      : undefined

    const analytics = await getAnalytics({
      ...lookup,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.per_page ? Number(req.query.per_page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor as string | undefined,
      metrics,
      dimensions,
      platform: 'instagram',
    })

    res.json(analytics)
  } catch (error: any) {
    console.error('Get Instagram analytics error:', error)
    res.status(500).json({ error: error.message || 'Failed to get Instagram analytics' })
  }
})

router.get('/analytics/:profileUsername', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const profileUsername = (req.params.profileUsername || '').trim()
    const platformsRaw = typeof req.query.platforms === 'string' ? req.query.platforms : ''
    const platforms = platformsRaw
      .split(',')
      .map((platform) => platform.trim().toLowerCase())
      .filter(Boolean)

    if (!profileUsername) {
      return res.status(400).json({ error: 'profileUsername path param is required' })
    }

    if (!platforms.length) {
      return res.status(400).json({ error: 'platforms query param is required' })
    }

    const analytics = await getProfileAnalytics({
      profileUsername,
      platforms,
      pageId: typeof req.query.page_id === 'string' ? req.query.page_id : undefined,
      pageUrn: typeof req.query.page_urn === 'string' ? req.query.page_urn : undefined,
    })

    return res.json(analytics)
  } catch (error: any) {
    console.error('Get profile analytics error:', error)
    return res.status(500).json({ error: error.message || 'Failed to get profile analytics' })
  }
})

export default router
