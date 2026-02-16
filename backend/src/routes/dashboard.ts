import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

const ONBOARDING_STEP_IDS = {
  CONNECT_SOCIAL: 'connect_social_account',
  GENERATE_VIDEO: 'generate_first_video',
  SET_DEFAULTS: 'set_default_platforms_timezone',
  SCHEDULE_POST: 'schedule_first_post',
} as const

type CountFilter =
  | { column: string; value: any }
  | { column: string; values: any[]; op: 'in' }

const isInFilter = (filter: CountFilter): filter is { column: string; values: any[]; op: 'in' } => 'values' in filter

const countRows = async (
  table: string,
  userId: string,
  filter?: CountFilter,
) => {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (filter) {
    if (isInFilter(filter)) {
      query = query.in(filter.column, filter.values)
    } else {
      query = query.eq(filter.column, filter.value)
    }
  }

  const { count, error } = await query
  if (error) {
    throw error
  }

  return count ?? 0
}

const countPlanItems = async (userId: string, filter?: CountFilter) => {
  let query = supabase
    .from('video_plan_items')
    .select('id, video_plans!inner(user_id)', { count: 'exact', head: true })
    .eq('video_plans.user_id', userId)

  if (filter) {
    if (isInFilter(filter)) {
      query = query.in(filter.column, filter.values)
    } else {
      query = query.eq(filter.column, filter.value)
    }
  }

  const { count, error } = await query
  if (error) {
    throw error
  }

  return count ?? 0
}

router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const [
      totalVideos,
      completedVideos,
      generatingVideos,
      failedVideos,
      pendingPosts,
      postedPosts,
      connectedSocialAccounts,
      preferencesResponse,
      profileResponse,
    ] = await Promise.all([
      countRows('videos', userId),
      countRows('videos', userId, { column: 'status', value: 'completed' }),
      countRows('videos', userId, { column: 'status', value: 'generating' }),
      countRows('videos', userId, { column: 'status', value: 'failed' }),
      countRows('scheduled_posts', userId, { column: 'status', value: 'pending' }),
      countRows('scheduled_posts', userId, { column: 'status', value: 'posted' }),
      countRows('social_accounts', userId, { column: 'status', value: 'connected' }),
      supabase
        .from('user_preferences')
        .select('timezone, default_platforms, onboarding_checklist_hidden, onboarding_checklist_completed_steps, onboarding_completed_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('created_at')
        .eq('id', userId)
        .maybeSingle(),
    ])

    if (preferencesResponse.error) {
      throw preferencesResponse.error
    }

    if (profileResponse.error) {
      throw profileResponse.error
    }

    const preferences = preferencesResponse.data
    const accountCreatedAt = profileResponse.data?.created_at || null
    const accountAgeDays = accountCreatedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)))
      : null

    const hasDefaultPlatforms = Array.isArray(preferences?.default_platforms) && preferences.default_platforms.length > 0
    const hasTimezone = typeof preferences?.timezone === 'string' && preferences.timezone.trim().length > 0

    const autoCompletedStepIds = [
      connectedSocialAccounts > 0 ? ONBOARDING_STEP_IDS.CONNECT_SOCIAL : null,
      totalVideos > 0 ? ONBOARDING_STEP_IDS.GENERATE_VIDEO : null,
      hasDefaultPlatforms && hasTimezone ? ONBOARDING_STEP_IDS.SET_DEFAULTS : null,
      pendingPosts + postedPosts > 0 ? ONBOARDING_STEP_IDS.SCHEDULE_POST : null,
    ].filter(Boolean) as string[]

    const storedCompletedStepIds = Array.isArray(preferences?.onboarding_checklist_completed_steps)
      ? preferences.onboarding_checklist_completed_steps
      : []

    const completedSteps = Array.from(new Set([...storedCompletedStepIds, ...autoCompletedStepIds]))
    const allSteps = Object.values(ONBOARDING_STEP_IDS)
    const allCompleted = allSteps.every((stepId) => completedSteps.includes(stepId))
    const isNewUser = accountAgeDays === null ? true : accountAgeDays <= 14

    res.json({
      videos: {
        total: totalVideos,
        completed: completedVideos,
        generating: generatingVideos,
        failed: failedVideos,
      },
      posts: {
        pending: pendingPosts,
        posted: postedPosts,
      },
      onboarding: {
        isNewUser,
        accountCreatedAt,
        accountAgeDays,
        hidden: Boolean(preferences?.onboarding_checklist_hidden),
        completedSteps,
        completedAt: preferences?.onboarding_completed_at || null,
        totalSteps: allSteps.length,
        allCompleted,
      },
    })
  } catch (error: any) {
    console.error('Dashboard stats error:', error)
    res.status(500).json({ error: 'Failed to load dashboard stats' })
  }
})

router.get('/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const [videosResponse, postsResponse, totalPlans, activePlans, failedItems, inFlightItems] = await Promise.all([
      supabase
        .from('videos')
        .select('id, topic, status, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase
        .from('scheduled_posts')
        .select('id, status, platform, scheduled_time, posted_at, created_at, videos(topic)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      countRows('video_plans', userId),
      countRows('video_plans', userId, { column: 'enabled', value: true }),
      countPlanItems(userId, { column: 'status', value: 'failed' }),
      countPlanItems(userId, { column: 'status', values: ['pending', 'researching', 'ready', 'draft', 'approved', 'generating', 'scheduled'], op: 'in' }),
    ])

    if (videosResponse.error) {
      throw videosResponse.error
    }
    if (postsResponse.error) {
      throw postsResponse.error
    }

    type ScheduledPostWithVideo = {
      id: string
      status: string | null
      platform: string | null
      scheduled_time: string | null
      posted_at: string | null
      created_at: string | null
      videos?: { topic?: string | null } | { topic?: string | null }[] | null
    }

    const postsData = (postsResponse.data ?? []) as ScheduledPostWithVideo[]

    const videoActivity = (videosResponse.data || []).map((video) => ({
      id: video.id,
      type: 'video',
      title: video.topic,
      status: video.status,
      timestamp: video.updated_at || video.created_at,
    }))

    const postActivity = postsData.map((post) => ({
      id: post.id,
      type: 'post',
      title: Array.isArray(post.videos) ? post.videos?.[0]?.topic || 'Scheduled post' : post.videos?.topic || 'Scheduled post',
      status: post.status,
      platform: post.platform,
      timestamp: post.posted_at || post.scheduled_time || post.created_at,
    }))

    const activity = [...videoActivity, ...postActivity]
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8)

    const nextScheduledResponse = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_time, platform, status, videos(topic)')
      .eq('user_id', userId)
      .in('status', ['pending', 'scheduled'])
      .gte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(1)

    if (nextScheduledResponse.error) {
      throw nextScheduledResponse.error
    }

    const nextScheduledData = (nextScheduledResponse.data ?? []) as Array<{
      id: string
      scheduled_time: string | null
      platform: string | null
      status: string | null
      videos?: { topic?: string | null } | { topic?: string | null }[] | null
    }>

    const nextScheduled = nextScheduledData[0]
      ? {
        id: nextScheduledData[0].id,
        scheduled_time: nextScheduledData[0].scheduled_time,
        platform: nextScheduledData[0].platform,
        status: nextScheduledData[0].status,
        topic: Array.isArray(nextScheduledData[0].videos)
          ? nextScheduledData[0].videos?.[0]?.topic
          : nextScheduledData[0].videos?.topic,
      }
      : null

    res.json({
      activity,
      nextScheduled,
      planHealth: {
        totalPlans,
        activePlans,
        failedItems,
        inFlightItems,
      },
    })
  } catch (error: any) {
    console.error('Dashboard activity error:', error)
    res.status(500).json({ error: 'Failed to load dashboard activity' })
  }
})

export default router
