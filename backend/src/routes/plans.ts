import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { PlanService } from '../services/planService.js'
import { AutomationService } from '../services/automationService.js'
import { supabase } from '../lib/supabase.js'
import { ContentService } from '../services/contentService.js'
import { ScriptService } from '../services/scriptService.js'

const router = Router()

// Create a new plan
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
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

    // Generate plan items with custom times, topics, and categories if provided
    const items = await PlanService.generatePlanItems(
      plan.id, 
      userId, 
      start_date, 
      end_date || undefined,
      video_times, // Pass custom times
      video_topics, // Pass custom topics
      video_categories // Pass custom categories
    )

    return res.json({ plan, items })
  } catch (error: any) {
    console.error('Create plan error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create plan' })
  }
})

// Get all plans for user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
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
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/items/:id/generate-script', authenticate, async (req: AuthRequest, res: Response) => {
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

// Generate topic for a plan item
router.post('/items/:id/generate-topic', authenticate, async (req: AuthRequest, res: Response) => {
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
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/:id/generate-scripts', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/items/:id/approve-script', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/items/:id/reject-script', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/:id/process', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/items/:id/create-video', authenticate, async (req: AuthRequest, res: Response) => {
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
    await supabase
      .from('video_plan_items')
      .update({ status: 'generating' })
      .eq('id', id)

    // Create video using existing endpoint logic
    const { VideoService } = await import('../services/videoService.js')

    const video = await VideoService.requestManualVideo(userId, {
      topic: item.topic!,
      script: item.script!,
      style: style || 'professional',
      duration: duration || 30,
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

export default router
