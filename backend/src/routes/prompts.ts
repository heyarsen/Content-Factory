import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

interface VideoPrompt {
  id: string
  user_id: string
  name: string
  topic: string | null
  category: string | null
  description: string | null
  why_important: string | null
  useful_tips: string | null
  created_at: string
  updated_at: string
}

// Get all prompts for the authenticated user
router.get('/', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const { data, error } = await supabase
      .from('video_prompts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching prompts:', error)
      return res.status(500).json({ error: 'Failed to fetch prompts' })
    }

    res.json({ prompts: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/prompts:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Get a single prompt by ID
router.get('/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data, error } = await supabase
      .from('video_prompts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Prompt not found' })
      }
      console.error('Error fetching prompt:', error)
      return res.status(500).json({ error: 'Failed to fetch prompt' })
    }

    res.json({ prompt: data })
  } catch (error: any) {
    console.error('Error in GET /api/prompts/:id:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Create a new prompt
router.post('/', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name, topic, category, description, why_important, useful_tips } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt name is required' })
    }

    const { data, error } = await supabase
      .from('video_prompts')
      .insert({
        user_id: userId,
        name: name.trim(),
        topic: topic?.trim() || null,
        category: category?.trim() || null,
        description: description?.trim() || null,
        why_important: why_important?.trim() || null,
        useful_tips: useful_tips?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating prompt:', error)
      return res.status(500).json({ error: 'Failed to create prompt' })
    }

    res.status(201).json({ prompt: data })
  } catch (error: any) {
    console.error('Error in POST /api/prompts:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Update a prompt
router.put('/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { name, topic, category, description, why_important, useful_tips } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt name is required' })
    }

    // First check if the prompt exists and belongs to the user
    const { data: existing, error: checkError } = await supabase
      .from('video_prompts')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    const { data, error } = await supabase
      .from('video_prompts')
      .update({
        name: name.trim(),
        topic: topic?.trim() || null,
        category: category?.trim() || null,
        description: description?.trim() || null,
        why_important: why_important?.trim() || null,
        useful_tips: useful_tips?.trim() || null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating prompt:', error)
      return res.status(500).json({ error: 'Failed to update prompt' })
    }

    res.json({ prompt: data })
  } catch (error: any) {
    console.error('Error in PUT /api/prompts/:id:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Delete a prompt
router.delete('/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    // Check if the prompt exists and belongs to the user
    const { data: existing, error: checkError } = await supabase
      .from('video_prompts')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    const { error } = await supabase
      .from('video_prompts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting prompt:', error)
      return res.status(500).json({ error: 'Failed to delete prompt' })
    }

    res.status(204).send()
  } catch (error: any) {
    console.error('Error in DELETE /api/prompts/:id:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

export default router

