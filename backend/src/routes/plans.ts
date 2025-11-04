import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { PlanService } from '../services/planService.js'
import { supabase } from '../lib/supabase.js'
import { ContentService } from '../services/contentService.js'
import { ScriptService } from '../services/scriptService.js'

const router = Router()

// Create a new plan
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name, videos_per_day, start_date, end_date, enabled, auto_research, auto_create } = req.body

    if (!name || !videos_per_day || !start_date) {
      return res.status(400).json({ error: 'name, videos_per_day, and start_date are required' })
    }

    const plan = await PlanService.createPlan(userId, {
      name,
      videos_per_day: parseInt(videos_per_day),
      start_date,
      end_date: end_date || null,
      enabled: enabled !== false,
      auto_research: auto_research !== false,
      auto_create: auto_create === true,
    })

    // Generate plan items
    const items = await PlanService.generatePlanItems(plan.id, userId, start_date, end_date || undefined)

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

    if (item.status !== 'ready') {
      return res.status(400).json({ error: 'Plan item must be ready to create video' })
    }

    // Update status
    await supabase
      .from('video_plan_items')
      .update({ status: 'generating' })
      .eq('id', id)

    // Create video using existing endpoint logic
    const { VideoService } = await import('../services/videoService.js')
    
    const script = await ScriptService.generateScriptCustom({
      idea: item.topic!,
      description: item.description || '',
      whyItMatters: item.why_important || '',
      usefulTips: item.useful_tips || '',
      category: item.category!,
    })

    const video = await VideoService.createVideo(userId, {
      topic: item.topic!,
      script,
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
    await supabase
      .from('video_plan_items')
      .update({
        status: 'failed',
        error_message: error.message,
      })
      .eq('id', req.params.id)
      .catch(console.error)

    return res.status(500).json({ error: error.message || 'Failed to create video' })
  }
})

export default router
