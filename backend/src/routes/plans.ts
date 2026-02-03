import { Router, Response } from 'express'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { PlanService } from '../services/planService.js'
import { AutomationService } from '../services/automationService.js'
import { supabase } from '../lib/supabase.js'
import { ContentService } from '../services/contentService.js'
import { ScriptService } from '../services/scriptService.js'

const router = Router()

function normalizeVideoStyleForDb(style: any): string {
  const raw = (typeof style === 'string' ? style : '').trim()
  if (!raw) return 'Cinematic'

  const allowed = [
    'Casual',
    'Cinematic',
    'Educational',
    'Energetic',
    'Professional',
    'Realistic',
    'Anime',
    '3D Render',
    'Cyberpunk',
    'Minimalist',
    'Documentary',
  ]

  if (allowed.includes(raw)) return raw

  const lower = raw.toLowerCase()
  if (lower === 'professional') return 'Professional'
  if (lower === 'casual') return 'Casual'
  if (lower === 'energetic') return 'Energetic'
  if (lower === 'educational') return 'Educational'
  if (lower === '3d' || lower === '3d_render' || lower === '3drender') return '3D Render'

  const ci = allowed.find(s => s.toLowerCase() === lower)
  if (ci) return ci

  return 'Realistic'
}

// Create a new plan
router.post('/', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const {
      name,
      videos_per_day,
      start_date,
      end_date,
      enabled,
      auto_research,
      auto_create,
      auto_schedule_trigger,
      trigger_time,
      default_platforms,
      auto_approve,
      timezone,
      video_times, // Custom posting times for each video slot
      video_topics, // Custom topics for each video slot
      video_categories, // Custom categories for each video slot
      video_avatars, // Avatar IDs for each video slot
      video_looks, // Look IDs (talking_photo_id) for each video slot
    } = req.body

    if (!name || !videos_per_day || !start_date) {
      return res.status(400).json({ error: 'name, videos_per_day, and start_date are required' })
    }

    const { data: plan, error: planError } = await supabase
      .from('video_plans')
      .insert({
        user_id: userId,
        name,
        videos_per_day: parseInt(videos_per_day),
        start_date,
        end_date: end_date || null,
        enabled: enabled !== false,
        auto_research: auto_research !== false,
        auto_create: auto_create === true,
        auto_schedule_trigger: auto_schedule_trigger || 'daily',
        trigger_time: trigger_time || null,
        default_platforms: default_platforms || null,
        auto_approve: auto_approve === true,
        timezone: timezone || 'UTC',
      })
      .select()
      .single()

    if (planError) throw planError

    console.log(`[Plans API] Creating plan ${plan.id} for user ${userId}`, {
      name,
      videos_per_day,
      start_date,
      end_date,
      video_times,
      video_topics: video_topics?.length,
      video_avatars: video_avatars?.length
    })

    // Generate plan items with custom times, topics, categories, and avatars if provided
    let items: any[] = []
    let itemsGenerationError: string | null = null
    try {
      items = await PlanService.generatePlanItems(
        plan.id,
        userId,
        start_date,
        end_date || undefined,
        video_times, // Pass custom times
        video_topics, // Pass custom topics
        video_categories, // Pass custom categories
        video_avatars, // Pass avatar IDs for each time slot
        video_looks // Pass look IDs (talking_photo_id) for each time slot
      )
      console.log(`[Plans API] Generated ${items.length} items for plan ${plan.id}`)
      if (items.length === 0) {
        console.error(`[Plans API] WARNING: generatePlanItems returned empty array for plan ${plan.id}`)
        console.error(`[Plans API] Plan details:`, {
          planId: plan.id,
          userId,
          start_date,
          end_date,
          videos_per_day,
          video_times: video_times?.length || 0,
          video_topics: video_topics?.length || 0,
          video_categories: video_categories?.length || 0,
          video_avatars: video_avatars?.length || 0,
        })
        // Try to fetch items from database in case they were created but not returned
        try {
          const existingItems = await PlanService.getPlanItems(plan.id, userId)
          if (existingItems.length > 0) {
            console.log(`[Plans API] Found ${existingItems.length} existing items in database, using those instead`)
            items = existingItems
          }
        } catch (fetchError) {
          console.error(`[Plans API] Error fetching existing items:`, fetchError)
        }
      }
    } catch (itemError: any) {
      console.error(`[Plans API] Error generating plan items:`, itemError)
      console.error(`[Plans API] Error stack:`, itemError?.stack)
      console.error(`[Plans API] Error details:`, JSON.stringify(itemError, null, 2))
      itemsGenerationError = itemError.message || 'Failed to generate plan items'

      // Try to fetch items from database in case some were created before the error
      try {
        const existingItems = await PlanService.getPlanItems(plan.id, userId)
        if (existingItems.length > 0) {
          console.log(`[Plans API] Found ${existingItems.length} existing items in database after error, using those`)
          items = existingItems
          itemsGenerationError = null // Clear error if we found items
        }
      } catch (fetchError) {
        console.error(`[Plans API] Error fetching existing items after generation error:`, fetchError)
      }
    }

    return res.json({
      plan,
      items: items || [],
      itemsCount: items.length,
      hasItems: items.length > 0,
      ...(itemsGenerationError && { warning: itemsGenerationError })
    })
  } catch (error: any) {
    console.error('Create plan error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create plan' })
  }
})

// Get all plans for user
router.get('/', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const plans = await PlanService.getUserPlans(userId)
    return res.json({ plans })
  } catch (error: any) {
    console.error('Get plans error:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch plans' })
  }
})

// Get a specific plan with items
router.get('/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const plan = await PlanService.getPlanById(id, userId)
    const items = await PlanService.getPlanItems(id, userId)

    return res.json({ plan, items })
  } catch (error: any) {
    console.error('Get plan error:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch plan' })
  }
})

// Update a plan
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const updates = req.body

    const plan = await PlanService.getPlanById(id, userId)

    const { data, error } = await supabase
      .from('video_plans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return res.json({ plan: data })
  } catch (error: any) {
    console.error('Update plan error:', error)
    return res.status(500).json({ error: error.message || 'Failed to update plan' })
  }
})

// Generate script for a plan item
router.post('/items/:id/generate-script', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await AutomationService.generateScriptForItem(id, userId)

    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', id)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      return res.status(404).json({ error: 'Plan item not found' })
    }

    return res.json({ item })
  } catch (error: any) {
    console.error('Generate script error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate script' })
  }
})

// Get content variety analysis
router.get('/variety-analysis', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { days = 30 } = req.query

    const { ContentVarietyService } = await import('../services/contentVarietyService.js')
    const analysis = await ContentVarietyService.analyzeContentVariety(userId, Number(days))

    return res.json({ analysis })
  } catch (error: any) {
    console.error('Content variety analysis error:', error)
    return res.status(500).json({ error: error.message || 'Failed to analyze content variety' })
  }
})

// Get daily variety report
router.get('/daily-variety-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const { ContentVarietyService } = await import('../services/contentVarietyService.js')
    const report = await ContentVarietyService.getDailyVarietyReport(userId)

    return res.json({ report })
  } catch (error: any) {
    console.error('Daily variety report error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate daily variety report' })
  }
})

// Generate topic for a plan item
router.post('/items/:id/generate-topic', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await PlanService.generateTopicForItem(id, userId)

    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', id)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      return res.status(404).json({ error: 'Plan item not found' })
    }

    return res.json({ item })
  } catch (error: any) {
    console.error('Generate topic error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate topic' })
  }
})

// Update a plan item
router.patch('/items/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const updates = req.body

    const item = await PlanService.updatePlanItem(id, userId, updates)
    return res.json({ item })
  } catch (error: any) {
    console.error('Update plan item error:', error)
    return res.status(500).json({ error: error.message || 'Failed to update plan item' })
  }
})

// Delete a plan
router.delete('/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await PlanService.deletePlan(id, userId)
    return res.json({ success: true })
  } catch (error: any) {
    console.error('Delete plan error:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete plan' })
  }
})

// Generate scripts for a plan date
router.post('/:id/generate-scripts', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { date } = req.body

    if (!date) {
      return res.status(400).json({ error: 'date is required' })
    }

    await AutomationService.generateTopicsForDate(id, date, userId)

    // Then generate scripts for ready items
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('plan_id', id)
      .eq('scheduled_date', date)
      .eq('status', 'ready')
      .is('script', null)

    for (const item of items || []) {
      await AutomationService.generateScriptForItem(item.id, userId).catch(console.error)
    }

    return res.json({ success: true })
  } catch (error: any) {
    console.error('Generate scripts error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate scripts' })
  }
})

// Approve a script
router.post('/items/:id/approve-script', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await AutomationService.approveScript(id, userId)

    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', id)
      .single()

    return res.json({ item })
  } catch (error: any) {
    console.error('Approve script error:', error)
    return res.status(500).json({ error: error.message || 'Failed to approve script' })
  }
})

// Reject a script
router.post('/items/:id/reject-script', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    await AutomationService.rejectScript(id, userId)

    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', id)
      .single()

    return res.json({ item })
  } catch (error: any) {
    console.error('Reject script error:', error)
    return res.status(500).json({ error: error.message || 'Failed to reject script' })
  }
})

// Manually trigger full pipeline for a plan
router.post('/:id/process', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const plan = await PlanService.getPlanById(id, userId)

    // Generate topics for today
    const today = new Date().toISOString().split('T')[0]
    await AutomationService.generateTopicsForDate(id, today, userId)

    // Generate scripts for ready items
    await AutomationService.generateScriptsForReadyItems()

    // Generate videos for approved items
    await AutomationService.generateVideosForApprovedItems()

    // Schedule distribution
    await AutomationService.scheduleDistributionForCompletedVideos()

    return res.json({ success: true, message: 'Pipeline processing started' })
  } catch (error: any) {
    console.error('Process plan error:', error)
    return res.status(500).json({ error: error.message || 'Failed to process plan' })
  }
})

// Create video from plan item
router.post('/items/:id/create-video', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { style, duration } = req.body

    // Get plan item
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', id)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      return res.status(404).json({ error: 'Plan item not found' })
    }

    if (item.status !== 'approved' || item.script_status !== 'approved') {
      return res.status(400).json({ error: 'Plan item must be approved to create video' })
    }

    if (!item.script) {
      return res.status(400).json({ error: 'Plan item must have a script to create video' })
    }

    // Update status
    const claimResult = await supabase
      .from('video_plan_items')
      .update({ status: 'generating' })
      .eq('id', id)
      .eq('status', 'approved')
      .is('video_id', null)
      .select()

    if (!claimResult.data || claimResult.data.length === 0) {
      return res.status(409).json({
        error: 'Video is already being generated or has been generated for this plan item.',
      })
    }

    // Create video using existing endpoint logic
    const { VideoService } = await import('../services/videoService.js')

    const normalizedStyle = normalizeVideoStyleForDb(style)

    const video = await VideoService.requestManualVideo(userId, {
      topic: item.topic!,
      script: item.script!,
      style: normalizedStyle,
      duration: duration || 30,
      plan_item_id: id,
    })

    // Update plan item with video
    await supabase
      .from('video_plan_items')
      .update({
        video_id: video.id,
        status: 'completed',
      })
      .eq('id', id)

    return res.json({ video, item: { ...item, video_id: video.id, status: 'completed' } })
  } catch (error: any) {
    console.error('Create video from plan error:', error)

    // Update status to failed
    try {
      await supabase
        .from('video_plan_items')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', req.params.id)
    } catch (updateError) {
      console.error('Failed to update plan item status:', updateError)
    }

    return res.status(500).json({ error: error.message || 'Failed to create video' })
  }
})

// Refresh posting status for a plan item (check scheduled posts and update status)
router.post('/items/:id/refresh-status', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    // Get the plan item
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id), videos(*)')
      .eq('id', id)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      return res.status(404).json({ error: 'Plan item not found' })
    }

    // Check scheduled posts for this video
    const { data: posts } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('video_id', item.video_id)
      .order('created_at', { ascending: false })

    console.log(`[Status Refresh] Item ${id} has ${posts?.length || 0} scheduled post(s)`)

    let statusUpdated = false
    let newStatus = item.status

    if (!posts || posts.length === 0) {
      // No posts - if video is completed and scheduled time has passed, it should be posted
      if (item.status === 'completed' && item.video_id && item.scheduled_date && item.scheduled_time) {
        // Check if it's time to post
        const now = new Date()
        const planTimezone = (item.plan as any).timezone || 'UTC'

        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: planTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const hourFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: planTimezone,
          hour: '2-digit',
          hour12: false,
        })
        const minuteFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: planTimezone,
          minute: '2-digit',
          hour12: false,
        })

        const today = dateFormatter.format(now)
        const currentHour = parseInt(hourFormatter.format(now), 10)
        const currentMinute = parseInt(minuteFormatter.format(now), 10)

        const [postHours, postMinutes] = item.scheduled_time.split(':')
        const postHour = parseInt(postHours, 10)
        const postMinute = parseInt(postMinutes || '0', 10)

        const postMinutesTotal = postHour * 60 + postMinute
        const currentMinutesTotal = currentHour * 60 + currentMinute
        const timeDiffMinutes = (item.scheduled_date === today)
          ? (postMinutesTotal - currentMinutesTotal)
          : (item.scheduled_date < today ? -999999 : 999999)

        // If scheduled time has passed, trigger posting
        if (timeDiffMinutes <= 1 && item.scheduled_date <= today) {
          console.log(`[Status Refresh] Item ${id} scheduled time passed, triggering posting...`)
          // Trigger the distribution service
          await AutomationService.scheduleDistributionForCompletedVideos()
          statusUpdated = true
        }
      }
    } else {
      // Check post statuses
      const allPosted = posts.every((p: any) => p.status === 'posted')
      const allFailed = posts.every((p: any) => p.status === 'failed')
      const anyPending = posts.some((p: any) => p.status === 'pending' || p.status === 'scheduled')

      console.log(`[Status Refresh] Post statuses: allPosted=${allPosted}, allFailed=${allFailed}, anyPending=${anyPending}`)

      // Check status of pending posts via Upload-Post API
      if (anyPending) {
        const { getUploadStatus } = await import('../lib/uploadpost.js')
        for (const post of posts) {
          if ((post.status === 'pending' || post.status === 'scheduled') && post.upload_post_id) {
            try {
              const uploadStatus = await getUploadStatus(post.upload_post_id)
              const platformResult = uploadStatus.results?.find((r: any) => r.platform === post.platform)

              if (platformResult) {
                const newPostStatus = platformResult.status === 'success' ? 'posted' :
                  platformResult.status === 'failed' ? 'failed' :
                    'pending'

                if (newPostStatus !== post.status) {
                  await supabase
                    .from('scheduled_posts')
                    .update({
                      status: newPostStatus,
                      posted_at: newPostStatus === 'posted' ? new Date().toISOString() : post.posted_at,
                      error_message: platformResult.error || null,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', post.id)

                  console.log(`[Status Refresh] Updated post ${post.id} (${post.platform}) from ${post.status} to ${newPostStatus}`)
                }
              }
            } catch (error: any) {
              console.error(`[Status Refresh] Error checking upload status for post ${post.id}:`, error.message)
            }
          }
        }

        // Re-fetch posts after updates
        const { data: updatedPosts } = await supabase
          .from('scheduled_posts')
          .select('status')
          .eq('video_id', item.video_id)

        if (updatedPosts) {
          const allNowPosted = updatedPosts.every((p: any) => p.status === 'posted')
          const allNowFailed = updatedPosts.every((p: any) => p.status === 'failed')

          if (allNowPosted) {
            newStatus = 'posted'
          } else if (allNowFailed) {
            newStatus = 'failed'
          }
        }
      } else if (allPosted) {
        newStatus = 'posted'
      } else if (allFailed) {
        newStatus = 'failed'
      }

      // Update item status if it changed
      if (newStatus !== item.status) {
        await supabase
          .from('video_plan_items')
          .update({ status: newStatus })
          .eq('id', id)
        statusUpdated = true
        console.log(`[Status Refresh] Updated item ${id} status from '${item.status}' to '${newStatus}'`)
      }
    }

    // Return updated item
    const { data: updatedItem } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id), videos(*)')
      .eq('id', id)
      .single()

    return res.json({
      item: updatedItem,
      statusUpdated,
      posts: posts || [],
      message: statusUpdated ? `Status updated to '${newStatus}'` : `Status is '${item.status}' (no change)`,
    })
  } catch (error: any) {
    console.error('Refresh status error:', error)
    return res.status(500).json({ error: error.message || 'Failed to refresh status' })
  }
})

export default router
