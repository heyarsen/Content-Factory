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
  talking_photo_id?: string | null
  status: 'pending' | 'researching' | 'ready' | 'draft' | 'approved' | 'generating' | 'completed' | 'scheduled' | 'posted' | 'failed'
  video_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export class PlanService {
  private static avatarColumnAvailable: boolean | null = null
  private static talkingPhotoColumnAvailable: boolean | null = null

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
    avatarIds?: string[], // Avatar IDs for each time slot
    lookIds?: Array<string | null> // Look IDs (talking_photo_id) for each time slot
  ): Promise<VideoPlanItem[]> {
    console.log(`[Plan Service] ===== generatePlanItems called =====`)
    console.log(`[Plan Service] Parameters:`, {
      planId,
      userId,
      startDate,
      endDate: endDate || 'undefined (will use 30 days)',
      customTimes: customTimes?.length || 0,
      customTopics: customTopics?.length || 0,
      customCategories: customCategories?.length || 0,
      avatarIds: avatarIds?.length || 0,
    })
    
    const plan = await this.getPlanById(planId, userId)
    console.log(`[Plan Service] Plan loaded:`, {
      id: plan.id,
      name: plan.name,
      videos_per_day: plan.videos_per_day,
      start_date: plan.start_date,
      end_date: plan.end_date,
      auto_research: plan.auto_research,
      timezone: plan.timezone,
      trigger_time: plan.trigger_time,
    })
    
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
    
    // Parse start date - handle YYYY-MM-DD format
    // Create date in UTC to avoid timezone issues
    const parseDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    }
    
    // Create a date formatter to ensure consistent YYYY-MM-DD format
  const formatDateForDB = (date: Date): string => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const isMissingColumnError = (error: any, column: string): boolean => {
    if (!error || error.code !== 'PGRST204') return false
    const message = typeof error.message === 'string' ? error.message : ''
    return message.includes(`'${column}'`)
  }
    
    let start = parseDate(startDate)
    
    // Check if trigger_time has passed today (only if start date is today)
    if (plan.trigger_time && startDate === today) {
      const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
      const triggerHour = parseInt(triggerHourStr, 10)
      const triggerMinute = parseInt(triggerMinuteStr || '0', 10)
      
      const triggerMinutes = triggerHour * 60 + triggerMinute
      const currentMinutes = currentHour * 60 + currentMinute
      
      // If trigger time has passed today, skip today and start from tomorrow
      if (currentMinutes >= triggerMinutes) {
        start = new Date(start)
        start.setUTCDate(start.getUTCDate() + 1)
        start.setUTCHours(0, 0, 0, 0)
        console.log(`[Plan Service] Trigger time (${plan.trigger_time}) has passed today, skipping today and starting from tomorrow`)
      }
    }
    
    // Calculate end date - always use adjusted start date to ensure end is after start
    let end: Date
    if (endDate) {
      end = parseDate(endDate)
      // If end date is before adjusted start date, extend it to be 30 days from start
      const adjustedStartStr = formatDateForDB(start)
      const endDateStr = formatDateForDB(end)
      if (endDateStr < adjustedStartStr) {
        console.log(`[Plan Service] End date (${endDateStr}) is before adjusted start date (${adjustedStartStr}), extending to 30 days from start`)
        end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 30, 23, 59, 59, 999))
      }
    } else {
      // Default to 30 days from adjusted start date
      end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 30, 23, 59, 59, 999))
    }
    
    const items: VideoPlanItem[] = []
    
    // Use custom times if provided, otherwise generate default time slots
    let timeSlots: string[] = []
    if (customTimes && customTimes.length > 0) {
      timeSlots = customTimes
        .filter(t => t && t.trim().length > 0) // Filter out empty times
        .map(t => {
          const cleanTime = t.trim()
          // Ensure HH:MM:SS format for database
          if (cleanTime.length === 5) return `${cleanTime}:00`
          if (cleanTime.length === 8) return cleanTime
          return cleanTime.substring(0, 5) + ':00'
        })
    }
    
    // If no custom times or all were empty, generate default time slots
    if (timeSlots.length === 0) {
      timeSlots = this.generateTimeSlots(plan.videos_per_day)
    }
    
    // Ensure we have at least one time slot
    if (timeSlots.length === 0) {
      console.error(`[Plan Service] ERROR: No time slots available! videos_per_day: ${plan.videos_per_day}`)
      return []
    }
    
    console.log(`[Plan Service] Generating items from ${formatDateForDB(start)} to ${formatDateForDB(end)}`)
    console.log(`[Plan Service] Time slots (${timeSlots.length}):`, timeSlots)
    console.log(`[Plan Service] Videos per day:`, plan.videos_per_day)
    console.log(`[Plan Service] Start date:`, start.toISOString(), `(${formatDateForDB(start)})`)
    console.log(`[Plan Service] End date:`, end.toISOString(), `(${formatDateForDB(end)})`)
    
    // Iterate through each day from start to end using date strings
    let currentDateStr = formatDateForDB(start)
    const endDateStr = formatDateForDB(end)
    let dayCount = 0
    const maxDays = 365 // Safety limit
    
    console.log(`[Plan Service] Date range: ${currentDateStr} to ${endDateStr}`)
    console.log(`[Plan Service] Date comparison: ${currentDateStr} <= ${endDateStr} = ${currentDateStr <= endDateStr}`)
    
    if (currentDateStr > endDateStr) {
      console.error(`[Plan Service] ERROR: Start date (${currentDateStr}) is after end date (${endDateStr})!`)
      console.error(`[Plan Service] This can happen if:`)
      console.error(`[Plan Service]   1. Trigger time has passed and start was moved to tomorrow, but end_date is today`)
      console.error(`[Plan Service]   2. End date is before start date`)
      console.error(`[Plan Service]   3. Date calculation error`)
      console.error(`[Plan Service] Original startDate parameter: ${startDate}`)
      console.error(`[Plan Service] Original endDate parameter: ${endDate || 'null (30 days default)'}`)
      console.error(`[Plan Service] Adjusted start date: ${formatDateForDB(start)}`)
      console.error(`[Plan Service] Calculated end date: ${formatDateForDB(end)}`)
      console.error(`[Plan Service] Plan timezone: ${planTimezone}`)
      console.error(`[Plan Service] Today in plan timezone: ${today}`)
      console.error(`[Plan Service] Plan trigger_time: ${plan.trigger_time}`)
      throw new Error(`Start date (${currentDateStr}) is after end date (${endDateStr}). This usually happens when the trigger time has passed and the start date was adjusted, but the end date is set to today or earlier.`)
    }
    
    while (currentDateStr <= endDateStr && dayCount < maxDays) {
      dayCount++
      
      if (dayCount === 1 || dayCount % 10 === 0 || dayCount <= 5) {
        console.log(`[Plan Service] Processing day ${dayCount}: ${currentDateStr}`)
      }
      
      for (let i = 0; i < timeSlots.length; i++) {
        const timeSlot = timeSlots[i]
        const customTopic = customTopics && customTopics[i] ? customTopics[i].trim() : null
        const customCategory = customCategories && customCategories[i] ? customCategories[i] : null
        // Extract avatarId, ensuring it's a valid non-empty string or null
        let avatarId: string | null = null
        if (avatarIds && avatarIds[i]) {
          const rawAvatarId = avatarIds[i]
          if (typeof rawAvatarId === 'string' && rawAvatarId.trim().length > 0) {
            avatarId = rawAvatarId.trim()
          }
        }
        
        // Extract lookId (talking_photo_id), ensuring it's a valid non-empty string or null
        let lookId: string | null = null
        if (lookIds && lookIds[i]) {
          const rawLookId = lookIds[i]
          if (typeof rawLookId === 'string' && rawLookId.trim().length > 0) {
            lookId = rawLookId.trim()
          }
        }
        
        // Determine initial status and topic
        let status: string = 'pending'
        let topic: string | null = null
        let category: string | null = null
        
        // If user provided a topic, set it directly and ALWAYS use it
        if (customTopic) {
          topic = customTopic
          category = customCategory
          status = plan.auto_research ? 'ready' : 'ready'
        }
        
        try {
          // Build insert data object, only including avatar_id if it's provided
          // This makes the code work even if the avatar_id column doesn't exist yet
          const insertData: any = {
            plan_id: planId,
            scheduled_date: currentDateStr, // Use date string directly
            scheduled_time: timeSlot,
            topic: topic,
            category: category,
            status: status,
            platforms: plan.default_platforms || null,
          }
          
          // Only include avatar_id if it's provided and not empty
          // This prevents errors if the column doesn't exist in the database
          // Check if avatarId is a non-empty string
          if (PlanService.avatarColumnAvailable !== false && avatarId && typeof avatarId === 'string' && avatarId.trim().length > 0) {
            insertData.avatar_id = avatarId.trim()
          }

          // Include talking_photo_id (look ID) if provided
          if (PlanService.talkingPhotoColumnAvailable !== false && lookId && typeof lookId === 'string' && lookId.trim().length > 0) {
            insertData.talking_photo_id = lookId.trim()
          }
          
          console.log(`[Plan Service] Inserting item:`, {
            plan_id: planId,
            scheduled_date: currentDateStr,
            scheduled_time: timeSlot,
            topic: topic || 'null',
            category: category || 'null',
            status,
            platforms: plan.default_platforms,
            avatar_id: avatarId || 'null (not included)',
            talking_photo_id: lookId || 'null (not included)',
          })
          
          const insertPlanItem = () =>
            supabase
              .from('video_plan_items')
              .insert(insertData)
              .select()
              .single()

          let { data: item, error } = await insertPlanItem()

          if (error && isMissingColumnError(error, 'avatar_id') && 'avatar_id' in insertData) {
            console.warn('[Plan Service] ⚠️ avatar_id column missing in video_plan_items, skipping avatar assignment until migration 007 runs')
            delete insertData.avatar_id
            PlanService.avatarColumnAvailable = false
            ;({ data: item, error } = await insertPlanItem())
          }

          if (error && isMissingColumnError(error, 'talking_photo_id') && 'talking_photo_id' in insertData) {
            console.warn('[Plan Service] ⚠️ talking_photo_id column missing in video_plan_items, skipping look assignment until migration 012 runs')
            delete insertData.talking_photo_id
            PlanService.talkingPhotoColumnAvailable = false
            ;({ data: item, error } = await insertPlanItem())
          }

          if (!error) {
            if ('avatar_id' in insertData && PlanService.avatarColumnAvailable === null) {
              PlanService.avatarColumnAvailable = true
            }
            if ('talking_photo_id' in insertData && PlanService.talkingPhotoColumnAvailable === null) {
              PlanService.talkingPhotoColumnAvailable = true
            }
          }

          if (error) {
            console.error(`[Plan Service] ❌ ERROR creating item for ${currentDateStr} at ${timeSlot}:`, error)
            console.error(`[Plan Service] Error code:`, error.code)
            console.error(`[Plan Service] Error message:`, error.message)
            console.error(`[Plan Service] Error details:`, JSON.stringify(error, null, 2))
            console.error(`[Plan Service] Insert data was:`, JSON.stringify(insertData, null, 2))
            // Continue to next item instead of failing completely
            // But log this as a critical error if it's the first item
            if (items.length === 0 && dayCount === 1 && i === 0) {
              console.error(`[Plan Service] ⚠️ CRITICAL: First item creation failed! This might indicate a systemic issue.`)
              throw new Error(`Failed to create plan items: ${error.message} (Code: ${error.code})`)
            }
          } else if (item) {
            items.push(item)
            if (items.length <= 5 || items.length % 10 === 0) {
              console.log(`[Plan Service] ✓ Created item ${items.length} for ${currentDateStr} at ${timeSlot} (ID: ${item.id})`)
            }
            
            // Only auto-generate topic if no custom topic was provided and auto_research is enabled
            if (!customTopic && plan.auto_research) {
              this.generateTopicForItem(item.id, userId).catch((err) => {
                console.error(`[Plan Service] Error generating topic for item ${item.id}:`, err)
              })
            }
          } else {
            console.warn(`[Plan Service] ⚠️ No item returned for ${currentDateStr} at ${timeSlot} (no error, but no data either)`)
          }
        } catch (err: any) {
          console.error(`[Plan Service] ❌ EXCEPTION creating item for ${currentDateStr} at ${timeSlot}:`, err)
          if (err.stack) {
            console.error(`[Plan Service] Exception stack:`, err.stack)
          }
          // If this is the first item and we have no items yet, throw to fail fast
          if (items.length === 0 && dayCount === 1 && i === 0) {
            throw err
          }
        }
      }
      
      // Move to next day by incrementing the date string
      const [year, month, day] = currentDateStr.split('-').map(Number)
      const nextDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))
      currentDateStr = formatDateForDB(nextDate)
    }
    
    if (dayCount >= maxDays) {
      console.warn(`[Plan Service] Stopped after ${maxDays} days (safety limit)`)
    }
    
    console.log(`[Plan Service] ✓ Generated ${items.length} plan items total over ${dayCount} days`)
    
    if (items.length === 0) {
      const errorDetails = {
        planId,
        userId,
        startDate: formatDateForDB(start),
        endDate: formatDateForDB(end),
        originalStartDate: startDate,
        originalEndDate: endDate || 'null (30 days default)',
        timeSlots,
        videosPerDay: plan.videos_per_day,
        dayCount,
        timeSlotsLength: timeSlots.length,
        customTimesProvided: customTimes?.length || 0,
        customTopicsProvided: customTopics?.length || 0,
        customCategoriesProvided: customCategories?.length || 0,
        currentDateStr,
        endDateStr,
        dateComparison: currentDateStr <= endDateStr,
        planTimezone,
        today,
        triggerTime: plan.trigger_time,
      }
      console.error(`[Plan Service] ⚠️ ERROR: No items were created!`, JSON.stringify(errorDetails, null, 2))
      
      // Check if we actually processed any days
      if (dayCount === 0) {
        throw new Error(`No days were processed. Start date: ${currentDateStr}, End date: ${endDateStr}. This might indicate a date calculation issue.`)
      }
      
      // Throw an error to ensure the caller knows items failed to create
      throw new Error(`Failed to create any plan items after processing ${dayCount} days. Start: ${currentDateStr}, End: ${endDateStr}, Time slots: ${timeSlots.length}. Check backend logs for detailed error information.`)
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
   * Generate a topic for a plan item and mark it ready for script generation.
   * Research is intentionally skipped.
   */
  static async generateTopicForItem(itemId: string, userId: string): Promise<void> {
    // First, check if item already has a topic (user-provided)
    const { data: existingItem } = await supabase
      .from('video_plan_items')
      .select('topic')
      .eq('id', itemId)
      .single()

    // If item already has a topic, don't overwrite it - mark ready immediately.
    if (existingItem?.topic) {
      try {
        // Get the plan item to find category
        const { data: item } = await supabase
          .from('video_plan_items')
          .select('*, plan:video_plans(*)')
          .eq('id', itemId)
          .single()

        if (!item) throw new Error('Plan item not found')

        const updateData: any = {
          status: 'ready',
          error_message: null,
          category: item.category || 'general',
        }

        await supabase
          .from('video_plan_items')
          .update(updateData)
          .eq('id', itemId)
        
        return
      } catch (error: any) {
        console.error('Error preparing existing topic:', error)
        throw error
      }
    }

    // No topic exists, generate a new one

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

      // Update the plan item
      await supabase
        .from('video_plan_items')
        .update({
          topic: availableTopic.Idea,
          category: availableTopic.Category as string,
          status: 'ready',
          error_message: null,
        })
        .eq('id', itemId)

    } catch (error: any) {
      // Extract user-friendly error message
      let errorMessage = error.message || 'Failed to prepare topic'
      
      // Handle rate limit errors specifically
      if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded. The research service is temporarily unavailable. Please try again in a few minutes.'
      } else if (errorMessage.includes('Failed to prepare topic')) {
        errorMessage = `Failed to prepare topic: ${errorMessage}`
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
    const plan = await this.getPlanById(planId, userId)

    const { data, error } = await supabase
      .from('video_plan_items')
      .select('*, videos(*)')
      .eq('plan_id', planId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (error) throw error
    const items = data || []

    // If an item has no explicit platforms configured, inherit from plan defaults.
    // This keeps legacy items and newly-generated items consistent in API responses.
    return items.map((item: VideoPlanItem) => {
      if (item.platforms == null && plan.default_platforms != null) {
        return { ...item, platforms: plan.default_platforms }
      }
      return item
    })
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
   * Get items ready for script generation.
   */
  static async getItemsReadyForScriptGeneration(): Promise<VideoPlanItem[]> {
    const { data } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled)')
      .eq('plan.enabled', true)
      .eq('status', 'ready')
      .is('script', null)

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
