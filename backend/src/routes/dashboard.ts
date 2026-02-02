import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

type CountFilter =
  | { column: string; value: any }
  | { column: string; values: any[]; op: 'in' }

const countRows = async (
  table: string,
  userId: string,
  filter?: CountFilter,
) => {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (filter && 'op' in filter && filter.op === 'in') {
    query = query.in(filter.column, filter.values)
  } else if (filter && 'value' in filter) {
    query = query.eq(filter.column, filter.value)
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

    const [totalVideos, completedVideos, generatingVideos, failedVideos, pendingPosts, postedPosts] = await Promise.all([
      countRows('videos', userId),
      countRows('videos', userId, { column: 'status', value: 'completed' }),
      countRows('videos', userId, { column: 'status', value: 'generating' }),
      countRows('videos', userId, { column: 'status', value: 'failed' }),
      countRows('scheduled_posts', userId, { column: 'status', value: 'pending' }),
      countRows('scheduled_posts', userId, { column: 'status', value: 'posted' }),
    ])

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
      countRows('video_plan_items', userId, { column: 'status', value: 'failed' }),
      countRows('video_plan_items', userId, { column: 'status', values: ['pending', 'researching', 'ready', 'draft', 'approved', 'generating', 'scheduled'], op: 'in' }),
    ])

    if (videosResponse.error) {
      throw videosResponse.error
    }
    if (postsResponse.error) {
      throw postsResponse.error
    }

    const videoActivity = (videosResponse.data || []).map((video) => ({
      id: video.id,
      type: 'video',
      title: video.topic,
      status: video.status,
      timestamp: video.updated_at || video.created_at,
    }))

    const postActivity = (postsResponse.data || []).map((post) => ({
      id: post.id,
      type: 'post',
      title: post.videos?.[0]?.topic || 'Scheduled post',
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

    const nextScheduled = nextScheduledResponse.data?.[0]
      ? {
        id: nextScheduledResponse.data[0].id,
        scheduled_time: nextScheduledResponse.data[0].scheduled_time,
        platform: nextScheduledResponse.data[0].platform,
        status: nextScheduledResponse.data[0].status,
        topic: nextScheduledResponse.data[0].videos?.[0]?.topic,
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
