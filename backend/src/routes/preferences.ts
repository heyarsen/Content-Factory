import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

// Get user preferences
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Get preferences error:', error)
      return res.status(500).json({ error: 'Failed to load preferences' })
    }

    // Return default preferences if none exist
    const preferences = data || {
      user_id: userId,
      timezone: 'UTC',
      default_platforms: [],
      notifications_enabled: true,
      auto_research_default: true,
      auto_approve_default: false,
    }

    return res.json({ preferences })
  } catch (error: any) {
    console.error('Get preferences exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Update user preferences
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const {
      timezone,
      default_platforms,
      notifications_enabled,
      auto_research_default,
      auto_approve_default,
      heygen_vertical_template_id,
      heygen_vertical_template_script_key,
      heygen_vertical_template_variables,
      heygen_vertical_template_overrides,
    } = req.body

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (timezone !== undefined) updates.timezone = timezone
    if (default_platforms !== undefined) updates.default_platforms = default_platforms
    if (notifications_enabled !== undefined) updates.notifications_enabled = notifications_enabled
    if (auto_research_default !== undefined) updates.auto_research_default = auto_research_default
    if (auto_approve_default !== undefined) updates.auto_approve_default = auto_approve_default
    if (heygen_vertical_template_id !== undefined) {
      updates.heygen_vertical_template_id =
        typeof heygen_vertical_template_id === 'string' && heygen_vertical_template_id.trim().length > 0
          ? heygen_vertical_template_id.trim()
          : null
    }
    if (heygen_vertical_template_script_key !== undefined) {
      updates.heygen_vertical_template_script_key =
        typeof heygen_vertical_template_script_key === 'string' &&
        heygen_vertical_template_script_key.trim().length > 0
          ? heygen_vertical_template_script_key.trim()
          : null
    }
    if (heygen_vertical_template_variables !== undefined) {
      if (
        heygen_vertical_template_variables === null ||
        (typeof heygen_vertical_template_variables === 'object' &&
          !Array.isArray(heygen_vertical_template_variables))
      ) {
        updates.heygen_vertical_template_variables = heygen_vertical_template_variables || {}
      } else {
        return res.status(400).json({ error: 'Template variables must be a JSON object' })
      }
    }
    if (heygen_vertical_template_overrides !== undefined) {
      if (
        heygen_vertical_template_overrides === null ||
        (typeof heygen_vertical_template_overrides === 'object' &&
          !Array.isArray(heygen_vertical_template_overrides))
      ) {
        updates.heygen_vertical_template_overrides = heygen_vertical_template_overrides || {}
      } else {
        return res.status(400).json({ error: 'Template overrides must be a JSON object' })
      }
    }

    let data
    let error

    if (existing) {
      // Update existing preferences
      const result = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single()

      data = result.data
      error = result.error
    } else {
      // Insert new preferences
      const result = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          ...updates,
        })
        .select()
        .single()

      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Update preferences error:', error)
      return res.status(500).json({ error: 'Failed to update preferences' })
    }

    return res.json({ preferences: data })
  } catch (error: any) {
    console.error('Update preferences exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
