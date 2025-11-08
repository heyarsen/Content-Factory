import { supabase } from '../lib/supabase.js'
import { ResearchService } from './researchService.js'
import { ContentService } from './contentService.js'
import type { Topic } from '../lib/perplexity.js'

export interface VideoPlan {
  id: string
  user_id: string
  name: string
  videos_per_day: number
  start_date: string
  end_date: string | null
  enabled: boolean
  auto_research: boolean
  auto_create: boolean
  auto_schedule_trigger?: 'daily' | 'time_based' | 'manual'
  trigger_time?: string | null
  default_platforms?: string[] | null
  auto_approve?: boolean
  timezone?: string
  created_at: string
  updated_at: string
}

export interface VideoPlanItem {
  id: string
  plan_id: string
  scheduled_date: string
  scheduled_time: string | null
  topic: string | null
  category: string | null
  description: string | null
  why_important: string | null
  useful_tips: string | null
  research_data: any
  script?: string | null
  script_status?: 'draft' | 'approved' | 'rejected' | null
  platforms?: string[] | null
  caption?: string | null
  avatar_id?: string | null
  status: 'pending' | 'researching' | 'ready' | 'draft' | 'approved' | 'generating' | 'completed' | 'scheduled' | 'posted' | 'failed'
  video_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export class PlanService {
  /**
   * Create a new video plan
   */
  static async createPlan(
    userId: string,
    data: {
      name: string
      videos_per_day: number
      start_date: string
      end_date?: string | null
      enabled?: boolean
      auto_research?: boolean
      auto_create?: boolean
    }
  ): Promise<VideoPlan> {
    const { data: plan, error } = await supabase
      .from('video_plans')
      .insert({
        user_id: userId,
        name: data.name,
        videos_per_day: data.videos_per_day,
        start_date: data.start_date,
        end_date: data.end_date || null,
        enabled: data.enabled ?? true,
        auto_research: data.auto_research ?? true,
        auto_create: data.auto_create ?? false,
      })
      .select()
      .single()

    if (error) throw error
    return plan
  }

  /**
   * Get all plans for a user
   */
  static async getUserPlans(userId: string): Promise<VideoPlan[]> {
    const { data, error } = await supabase
      .from('video_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get a plan by ID
   */
  static async getPlanById(planId: string, userId: string): Promise<VideoPlan> {
    const { data, error } = await supabase
      .from('video_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new Error('Plan not found')
    return data
  }

  /**
   * Generate plan items for a date range
   */
  static async generatePlanItems(
    planId: string,
    userId: string,
    startDate: string,
    endDate?: string,
    customTimes?: string[], // Custom posting times from user
    customTopics?: string[], // Custom topics for each time slot
    customCategories?: Array<string | null>, // Custom categories for each slot
    avatarIds?: string[] // Avatar IDs for each time slot
  ): Promise<VideoPlanItem[]> {
    const plan = await this.getPlanById(planId, userId)
    
    const planTimezone = plan.timezone || 'UTC'
    const now = new Date()
    
    // Format current date in plan's timezone
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
    
    // Check if trigger_time has passed today
    let start = new Date(startDate)
    if (plan.trigger_time && startDate === today) {
      const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
      const triggerHour = parseInt(triggerHourStr, 10)
      const triggerMinute = parseInt(triggerMinuteStr || '0', 10)
      
      const triggerMinutes = triggerHour * 60 + triggerMinute
      const currentMinutes = currentHour * 60 + currentMinute
      
      // If trigger time has passed today, skip today and start from tomorrow
      if (currentMinutes >= triggerMinutes) {
        start = new Date(start)
        start.setDate(start.getDate() + 1)
        console.log(`[Plan Service] Trigger time (${plan.trigger_time}) has passed today, skipping today and starting from tomorrow`)
      }
    }
    
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
    
    const items: VideoPlanItem[] = []
    const currentDate = new Date(start)
    
    // Use custom times if provided, otherwise generate default time slots
    const timeSlots = customTimes && customTimes.length > 0 
      ? customTimes.map(t => t.length === 5 ? t : t.substring(0, 5)) // Ensure HH:MM format
      : this.generateTimeSlots(plan.videos_per_day)
    
    while (currentDate <= end) {
      for (let i = 0; i < timeSlots.length; i++) {
        const timeSlot = timeSlots[i]
        const customTopic = customTopics && customTopics[i] ? customTopics[i].trim() : null
        const customCategory = customCategories && customCategories[i] ? customCategories[i] : null
        const avatarId = avatarIds && avatarIds[i] ? avatarIds[i] : null
        
        // Determine initial status and topic
        let status: string = 'pending'
        let topic: string | null = null
        let category: string | null = null
        
        // If user provided a topic, set it directly and ALWAYS use it
        if (customTopic) {
          topic = customTopic
          category = customCategory
          // If auto_research is enabled, still set topic but mark as ready for script generation
          // The topic provided by user should ALWAYS be used, not overwritten by research
          status = plan.auto_research ? 'ready' : 'ready'
        }
        
        const { data: item, error } = await supabase
          .from('video_plan_items')
          .insert({
            plan_id: planId,
            scheduled_date: currentDate.toISOString().split('T')[0],
            scheduled_time: timeSlot,
            topic: topic,
            category: category,
            status: status,
            platforms: plan.default_platforms || null, // Set platforms from plan's default_platforms
            avatar_id: avatarId, // Store avatar_id for this time slot
          })
          .select()
          .single()

        if (!error && item) {
          items.push(item)
          
          // Only auto-generate topic if no custom topic was provided and auto_research is enabled
          // If user provided a topic, we should NOT generate a new one - use the user's topic
          if (!customTopic && plan.auto_research) {
            // No topic provided, generate one
            this.generateTopicForItem(item.id, userId).catch(console.error)
          }
          // If customTopic exists, it's already set and should be preserved
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return items
  }

  /**
   * Generate time slots based on videos per day
   */
  private static generateTimeSlots(videosPerDay: number): string[] {
    const slots: string[] = []
    const hours = [9, 12, 15, 18, 21] // 9am, 12pm, 3pm, 6pm, 9pm
    
    for (let i = 0; i < videosPerDay && i < hours.length; i++) {
      slots.push(`${hours[i].toString().padStart(2, '0')}:00:00`)
    }
    
    return slots
  }

  /**
   * Generate topic for a plan item using Perplexity
   */
  static async generateTopicForItem(itemId: string, userId: string): Promise<void> {
    // First, check if item already has a topic (user-provided)
    const { data: existingItem } = await supabase
      .from('video_plan_items')
      .select('topic')
      .eq('id', itemId)
      .single()

    // If item already has a topic, don't overwrite it - just research it if needed
    if (existingItem?.topic) {
      // Item has a user-provided topic, research it instead of generating a new one
      try {
        // Get the plan item to find category
        const { data: item } = await supabase
          .from('video_plan_items')
          .select('*, plan:video_plans(*)')
          .eq('id', itemId)
          .single()

        if (!item) throw new Error('Plan item not found')

        // Update status to researching
        await supabase
          .from('video_plan_items')
          .update({ status: 'researching' })
          .eq('id', itemId)

        // Research the existing topic
        const research = await ResearchService.researchTopic(
          existingItem.topic,
          item.category || 'general'
        )

        // Update the plan item with research data but keep the original topic
        await supabase
          .from('video_plan_items')
          .update({
            // Keep the original topic - don't overwrite it
            category: research.category as string || item.category,
            description: research.description,
            why_important: research.whyItMatters,
            useful_tips: research.usefulTips,
            research_data: research,
            status: 'ready',
          })
          .eq('id', itemId)
        
        return
      } catch (error: any) {
        console.error('Error researching existing topic:', error)
        throw error
      }
    }

    // No topic exists, generate a new one
    // Update status to researching
    await supabase
      .from('video_plan_items')
      .update({ status: 'researching' })
      .eq('id', itemId)

    try {
      // Generate topics using Perplexity
      const topics = await ResearchService.generateTopics(userId)
      
      // Get the plan item to find which category slot it should be
      const { data: item } = await supabase
        .from('video_plan_items')
        .select('*, plan:video_plans(*)')
        .eq('id', itemId)
        .single()

      if (!item) throw new Error('Plan item not found')

      // Get all items for this date to determine which topic to use
      const { data: sameDateItems } = await supabase
        .from('video_plan_items')
        .select('category')
        .eq('plan_id', item.plan_id)
        .eq('scheduled_date', item.scheduled_date)
        .order('scheduled_time')

      const usedCategories = (sameDateItems || [])
        .map((i: any) => i.category)
        .filter(Boolean)

      // Find an unused category
      const availableTopic = topics.find(
        (t) => !usedCategories.includes(t.Category)
      ) || topics[0]

      // Research the topic
      const research = await ResearchService.researchTopic(
        availableTopic.Idea,
        availableTopic.Category as string
      )

      // Update the plan item
      await supabase
        .from('video_plan_items')
        .update({
          topic: research.idea,
          category: research.category as string,
          description: research.description,
          why_important: research.whyItMatters,
          useful_tips: research.usefulTips,
          research_data: research,
          status: 'ready',
        })
        .eq('id', itemId)

    } catch (error: any) {
      // Extract user-friendly error message
      let errorMessage = error.message || 'Failed to research topic'
      
      // Handle rate limit errors specifically
      if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded. The research service is temporarily unavailable. Please try again in a few minutes.'
      } else if (errorMessage.includes('Failed to research topic')) {
        errorMessage = `Failed to research topic: ${errorMessage}`
      }
      
      await supabase
        .from('video_plan_items')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', itemId)
      throw error
    }
  }

  /**
   * Get plan items for a plan
   */
  static async getPlanItems(planId: string, userId: string): Promise<VideoPlanItem[]> {
    // Verify plan belongs to user
    await this.getPlanById(planId, userId)

    const { data, error } = await supabase
      .from('video_plan_items')
      .select('*')
      .eq('plan_id', planId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (error) throw error
    return data || []
  }

  /**
   * Update a plan item
   */
  static async updatePlanItem(
    itemId: string,
    userId: string,
    updates: Partial<VideoPlanItem>
  ): Promise<VideoPlanItem> {
    // Verify item belongs to user's plan
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('plan_id, plan:video_plans!inner(user_id)')
      .eq('id', itemId)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      throw new Error('Plan item not found')
    }

    const { data, error } = await supabase
      .from('video_plan_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Delete a plan
   */
  static async deletePlan(planId: string, userId: string): Promise<void> {
    await this.getPlanById(planId, userId) // Verify ownership

    const { error } = await supabase
      .from('video_plans')
      .delete()
      .eq('id', planId)

    if (error) throw error
  }

  /**
   * Get plans that are due for processing based on their trigger criteria
   */
  static async getPlansDueForProcessing(): Promise<VideoPlan[]> {
    const { data } = await supabase
      .from('video_plans')
      .select('*')
      .eq('enabled', true)
      .in('auto_schedule_trigger', ['daily', 'time_based'])

    return data || []
  }

  /**
   * Get items with research but no script
   */
  static async getItemsReadyForScriptGeneration(): Promise<VideoPlanItem[]> {
    const { data } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled)')
      .eq('plan.enabled', true)
      .eq('status', 'ready')
      .is('script', null)
      .not('research_data', 'is', null)

    return data || []
  }

  /**
   * Get items with draft scripts awaiting approval
   */
  static async getItemsAwaitingApproval(): Promise<VideoPlanItem[]> {
    const { data } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled)')
      .eq('plan.enabled', true)
      .eq('script_status', 'draft')

    return data || []
  }

  /**
   * Get approved scripts without videos
   */
  static async getItemsReadyForVideo(): Promise<VideoPlanItem[]> {
    const { data } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled)')
      .eq('plan.enabled', true)
      .eq('status', 'approved')
      .eq('script_status', 'approved')
      .is('video_id', null)
      .not('script', 'is', null)

    return data || []
  }

  /**
   * Get completed videos ready for distribution
   */
  static async getItemsReadyForDistribution(): Promise<VideoPlanItem[]> {
    const { data } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled), videos(*)')
      .eq('plan.enabled', true)
      .eq('status', 'completed')
      .not('video_id', 'is', null)

    return data || []
  }
}
