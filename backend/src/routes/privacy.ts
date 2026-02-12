import { Router, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { PRIVACY_POLICY_VERSION, COOKIE_POLICY_VERSION, CONSENT_BANNER_VERSION } from '../config/privacy.js'
import { buildPrivacyExportPayload, getDeletionSchedule, isDeletionConfirmationValid } from '../services/privacyService.js'

const router = Router()

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many export requests, please try again later.',
})

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many deletion requests, please try again later.',
})

const consentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many consent updates, please try again later.',
})

router.post('/consent', authenticate, consentLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { categories, region, policyVersion, bannerVersion, consentedAt } = req.body as {
      categories: Record<string, boolean>
      region: string
      policyVersion: string
      bannerVersion: string
      consentedAt: string
    }

    if (!categories || typeof categories !== 'object') {
      return res.status(400).json({ error: 'Consent categories are required.' })
    }

    const { error } = await supabase
      .from('privacy_consents')
      .insert({
        user_id: userId,
        consented_at: consentedAt || new Date().toISOString(),
        region: region || 'unknown',
        policy_version: policyVersion || PRIVACY_POLICY_VERSION,
        banner_version: bannerVersion || CONSENT_BANNER_VERSION,
        categories,
        user_agent: req.get('User-Agent') || null,
        ip_address: req.ip || null,
        cookie_policy_version: COOKIE_POLICY_VERSION,
      })

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('privacy_consents table is missing; skipping consent persistence')
        return res.json({ success: true, skipped: true })
      }
      console.error('Consent insert error:', error)
      return res.status(500).json({ error: 'Failed to save consent.' })
    }

    return res.json({ success: true })
  } catch (error: any) {
    console.error('Consent route error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/export', authenticate, exportLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !userData?.user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const [
      profileResult,
      preferencesResult,
      socialAccountsResult,
      videosResult,
      scheduledPostsResult,
      videoPlansResult,
      videoPlanItemsResult,
      videoPromptsResult,
      contentItemsResult,
      reelsResult,
      avatarsResult,
      supportTicketsResult,
      supportMessagesResult,
      creditTransactionsResult,
      subscriptionsResult,
      consentLogsResult,
      deletionRequestsResult,
    ] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('social_accounts')
        .select('id, user_id, platform, platform_account_id, status, connected_at')
        .eq('user_id', userId),
      supabase.from('videos').select('*').eq('user_id', userId),
      supabase.from('scheduled_posts').select('*').eq('user_id', userId),
      supabase.from('video_plans').select('*').eq('user_id', userId),
      supabase.from('video_plan_items').select('*').eq('user_id', userId),
      supabase.from('video_prompts').select('*').eq('user_id', userId),
      supabase.from('content_items').select('*').eq('user_id', userId),
      supabase.from('reels').select('*').eq('user_id', userId),
      supabase.from('avatars').select('*').eq('user_id', userId),
      supabase.from('support_tickets').select('*').eq('user_id', userId),
      supabase.from('support_messages').select('*').eq('user_id', userId),
      supabase.from('credit_transactions').select('*').eq('user_id', userId),
      supabase.from('user_subscriptions').select('*').eq('user_id', userId),
      supabase.from('privacy_consents').select('*').eq('user_id', userId),
      supabase.from('deletion_requests').select('*').eq('user_id', userId),
    ])

    const errorList = [
      profileResult.error,
      preferencesResult.error,
      socialAccountsResult.error,
      videosResult.error,
      scheduledPostsResult.error,
      videoPlansResult.error,
      videoPlanItemsResult.error,
      videoPromptsResult.error,
      contentItemsResult.error,
      reelsResult.error,
      avatarsResult.error,
      supportTicketsResult.error,
      supportMessagesResult.error,
      creditTransactionsResult.error,
      subscriptionsResult.error,
      consentLogsResult.error,
      deletionRequestsResult.error,
    ].filter(Boolean)

    if (errorList.length > 0) {
      console.error('Privacy export errors:', errorList)
      return res.status(500).json({ error: 'Failed to export data' })
    }

    const payload = buildPrivacyExportPayload({
      user: {
        id: userData.user.id,
        email: userData.user.email,
        phone: userData.user.phone,
        createdAt: userData.user.created_at,
        lastSignInAt: userData.user.last_sign_in_at,
        emailConfirmedAt: userData.user.email_confirmed_at,
        identities: userData.user.identities,
        userMetadata: userData.user.user_metadata,
        appMetadata: userData.user.app_metadata,
      },
      profile: profileResult.data || null,
      preferences: preferencesResult.data || null,
      socialAccounts: socialAccountsResult.data || [],
      videos: videosResult.data || [],
      scheduledPosts: scheduledPostsResult.data || [],
      videoPlans: videoPlansResult.data || [],
      videoPlanItems: videoPlanItemsResult.data || [],
      videoPrompts: videoPromptsResult.data || [],
      contentItems: contentItemsResult.data || [],
      reels: reelsResult.data || [],
      avatars: avatarsResult.data || [],
      supportTickets: supportTicketsResult.data || [],
      supportMessages: supportMessagesResult.data || [],
      creditTransactions: creditTransactionsResult.data || [],
      subscriptions: subscriptionsResult.data || [],
      consentLogs: consentLogsResult.data || [],
      deletionRequests: deletionRequestsResult.data || [],
    })

    const filename = `content-factory-data-export-${new Date().toISOString().split('T')[0]}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    return res.status(200).json(payload)
  } catch (error: any) {
    console.error('Privacy export error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/delete', authenticate, deleteLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { confirm, reason } = req.body as { confirm?: string; reason?: string }

    if (!isDeletionConfirmationValid(confirm)) {
      return res.status(400).json({ error: 'Confirmation token missing or invalid.' })
    }

    const schedule = getDeletionSchedule()

    const { error } = await supabase
      .from('deletion_requests')
      .insert({
        user_id: userId,
        requested_at: schedule.requestedAt,
        scheduled_for: schedule.scheduledFor,
        reason: reason || null,
        status: 'pending',
      })

    if (error) {
      console.error('Deletion request error:', error)
      return res.status(500).json({ error: 'Failed to create deletion request.' })
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        deletion_requested_at: schedule.requestedAt,
        deletion_scheduled_for: schedule.scheduledFor,
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Profile deletion update error:', profileError)
      return res.status(500).json({ error: 'Failed to update profile deletion status.' })
    }

    return res.json({
      success: true,
      status: 'pending',
      requestedAt: schedule.requestedAt,
      scheduledFor: schedule.scheduledFor,
      gracePeriodDays: schedule.gracePeriodDays,
    })
  } catch (error: any) {
    console.error('Deletion request error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
