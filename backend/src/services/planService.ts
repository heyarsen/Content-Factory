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
  created_at: string
  updated_at: string
}

export interface VideoPlanItem {
  id: string
  plan_id: string
  scheduled_date: string
  scheduled_time: string | null
  topic: string | null
  category: 'Trading' | 'Lifestyle' | 'Fin. Freedom' | null
  description: string | null
  why_important: string | null
  useful_tips: string | null
  research_data: any
  status: 'pending' | 'researching' | 'ready' | 'generating' | 'completed' | 'failed'
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
    endDate?: string
  ): Promise<VideoPlanItem[]> {
    const plan = await this.getPlanById(planId, userId)
    
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
    
    const items: VideoPlanItem[] = []
    const currentDate = new Date(start)
    
    // Generate time slots (e.g., 9am, 2pm, 7pm for 3 videos per day)
    const timeSlots = this.generateTimeSlots(plan.videos_per_day)
    
    while (currentDate <= end) {
      for (const timeSlot of timeSlots) {
        const { data: item, error } = await supabase
          .from('video_plan_items')
          .insert({
            plan_id: planId,
            scheduled_date: currentDate.toISOString().split('T')[0],
            scheduled_time: timeSlot,
            status: 'pending',
          })
          .select()
          .single()

        if (!error && item) {
          items.push(item)
          
          // Auto-generate topic if enabled
          if (plan.auto_research) {
            this.generateTopicForItem(item.id, userId).catch(console.error)
          }
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
        availableTopic.Category as 'Trading' | 'Lifestyle' | 'Fin. Freedom'
      )

      // Update the plan item
      await supabase
        .from('video_plan_items')
        .update({
          topic: research.idea,
          category: research.category as 'Trading' | 'Lifestyle' | 'Fin. Freedom',
          description: research.description,
          why_important: research.whyItMatters,
          useful_tips: research.usefulTips,
          research_data: research,
          status: 'ready',
        })
        .eq('id', itemId)

    } catch (error: any) {
      await supabase
        .from('video_plan_items')
        .update({
          status: 'failed',
          error_message: error.message,
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
}
