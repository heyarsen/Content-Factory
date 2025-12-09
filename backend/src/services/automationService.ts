import { supabase } from '../lib/supabase.js'
import { PlanService } from './planService.js'
import { ResearchService } from './researchService.js'
import { ScriptService } from './scriptService.js'
import { VideoService } from './videoService.js'
import { postVideo } from '../lib/uploadpost.js'

export class AutomationService {
  /**
   * Process scheduled plans - generate topics for due dates
   */
  static async processScheduledPlans(): Promise<void> {
    const { data: plans } = await supabase
      .from('video_plans')
      .select('*')
      .eq('enabled', true)
      .in('auto_schedule_trigger', ['daily', 'time_based'])

    if (!plans) return

    const now = new Date()
    let pipelineTriggered = false

    for (const plan of plans) {
      try {
        const planTimezone = plan.timezone || 'UTC'

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
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: planTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })

        const currentHour = parseInt(hourFormatter.format(now), 10)
        const currentMinute = parseInt(minuteFormatter.format(now), 10)
        const today = dateFormatter.format(now)

        let shouldProcessPlan = plan.auto_schedule_trigger !== 'daily'

        // For daily trigger, check if it's time to process (at or past trigger time, within 5 minutes window)
        if (plan.auto_schedule_trigger === 'daily' && plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = currentHour * 60 + currentMinute

          // Process if we're at or past the trigger time (within 5 minutes window)
          // This ensures we catch the trigger time exactly when cron runs
          shouldProcessPlan = currentMinutes >= triggerMinutes && (currentMinutes - triggerMinutes) <= 5
        }

        if (!shouldProcessPlan) {
          continue
        }
        
        console.log(`[Automation] Processing plan ${plan.id} at trigger time ${plan.trigger_time || 'N/A'}`)

        pipelineTriggered = true

        // Get pending items for today that need research
        // Also check items that match the trigger time (if scheduled_time is set)
        const query = supabase
          .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('status', 'pending')
          .eq('scheduled_date', today)
        
        // If trigger_time is set, also filter by scheduled_time matching trigger_time
        if (plan.trigger_time) {
          query.eq('scheduled_time', plan.trigger_time)
        }
        
        const { data: pendingItems } = await query.limit(plan.videos_per_day)

        if (pendingItems && pendingItems.length > 0) {
          const researchPromises: Promise<void>[] = []
          
          for (const item of pendingItems) {
            // If item has a topic but status is pending, check if we need to research it
            if (plan.auto_research) {
              if (item.topic) {
                // Has user-provided topic - research it (generateTopicForItem will preserve the topic)
                // This will research the topic without overwriting it
                researchPromises.push(
                  PlanService.generateTopicForItem(item.id, plan.user_id).catch((error) => {
                    console.error(`Error researching topic for item ${item.id}:`, error)
                  })
                )
              } else {
                // No topic, generate topic first (which will also research it)
                researchPromises.push(
                  PlanService.generateTopicForItem(item.id, plan.user_id).catch((error) => {
                    console.error(`Error generating topic for item ${item.id}:`, error)
                  })
                )
              }
            } else if (item.topic) {
              // Has topic but no auto_research, mark as ready for script generation
              await supabase
                .from('video_plan_items')
                .update({ status: 'ready' })
                .eq('id', item.id)
            }
          }

          // Wait for all research to complete before generating scripts
          await Promise.all(researchPromises)
          
          // Small delay to ensure database updates are reflected
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Also check for items that are 'ready' but might have been missed
        // Prioritize items that match the trigger time
        const readyQuery = supabase
          .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('scheduled_date', today)
          .eq('status', 'ready')
          .is('script', null)
        
        // If trigger_time is set, prioritize items matching that time
        if (plan.trigger_time) {
          readyQuery.eq('scheduled_time', plan.trigger_time)
        }
        
        const { data: readyItems } = await readyQuery.limit(plan.videos_per_day)

        // Generate scripts for today's items (including items that are already ready from previous runs)
        if (readyItems && readyItems.length > 0) {
          console.log(`[Automation] Found ${readyItems.length} ready items for script generation at trigger time`)
        await this.generateScriptsForTodayItems(plan.id, today, plan.auto_approve || false)
        // Small delay to ensure script generation updates are reflected
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          // Also try to generate scripts for items that might already be ready (without time filter)
          await this.generateScriptsForTodayItems(plan.id, today, plan.auto_approve || false)
        await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Generate videos for today's approved items
        console.log(`[Automation] Checking for approved items to generate videos for plan ${plan.id}`)
        await this.generateVideosForTodayItems(plan.id, today, plan.user_id, plan.auto_create || false, plan.trigger_time || undefined)
      } catch (error) {
        console.error(`Error processing plan ${plan.id}:`, error)
      }
    }
  }

  /**
   * Generate scripts for today's items in a specific plan
   */
  static async generateScriptsForTodayItems(planId: string, today: string, autoApprove: boolean): Promise<void> {
    // Get plan to get userId
    const { data: plan } = await supabase
      .from('video_plans')
      .select('user_id')
      .eq('id', planId)
      .single()

    if (!plan) {
      throw new Error('Plan not found')
    }

    const userId = plan.user_id

    // Get items with research data for today
    const { data: itemsWithResearch } = await supabase
      .from('video_plan_items')
      .select('*')
      .eq('plan_id', planId)
      .eq('scheduled_date', today)
      .eq('status', 'ready')
      .is('script', null)
      .not('research_data', 'is', null)
      .limit(10)

    // Also get items with topics but no research (will use topic directly)
    const { data: itemsWithTopic } = await supabase
      .from('video_plan_items')
      .select('*')
      .eq('plan_id', planId)
      .eq('scheduled_date', today)
      .eq('status', 'ready')
      .is('script', null)
      .is('research_data', null)
      .not('topic', 'is', null)
      .limit(10)

    const allItems = [...(itemsWithResearch || []), ...(itemsWithTopic || [])]

    if (allItems.length === 0) return

    for (const item of allItems) {
      try {
        // Update status to show script generation in progress IMMEDIATELY
        // This ensures the UI shows "Generating Script" right away
        const updateResult = await supabase
          .from('video_plan_items')
          .update({ 
            status: 'draft', // Using 'draft' status to indicate script generation
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
          .select()

        if (updateResult.error) {
          console.error(`[Script Generation] Failed to update status for item ${item.id}:`, updateResult.error)
        } else {
          console.log(`[Script Generation] Updated item ${item.id} status to 'draft' (Generating Script) - Topic: "${item.topic || 'N/A'}"`)
        }

        const research = item.research_data

        // If no research but has topic, use topic directly
        const script = await ScriptService.generateScriptCustom({
          idea: item.topic || research?.Idea || '',
          description: item.description || research?.Description || '',
          whyItMatters: item.why_important || research?.WhyItMatters || '',
          usefulTips: item.useful_tips || research?.UsefulTips || '',
          category: item.category || research?.Category || 'general',
        }, userId)

        const newStatus = autoApprove ? 'approved' : 'draft'
        const scriptStatus = autoApprove ? 'approved' : 'draft'

        const finalUpdate = await supabase
          .from('video_plan_items')
          .update({
            script,
            script_status: scriptStatus,
            status: newStatus,
          })
          .eq('id', item.id)
          .select()

        if (finalUpdate.error) {
          console.error(`[Script Generation] Failed to save script for item ${item.id}:`, finalUpdate.error)
        } else {
          console.log(`[Script Generation] Generated script for today's item ${item.id}, status: ${newStatus}`)
          
          // If auto_approve is enabled, immediately trigger video generation
          if (autoApprove && newStatus === 'approved') {
            console.log(`[Script Generation] Auto-approved script for item ${item.id}, triggering immediate video generation`)
            // Get plan to check auto_create setting
            const { data: plan } = await supabase
              .from('video_plans')
              .select('user_id, auto_create')
              .eq('id', planId)
              .single()
            
            if (plan && plan.auto_create) {
              // Immediately generate video for this item
              try {
                const { data: updatedItem } = await supabase
                  .from('video_plan_items')
                  .select('*')
                  .eq('id', item.id)
                  .single()
                
                if (updatedItem) {
                  // ATOMIC UPDATE: Only update if video_id is still null to prevent duplicate video creation
                  const statusUpdate = await supabase
                    .from('video_plan_items')
                    .update({ status: 'generating' })
                    .eq('id', item.id)
                    .eq('status', 'approved')
                    .is('video_id', null) // CRITICAL: Only update if video_id is still null
                    .select()
                  
                  // Check if update actually succeeded (item might have been claimed by another process)
                  if (!statusUpdate.data || statusUpdate.data.length === 0 || statusUpdate.data[0].video_id) {
                    console.log(`[Video Generation] Item ${item.id} was already claimed by another process (video_id already set), skipping immediate generation`)
                    continue // Another process already claimed this item
                  }
                  
                  // Get avatar_id and talking_photo_id from plan item (optional - will fall back to default avatar if not provided)
                  const avatarId = (updatedItem as any).avatar_id
                  const talkingPhotoId = (updatedItem as any).talking_photo_id
                  
                  console.log(`[Video Generation] ✓ Claimed item ${item.id} for immediate video generation`, {
                    topic: updatedItem.topic,
                    hasAvatarId: !!avatarId,
                    hasTalkingPhotoId: !!talkingPhotoId,
                    avatarId: avatarId || 'will use default avatar',
                    talkingPhotoId: talkingPhotoId || 'none'
                  })
                  
                  // VideoService.requestManualVideo will automatically use default avatar if avatar_id is not provided
                  const video = await VideoService.requestManualVideo(plan.user_id, {
                    topic: updatedItem.topic || 'Video Content',
                    script: updatedItem.script || '',
                    style: 'professional',
                    duration: 30,
                    avatar_id: avatarId, // Can be undefined - will fall back to default
                    talking_photo_id: talkingPhotoId, // Look ID if provided
                    plan_item_id: item.id,
                  })
                  
                  // ATOMIC UPDATE: Set video_id and keep status as 'generating'
                  const finalUpdate = await supabase
                    .from('video_plan_items')
                    .update({
                      video_id: video.id,
                      status: 'generating', // Keep as generating until video is ready
                    })
                    .eq('id', item.id)
                    .eq('status', 'generating') // Only update if still in generating state
                    .select()
                  
                  if (finalUpdate.error) {
                    console.error(`[Video Generation] Failed to update video_id for item ${item.id}:`, finalUpdate.error)
                  } else if (!finalUpdate.data || finalUpdate.data.length === 0) {
                    console.warn(`[Video Generation] ⚠️ Item ${item.id} status changed before video_id could be set (race condition prevented)`)
                  } else {
                    console.log(`[Video Generation] ✅ Video generation started for item ${item.id}, video_id: ${video.id}. Status: generating (will update to completed when video is ready)`)
                  }
                }
              } catch (videoError: any) {
                console.error(`[Video Generation] Error immediately generating video for item ${item.id}:`, videoError)
                await supabase
                  .from('video_plan_items')
                  .update({
                    status: 'failed',
                    error_message: videoError.message,
                  })
                  .eq('id', item.id)
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`Error generating script for today's item ${item.id}:`, error)
        await supabase
          .from('video_plan_items')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', item.id)
      }
    }
  }

  /**
   * Generate videos for today's approved items in a specific plan
   */
  static async generateVideosForTodayItems(planId: string, today: string, userId: string, autoCreate: boolean, triggerTime?: string): Promise<void> {
    // Only auto-create if auto_create is enabled
    if (!autoCreate) return

    const query = supabase
      .from('video_plan_items')
      .select('*')
      .eq('plan_id', planId)
      .eq('scheduled_date', today)
      .eq('status', 'approved')
      .eq('script_status', 'approved')
      .is('video_id', null)
      .not('script', 'is', null)
    
    // If trigger_time is provided, prioritize items matching that time
    if (triggerTime) {
      query.eq('scheduled_time', triggerTime)
    }
    
    const { data: items } = await query.limit(10)

    if (!items || items.length === 0) return

    for (const item of items) {
      try {
        // ATOMIC UPDATE: Only update if video_id is still null to prevent duplicate video creation
        // This ensures only one process can claim this item for video generation
        const statusUpdate = await supabase
          .from('video_plan_items')
          .update({ 
            status: 'generating',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
          .eq('status', 'approved')
          .is('video_id', null) // CRITICAL: Only update if video_id is still null
          .select()

        if (statusUpdate.error) {
          console.error(`[Video Generation] Failed to update status for item ${item.id}:`, statusUpdate.error)
          continue // Skip this item
        }

        // Check if update actually succeeded (item might have been claimed by another process)
        if (!statusUpdate.data || statusUpdate.data.length === 0) {
          console.log(`[Video Generation] Item ${item.id} was already claimed by another process (video_id already set), skipping`)
          continue // Another process already claimed this item
        }

        const updatedItem = statusUpdate.data[0]
        if (updatedItem.video_id) {
          console.log(`[Video Generation] Item ${item.id} already has video_id ${updatedItem.video_id}, skipping duplicate creation`)
          continue // Item already has a video
        }

        console.log(`[Video Generation] ✓ Claimed item ${item.id} for video generation - Topic: "${item.topic || 'N/A'}"`)

        if (!item.topic || !item.script) {
          throw new Error('Missing topic or script for video generation')
        }

        // Get avatar_id and talking_photo_id from plan item (optional - will fall back to default avatar if not provided)
        const avatarId = (item as any).avatar_id
        const talkingPhotoId = (item as any).talking_photo_id
        
        console.log(`[Video Generation] Creating video for item ${item.id}`, {
          topic: item.topic,
          scriptLength: item.script?.length || 0,
          hasAvatarId: !!avatarId,
          hasTalkingPhotoId: !!talkingPhotoId,
          avatarId: avatarId || 'will use default avatar',
          talkingPhotoId: talkingPhotoId || 'none'
        })
        
        // VideoService.requestManualVideo will automatically use default avatar if avatar_id is not provided
        // Ensure we're using the correct topic - use item.topic as the primary topic
        // The script should already be based on this topic, but we pass both for clarity
        const video = await VideoService.requestManualVideo(userId, {
          topic: item.topic || 'Video Content', // Ensure topic is never empty
          script: item.script, // Script should match the topic
          style: 'professional',
          duration: 30,
          avatar_id: avatarId, // Can be undefined - will fall back to default avatar
          talking_photo_id: talkingPhotoId, // Look ID if provided
          plan_item_id: item.id,
        })

        console.log(`[Video Generation] Video created with ID: ${video.id}, topic: "${video.topic}"`)

        // ATOMIC UPDATE: Set video_id and keep status as 'generating'
        // Only update if status is still 'generating' (prevent overwriting if another process changed it)
        const finalUpdate = await supabase
          .from('video_plan_items')
          .update({
            video_id: video.id,
            status: 'generating', // Keep as generating until video is ready
          })
          .eq('id', item.id)
          .eq('status', 'generating') // Only update if still in generating state
          .select()

        if (finalUpdate.error) {
          console.error(`[Video Generation] Failed to update video_id for item ${item.id}:`, finalUpdate.error)
        } else if (!finalUpdate.data || finalUpdate.data.length === 0) {
          console.warn(`[Video Generation] ⚠️ Item ${item.id} status changed before video_id could be set (race condition prevented)`)
        } else {
          console.log(`[Video Generation] ✅ Video generation started for item ${item.id}, video_id: ${video.id}. Status: generating (will update to completed when video is ready)`)
        }
      } catch (error: any) {
        console.error(`Error generating video for today's item ${item.id}:`, error)
        const errorMessage = error?.message || 'Failed to create video record'
        await supabase
          .from('video_plan_items')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', item.id)
      }
    }
  }

  /**
   * Generate research for items with topics but no research
   * Only processes today's items after trigger time
   */
  static async generateResearchForReadyItems(): Promise<void> {
    const now = new Date()
    
    // Get all enabled plans with trigger times and auto_research enabled
    const { data: plans } = await supabase
      .from('video_plans')
      .select('id, trigger_time, timezone, user_id, auto_research')
      .eq('enabled', true)
      .eq('auto_research', true)
      .in('auto_schedule_trigger', ['daily', 'time_based'])
      .not('trigger_time', 'is', null)

    if (!plans || plans.length === 0) return

    // Process each plan that has passed its trigger time today
    for (const plan of plans) {
      try {
        const planTimezone = plan.timezone || 'UTC'
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

        // Check if trigger time has passed
        if (plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = currentHour * 60 + currentMinute

          // Only process if trigger time has passed
          if (currentMinutes < triggerMinutes) {
            continue // Skip this plan, trigger time hasn't arrived yet
          }
        }

        // Get items with topics but no research for today
        const query = supabase
      .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('scheduled_date', today)
      .eq('status', 'ready')
      .not('topic', 'is', null)
      .is('research_data', null)
        
        if (plan.trigger_time) {
          query.eq('scheduled_time', plan.trigger_time)
        }
        
        const { data: items } = await query.limit(10)

        if (!items || items.length === 0) continue

    for (const item of items) {
      try {
            if (!item.topic) continue

        // Generate research for the topic
        await PlanService.generateTopicForItem(item.id, plan.user_id)
      } catch (error: any) {
        console.error(`Error generating research for item ${item.id}:`, error)
          }
        }
      } catch (error: any) {
        console.error(`Error processing plan ${plan.id} for research generation:`, error)
      }
    }
  }

  /**
   * Generate script for items with research but no script
   * Only processes today's items after trigger time
   */
  static async generateScriptsForReadyItems(): Promise<void> {
    const now = new Date()
    
    // Get all enabled plans with trigger times
    const { data: plans } = await supabase
      .from('video_plans')
      .select('id, trigger_time, timezone, auto_approve, user_id')
      .eq('enabled', true)
      .in('auto_schedule_trigger', ['daily', 'time_based'])
      .not('trigger_time', 'is', null)

    if (!plans || plans.length === 0) return

    // Process each plan that has passed its trigger time today
    for (const plan of plans) {
      try {
        const planTimezone = plan.timezone || 'UTC'
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

        // Check if trigger time has passed
        if (plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = currentHour * 60 + currentMinute

          // Only process if trigger time has passed
          if (currentMinutes < triggerMinutes) {
            continue // Skip this plan, trigger time hasn't arrived yet
          }
        }

        // Get items with research data for today
        const researchQuery = supabase
      .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('scheduled_date', today)
      .eq('status', 'ready')
      .is('script', null)
      .not('research_data', 'is', null)
        
        if (plan.trigger_time) {
          researchQuery.eq('scheduled_time', plan.trigger_time)
        }
        
        const { data: itemsWithResearch } = await researchQuery.limit(10)

        // Get items with topics but no research for today
        const topicQuery = supabase
      .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('scheduled_date', today)
      .eq('status', 'ready')
      .is('script', null)
      .is('research_data', null)
      .not('topic', 'is', null)
        
        if (plan.trigger_time) {
          topicQuery.eq('scheduled_time', plan.trigger_time)
        }
        
        const { data: itemsWithTopic } = await topicQuery.limit(10)

    const allItems = [...(itemsWithResearch || []), ...(itemsWithTopic || [])]

        if (allItems.length === 0) continue

    for (const item of allItems) {
      try {
            // Update status to show script generation in progress
            await supabase
              .from('video_plan_items')
              .update({ status: 'draft' }) // Using 'draft' status to indicate script generation
              .eq('id', item.id)

        const research = item.research_data

            // Prioritize item.topic over research.Idea - user's topic input should always be used
            const topicToUse = item.topic || research?.Idea || ''
            if (!topicToUse) {
              throw new Error('No topic available for script generation')
            }

        // If no research but has topic, use topic directly
        const script = await ScriptService.generateScriptCustom({
              idea: topicToUse, // Always use the item's topic first
          description: item.description || research?.Description || '',
          whyItMatters: item.why_important || research?.WhyItMatters || '',
          usefulTips: item.useful_tips || research?.UsefulTips || '',
          category: item.category || research?.Category || 'general',
        }, plan.user_id)
            
            console.log(`[Script Generation] Generated script for today's item ${item.id}, topic: "${topicToUse}"`)

        const newStatus = plan.auto_approve ? 'approved' : 'draft'
        const scriptStatus = plan.auto_approve ? 'approved' : 'draft'

        await supabase
          .from('video_plan_items')
          .update({
            script,
            script_status: scriptStatus,
            status: newStatus,
          })
          .eq('id', item.id)
      } catch (error: any) {
        console.error(`Error generating script for item ${item.id}:`, error)
        await supabase
          .from('video_plan_items')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', item.id)
          }
        }
      } catch (error: any) {
        console.error(`Error processing plan ${plan.id} for script generation:`, error)
      }
    }
  }

  /**
   * Generate videos for approved scripts
   * Only processes today's items after trigger time
   */
  static async generateVideosForApprovedItems(): Promise<void> {
    const now = new Date()
    
    // Get all enabled plans with trigger times and auto_create enabled
    const { data: plans } = await supabase
      .from('video_plans')
      .select('id, trigger_time, timezone, user_id, auto_create')
      .eq('enabled', true)
      .eq('auto_create', true)
      .in('auto_schedule_trigger', ['daily', 'time_based'])
      .not('trigger_time', 'is', null)

    if (!plans || plans.length === 0) return

    // Process each plan that has passed its trigger time today
    for (const plan of plans) {
      try {
        const planTimezone = plan.timezone || 'UTC'
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

        // Check if trigger time has passed
        if (plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = currentHour * 60 + currentMinute

          // Only process if trigger time has passed
          if (currentMinutes < triggerMinutes) {
            continue // Skip this plan, trigger time hasn't arrived yet
          }
        }

        // Get approved items for today that need videos
        // NOTE: We only query for status='approved' so items in 'generating' status are automatically excluded
        const query = supabase
      .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('scheduled_date', today)
      .eq('status', 'approved')
      .eq('script_status', 'approved')
      .is('video_id', null)
      .not('script', 'is', null)
        
        if (plan.trigger_time) {
          query.eq('scheduled_time', plan.trigger_time)
        }
        
        const { data: items } = await query.limit(5)

        if (!items || items.length === 0) continue

    for (const item of items) {
      try {
            // Double-check: Verify no video already exists for this plan_item_id
            // This prevents creating duplicate videos if the video_id wasn't set in the plan_item yet
            const { data: existingVideos, error: videoCheckError } = await supabase
          .from('videos')
          .select('id, status')
          .eq('plan_item_id', item.id)
          .limit(1)

            if (videoCheckError && videoCheckError.code !== 'PGRST116') {
              // PGRST116 is "no rows returned" which is expected if no video exists
              console.error(`[Video Generation] Error checking for existing video for item ${item.id}:`, videoCheckError)
            }

            if (existingVideos && existingVideos.length > 0) {
              const existingVideo = existingVideos[0]
              console.log(`[Video Generation] Video already exists for item ${item.id} (video_id: ${existingVideo.id}, status: ${existingVideo.status}), skipping duplicate creation`)
              // Update plan item to link to existing video if not already linked
              await supabase
            .from('video_plan_items')
            .update({ 
              video_id: existingVideo.id,
              status: existingVideo.status === 'completed' ? 'completed' : 
                      existingVideo.status === 'failed' ? 'failed' : 'generating'
            })
            .eq('id', item.id)
            .is('video_id', null)
              continue
            }

            // ATOMIC UPDATE: Only update if video_id is still null AND status is still 'approved' to prevent duplicate video creation
            // This atomic update ensures only one process can claim this item for video generation
            const statusUpdate = await supabase
          .from('video_plan_items')
          .update({ status: 'generating' })
          .eq('id', item.id)
          .eq('status', 'approved') // Must still be 'approved' (prevents race conditions)
          .is('video_id', null) // CRITICAL: Only update if video_id is still null
              .select()

            if (statusUpdate.error) {
              console.error(`[Video Generation] Failed to update status for item ${item.id}:`, statusUpdate.error)
              continue // Skip this item
            }

            // Check if update actually succeeded (item might have been claimed by another process)
            if (!statusUpdate.data || statusUpdate.data.length === 0) {
              console.log(`[Video Generation] Item ${item.id} was already claimed by another process (status changed or video_id set), skipping`)
              continue // Another process already claimed this item
            }

            const updatedItem = statusUpdate.data[0]
            if (updatedItem.video_id) {
              console.log(`[Video Generation] Item ${item.id} already has video_id ${updatedItem.video_id}, skipping duplicate creation`)
              continue // Item already has a video
            }

            console.log(`[Video Generation] ✓ Claimed item ${item.id} for video generation`)

            if (!item.topic || !item.script) {
              throw new Error('Missing topic or script for video generation')
            }

            // Get avatar_id and talking_photo_id from plan item
            const avatarId = (item as any).avatar_id
            const talkingPhotoId = (item as any).talking_photo_id

            console.log(`[Video Generation] Creating video for today's item ${item.id} with topic: ${item.topic}`, {
              hasAvatarId: !!avatarId,
              hasTalkingPhotoId: !!talkingPhotoId
            })
            
            // Create video record - this happens synchronously
            const video = await VideoService.requestManualVideo(plan.user_id, {
              topic: item.topic,
              script: item.script,
          style: 'professional',
          duration: 30,
          avatar_id: avatarId, // Can be undefined - will fall back to default avatar
          talking_photo_id: talkingPhotoId, // Look ID if provided
          plan_item_id: item.id,
        })

            // IMMEDIATE ATOMIC UPDATE: Set video_id right after video record is created to prevent duplicates
            // This must happen immediately, not asynchronously
            const finalUpdate = await supabase
          .from('video_plan_items')
          .update({
            video_id: video.id,
            status: 'generating', // Keep as generating until video is ready
          })
          .eq('id', item.id)
          .eq('status', 'generating') // Only update if still in generating state (we just set it)
          .is('video_id', null) // Double-check: video_id should still be null
              .select()

            if (finalUpdate.error) {
              console.error(`[Video Generation] Failed to update video_id for item ${item.id}:`, finalUpdate.error)
              // If update fails, mark video as failed to prevent orphaned videos
              await supabase
            .from('videos')
            .update({ status: 'failed', error_message: 'Failed to link video to plan item' })
            .eq('id', video.id)
            } else if (!finalUpdate.data || finalUpdate.data.length === 0) {
              console.warn(`[Video Generation] ⚠️ Item ${item.id} status changed before video_id could be set (race condition prevented)`)
              // If update fails, mark video as failed to prevent orphaned videos
              await supabase
            .from('videos')
            .update({ status: 'failed', error_message: 'Failed to link video to plan item - race condition' })
            .eq('id', video.id)
            } else {
              console.log(`[Video Generation] ✅ Generated video for today's item ${item.id}, video_id: ${video.id}. Status: generating (will update to completed when video is ready)`)
            }
      } catch (error: any) {
        console.error(`Error generating video for item ${item.id}:`, error)
            const errorMessage = error?.message || 'Failed to create video record'
        
        // Reset status back to 'approved' so it can be retried, or mark as 'failed' if it's a persistent error
        const shouldRetry = !errorMessage.includes('avatar') && !errorMessage.includes('API key')
        await supabase
          .from('video_plan_items')
          .update({
            status: shouldRetry ? 'approved' : 'failed',
                error_message: errorMessage,
          })
          .eq('id', item.id)
          .eq('status', 'generating') // Only update if still in generating state
          }
        }
      } catch (error: any) {
        console.error(`Error processing plan ${plan.id} for video generation:`, error)
      }
    }
  }

  /**
   * Check video status and schedule distribution for completed videos
   * This runs frequently to check video status updates and post at scheduled times
   */
  static async checkVideoStatusAndScheduleDistribution(): Promise<void> {
    // First, check and update pending async uploads
    await this.checkPendingUploadStatus()
    // Then, schedule new distributions
    await this.scheduleDistributionForCompletedVideos()
  }

  /**
   * Check status of pending async uploads and update scheduled posts
   */
  static async checkPendingUploadStatus(): Promise<void> {
    // Get all pending scheduled posts with upload_post_id
    const { data: pendingPosts } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .not('upload_post_id', 'is', null)
      .limit(20) // Check up to 20 posts at a time

    if (!pendingPosts || pendingPosts.length === 0) {
      return
    }

    console.log(`[Distribution] Checking status for ${pendingPosts.length} pending uploads`)

    const { getUploadStatus } = await import('../lib/uploadpost.js')

    for (const post of pendingPosts) {
      if (!post.upload_post_id) continue

      try {
        const uploadStatus = await getUploadStatus(post.upload_post_id)
        console.log(`[Distribution] Upload status for post ${post.id} (${post.platform}):`, {
          status: uploadStatus.status,
          resultsCount: uploadStatus.results?.length || 0,
        })

        // Find the platform-specific result using case-insensitive matching
        const postPlatformLower = post.platform?.toLowerCase()
        const platformResult = uploadStatus.results?.find((r: any) => {
          const resultPlatformLower = r.platform?.toLowerCase()
          return resultPlatformLower === postPlatformLower
        })

        // Log all available platforms for debugging
        const availablePlatforms = uploadStatus.results?.map((r: any) => r.platform) || []
        console.log(`[Distribution] Platform result for ${post.platform}:`, {
          platformResult: platformResult ? {
            status: platformResult.status,
            success: (platformResult as any).success,
            error: platformResult.error,
            post_id: platformResult.post_id,
            platform: platformResult.platform,
          } : 'not found',
          overallStatus: uploadStatus.status,
          resultsCount: uploadStatus.results?.length || 0,
          availablePlatforms,
          searchingFor: postPlatformLower,
        })

        if (platformResult) {
          // Check multiple possible status values: 'success', 'completed', 'posted'
          // Also check for success boolean or success property
          const platformResultAny = platformResult as any
          const isSuccess = platformResult.status === 'success' || 
                           platformResult.status === 'completed' || 
                           platformResult.status === 'posted' ||
                           platformResultAny.success === true ||
                           (platformResultAny.success !== false && !platformResult.error && platformResult.post_id)
          
          const isFailed = platformResult.status === 'failed' || 
                          platformResult.error || 
                          (platformResultAny.success === false)

          const newStatus = isSuccess ? 'posted' :
                           isFailed ? 'failed' :
                           'pending'

          console.log(`[Distribution] Status determination for post ${post.id}:`, {
            platformResultStatus: platformResult.status,
            platformResultSuccess: (platformResult as any).success,
            hasError: !!platformResult.error,
            hasPostId: !!platformResult.post_id,
            isSuccess,
            isFailed,
            newStatus,
            currentStatus: post.status,
          })

          // Only update if status changed
          if (newStatus !== post.status) {
            await supabase
              .from('scheduled_posts')
              .update({
                status: newStatus,
                posted_at: newStatus === 'posted' ? new Date().toISOString() : post.posted_at,
                error_message: platformResult.error || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', post.id)

            console.log(`[Distribution] ✅ Updated post ${post.id} (${post.platform}) from '${post.status}' to '${newStatus}'`)

            // If post succeeded, update plan item status
            if (newStatus === 'posted') {
              const { data: item } = await supabase
                .from('video_plan_items')
                .select('id, status')
                .eq('video_id', post.video_id)
                .single()

              if (item && item.status !== 'posted') {
                // Check if all posts for this video are posted
                const { data: allPosts } = await supabase
                  .from('scheduled_posts')
                  .select('status')
                  .eq('video_id', post.video_id)

                const allPosted = allPosts?.every((p: any) => p.status === 'posted' || p.status === 'failed')
                if (allPosted) {
                  await supabase
                    .from('video_plan_items')
                    .update({ status: 'posted' })
                    .eq('id', item.id)
                  console.log(`[Distribution] ✅ All posts completed for item ${item.id}, updated status to 'posted'`)
                } else {
                  console.log(`[Distribution] ⏳ Item ${item.id} - not all posts completed yet (${allPosts?.filter((p: any) => p.status !== 'posted' && p.status !== 'failed').length} still pending)`)
                }
              }
            }
          } else {
            console.log(`[Distribution] ⏸️ Post ${post.id} (${post.platform}) status unchanged: '${post.status}'`)
          }
        } else if (uploadStatus.status === 'success' || uploadStatus.status === 'completed' || uploadStatus.status === 'posted') {
          // Overall status indicates success, but no platform-specific result
          // This can happen if the API returns overall status but not platform-specific results
          console.log(`[Distribution] No platform result found, but overall status is '${uploadStatus.status}', marking as posted`)
          const newStatus = 'posted'
          await supabase
            .from('scheduled_posts')
            .update({
              status: newStatus,
              posted_at: new Date().toISOString(),
              error_message: uploadStatus.error || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id)
          console.log(`[Distribution] ✅ Updated post ${post.id} (${post.platform}) to 'posted' based on overall status`)
          
          // Update plan item status
          const { data: item } = await supabase
            .from('video_plan_items')
            .select('id, status')
            .eq('video_id', post.video_id)
            .single()

          if (item && item.status !== 'posted') {
            const { data: allPosts } = await supabase
              .from('scheduled_posts')
              .select('status')
              .eq('video_id', post.video_id)

            const allPosted = allPosts?.every((p: any) => p.status === 'posted' || p.status === 'failed')
            if (allPosted) {
              await supabase
                .from('video_plan_items')
                .update({ status: 'posted' })
                .eq('id', item.id)
              console.log(`[Distribution] ✅ All posts completed for item ${item.id}, updated status to 'posted'`)
            }
          }
        } else if (uploadStatus.status === 'failed') {
          // Overall status indicates failure
          const newStatus = 'failed'
          await supabase
            .from('scheduled_posts')
            .update({
              status: newStatus,
              error_message: uploadStatus.error || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id)
          console.log(`[Distribution] ❌ Updated post ${post.id} (${post.platform}) to 'failed' based on overall status`)
        } else {
          console.log(`[Distribution] ⚠️ Post ${post.id} (${post.platform}) - no platform result and unclear overall status: '${uploadStatus.status}'`)
        }
      } catch (error: any) {
        console.error(`[Distribution] Error checking upload status for post ${post.id}:`, error.message)
        // Don't throw - continue checking other posts
      }
    }
  }

  /**
   * Schedule distribution for completed videos
   */
  static async scheduleDistributionForCompletedVideos(): Promise<void> {
    // First, refresh video statuses for videos that might have completed
    const { data: itemsWithVideos } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms), videos(*)')
      .eq('plan.enabled', true)
      .eq('status', 'generating')
      .not('video_id', 'is', null)
      .limit(10)

    // Refresh video statuses
    if (itemsWithVideos && itemsWithVideos.length > 0) {
      const { getVideoStatus } = await import('../lib/heygen.js')
      for (const item of itemsWithVideos) {
        const video = item.videos as any
        if (video?.heygen_video_id) {
          try {
            const status = await getVideoStatus(video.heygen_video_id)
            await supabase
              .from('videos')
              .update({
                status: status.status === 'completed' ? 'completed' : (status.status === 'failed' ? 'failed' : 'generating'),
                video_url: status.video_url || video.video_url,
                error_message: status.error || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', video.id)

            // If video completed, update plan item status
            if (status.status === 'completed' && status.video_url) {
              await supabase
                .from('video_plan_items')
                .update({ status: 'completed' })
                .eq('id', item.id)
            }
          } catch (error: any) {
            console.error(`[Distribution] Error refreshing video status for ${video.id}:`, error)
          }
        }
      }
    }

    // Check status of items that already have scheduled posts (might be stuck in 'completed' or 'scheduled' status)
    // This handles items that have posts created but status wasn't updated properly
    const { data: itemsWithPosts } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id)')
      .eq('plan.enabled', true)
      .in('status', ['completed', 'scheduled'])
      .not('video_id', 'is', null)
      .limit(50) // Check more items to catch stuck ones

    if (itemsWithPosts && itemsWithPosts.length > 0) {
      console.log(`[Distribution] Checking status of ${itemsWithPosts.length} items with completed/scheduled status`)
      
      for (const item of itemsWithPosts) {
        try {
          // Get all scheduled posts for this video
          const { data: posts } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('video_id', item.video_id)
            .order('created_at', { ascending: false })

          if (!posts || posts.length === 0) {
            // No posts found - item should be available for posting
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
            
            if (item.scheduled_date && item.scheduled_time) {
              const [postHours, postMinutes] = item.scheduled_time.split(':')
              const postHour = parseInt(postHours, 10)
              const postMinute = parseInt(postMinutes || '0', 10)
              
              const postMinutesTotal = postHour * 60 + postMinute
              const currentMinutesTotal = currentHour * 60 + currentMinute
              const timeDiffMinutes = (item.scheduled_date === today) 
                ? (postMinutesTotal - currentMinutesTotal)
                : (item.scheduled_date < today ? -999999 : 999999)
              
              // If scheduled time has passed, this item should be processed for posting
              // Reset scheduled_post_id so it can be picked up
              if (timeDiffMinutes <= 1 && item.scheduled_date <= today) {
                console.log(`[Distribution] Item ${item.id} has no posts but scheduled time passed, will be processed for posting`)
                // Don't reset here - let it be processed in the next section
              }
            }
            continue
          }

          console.log(`[Distribution] Item ${item.id} has ${posts.length} scheduled post(s):`, 
            posts.map(p => `${p.platform}:${p.status}`).join(', '))

          // Check if all posts are posted
          const allPosted = posts.every(p => p.status === 'posted')
          const anyFailed = posts.some(p => p.status === 'failed')
          const anyPending = posts.some(p => p.status === 'pending' || p.status === 'scheduled')
          const allFailed = posts.every(p => p.status === 'failed')

          if (allPosted) {
            // All posts are posted, update item status
            if (item.status !== 'posted') {
              await supabase
                .from('video_plan_items')
                .update({ status: 'posted' })
                .eq('id', item.id)
              console.log(`[Distribution] ✅ Updated item ${item.id} status from '${item.status}' to 'posted' - all ${posts.length} posts are posted`)
            }
          } else if (allFailed) {
            // All posts failed, update status
            if (item.status !== 'failed') {
              await supabase
                .from('video_plan_items')
                .update({ status: 'failed', error_message: 'All posts failed' })
                .eq('id', item.id)
              console.log(`[Distribution] ❌ Updated item ${item.id} status to 'failed' - all ${posts.length} posts failed`)
            }
          } else if (anyPending) {
            // Some posts are still pending - check their status via Upload-Post API
            const pendingPostsToCheck = posts.filter(p => p.status === 'pending' || p.status === 'scheduled')
            console.log(`[Distribution] ⏳ Item ${item.id} has ${pendingPostsToCheck.length} pending post(s), checking status...`)
            
            // Check status for posts with upload_post_id
            for (const post of pendingPostsToCheck) {
              if (post.upload_post_id) {
                try {
                  const { getUploadStatus } = await import('../lib/uploadpost.js')
                  const uploadStatus = await getUploadStatus(post.upload_post_id)
                  
                  console.log(`[Distribution] Upload status for post ${post.id} (${post.platform}):`, {
                    status: uploadStatus.status,
                    resultsCount: uploadStatus.results?.length || 0,
                  })

                  // Find the platform-specific result
                  const platformResult = uploadStatus.results?.find((r: any) => r.platform === post.platform)

                  if (platformResult) {
                    const newStatus = platformResult.status === 'success' ? 'posted' :
                                     platformResult.status === 'failed' ? 'failed' :
                                     'pending'

                    if (newStatus !== post.status) {
                      await supabase
                        .from('scheduled_posts')
                        .update({
                          status: newStatus,
                          posted_at: newStatus === 'posted' ? new Date().toISOString() : post.posted_at,
                          error_message: platformResult.error || null,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', post.id)

                      console.log(`[Distribution] Updated post ${post.id} (${post.platform}) from ${post.status} to ${newStatus}`)
                      
                      // Re-check all posts after update
                      const { data: updatedPosts } = await supabase
                        .from('scheduled_posts')
                        .select('status')
                        .eq('video_id', item.video_id)
                      
                      if (updatedPosts) {
                        const allNowPosted = updatedPosts.every((p: any) => p.status === 'posted')
                        const allNowFailed = updatedPosts.every((p: any) => p.status === 'failed')
                        
                        if (allNowPosted && item.status !== 'posted') {
                          await supabase
                            .from('video_plan_items')
                            .update({ status: 'posted' })
                            .eq('id', item.id)
                          console.log(`[Distribution] ✅ Updated item ${item.id} status to 'posted' - all posts completed`)
                        } else if (allNowFailed && item.status !== 'failed') {
                          await supabase
                            .from('video_plan_items')
                            .update({ status: 'failed', error_message: 'All posts failed' })
                            .eq('id', item.id)
                          console.log(`[Distribution] ❌ Updated item ${item.id} status to 'failed' - all posts failed`)
                        }
                      }
                    }
                  }
                } catch (statusError: any) {
                  console.error(`[Distribution] Error checking upload status for post ${post.id}:`, statusError.message)
                }
              }
            }
            
            // Update item status to 'scheduled' if it has pending posts and scheduled time is in future
            if (item.status === 'completed' && item.scheduled_date && item.scheduled_time) {
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
              
              // If scheduled time is in the future and we have scheduled posts, update status to 'scheduled'
              if (timeDiffMinutes > 1 && item.scheduled_date >= today) {
                await supabase
                  .from('video_plan_items')
                  .update({ status: 'scheduled' })
                  .eq('id', item.id)
                console.log(`[Distribution] Updated item ${item.id} status to 'scheduled' - posts scheduled for future`)
              }
            }
          }
        } catch (error: any) {
          console.error(`[Distribution] Error checking status for item ${item.id}:`, error)
        }
      }
    }

    // Now get items with completed videos that don't have scheduled posts yet
    // Also include items with failed posts that should be retried
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms), videos(*)')
      .eq('plan.enabled', true)
      .in('status', ['completed', 'failed']) // Include failed items for retry
      .not('video_id', 'is', null)
      .limit(10)

    // Filter to only items without scheduled_post_id OR items with failed posts
    const itemsToProcess = items?.filter(item => {
      // Include if no scheduled_post_id
      if (!item.scheduled_post_id) return true
      
      // Include if status is failed (allow retry)
      if (item.status === 'failed') return true
      
      // Check if all scheduled posts failed - allow retry
      // This will be checked more thoroughly below, but quick filter here
      return false
    }) || []

    if (itemsToProcess.length === 0) {
      console.log('[Distribution] No completed items found for posting')
      return
    }

    const allItemsCount = items?.length || 0
    console.log(`[Distribution] Found ${itemsToProcess.length} items to process for posting (out of ${allItemsCount} total)`)

    // Check if items have existing failed posts that should prevent retry
    for (const item of itemsToProcess) {
      if (item.scheduled_post_id) {
        // Check if there are any scheduled posts for this item
        const { data: existingPosts } = await supabase
          .from('scheduled_posts')
          .select('status')
          .eq('video_id', item.video_id)
        
        // If all posts failed and it's been less than 1 hour, skip retry to avoid spam
        if (existingPosts && existingPosts.length > 0) {
          const allFailed = existingPosts.every(p => p.status === 'failed')
          const anyPending = existingPosts.some(p => p.status === 'pending' || p.status === 'scheduled')
          
          if (allFailed) {
            // Check when posts were created - if recent (< 1 hour), don't retry yet
            const { data: postDetails } = await supabase
              .from('scheduled_posts')
              .select('created_at')
              .eq('video_id', item.video_id)
              .order('created_at', { ascending: false })
              .limit(1)
            
            if (postDetails && postDetails.length > 0) {
              const postAge = Date.now() - new Date(postDetails[0].created_at).getTime()
              const oneHour = 60 * 60 * 1000
              if (postAge < oneHour) {
                console.log(`[Distribution] Skipping item ${item.id} - all posts failed recently, waiting before retry`)
                itemsToProcess.splice(itemsToProcess.indexOf(item), 1)
                continue
              }
            }
          } else if (anyPending) {
            // Has pending posts, don't create new ones
            console.log(`[Distribution] Skipping item ${item.id} - has pending posts`)
            itemsToProcess.splice(itemsToProcess.indexOf(item), 1)
            continue
          }
        }
      }
    }

    if (itemsToProcess.length === 0) {
      console.log('[Distribution] No items to process after filtering')
      return
    }

    for (const item of itemsToProcess) {
      try {
        const plan = item.plan as any
        const video = item.videos as any

        if (!video) continue

        // Fetch video to check status and URL
        const { data: videoData } = await supabase
          .from('videos')
          .select('video_url, status, topic, heygen_video_id')
          .eq('id', item.video_id)
          .single()

        if (!videoData) {
          console.log(`[Distribution] Skipping item ${item.id} - video ${item.video_id} not found`)
          continue
        }

        // If video is still generating, check HeyGen status
        if (videoData.status === 'generating' || videoData.status === 'pending') {
          if (videoData.heygen_video_id) {
            try {
              const { getVideoStatus } = await import('../lib/heygen.js')
              const heygenStatus = await getVideoStatus(videoData.heygen_video_id)
              
              if (heygenStatus.status === 'completed' && heygenStatus.video_url) {
                // Update video status
                await supabase
                  .from('videos')
                  .update({
                    status: 'completed',
                    video_url: heygenStatus.video_url,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', item.video_id)
                
                // Update videoData for use below
                videoData.status = 'completed'
                videoData.video_url = heygenStatus.video_url
                
                console.log(`[Distribution] Video ${item.video_id} completed, updated status`)
              } else if (heygenStatus.status === 'failed') {
                console.log(`[Distribution] Video ${item.video_id} failed, skipping posting`)
                await supabase
                  .from('video_plan_items')
                  .update({
                    status: 'failed',
                    error_message: heygenStatus.error || 'Video generation failed',
                  })
                  .eq('id', item.id)
                continue
              } else {
                console.log(`[Distribution] Video ${item.video_id} still generating (status: ${heygenStatus.status}), skipping`)
                continue
              }
            } catch (statusError: any) {
              console.error(`[Distribution] Error checking video status for ${item.video_id}:`, statusError.message)
              continue
            }
          } else {
            console.log(`[Distribution] Video ${item.video_id} still generating, skipping`)
            continue
          }
        }

        if (videoData.status !== 'completed' || !videoData.video_url) {
          console.log(`[Distribution] Skipping item ${item.id} - video status: ${videoData.status}, has URL: ${!!videoData.video_url}`)
          continue
        }

        const platforms = item.platforms || plan.default_platforms || []
        if (platforms.length === 0) {
          console.log(`[Distribution] Skipping item ${item.id} - no platforms configured`)
          continue
        }

        console.log(`[Distribution] Processing item ${item.id} for platforms: ${platforms.join(', ')}`)

        // Get user's connected social accounts
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('platform_account_id, platform')
          .eq('user_id', plan.user_id)
          .in('platform', platforms)
          .eq('status', 'connected')

        if (!accounts || accounts.length === 0) {
          console.log(`[Distribution] Skipping item ${item.id} - no connected social accounts for platforms: ${platforms.join(', ')}`)
          continue
        }

        console.log(`[Distribution] Found ${accounts.length} connected account(s) for item ${item.id}`)

        const uploadPostUserId = accounts[0].platform_account_id

        // Build scheduled time - use scheduled_date and scheduled_time
        // Post at the exact scheduled_time (post time, e.g., 17:00)
        let scheduledTime: string | undefined
        const now = new Date()
        const planTimezone = (plan as any).timezone || 'UTC'
        
        // Get current time in plan's timezone
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
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: planTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        
        const currentHour = parseInt(hourFormatter.format(now), 10)
        const currentMinute = parseInt(minuteFormatter.format(now), 10)
        const today = dateFormatter.format(now)
        
        if (item.scheduled_date && item.scheduled_time) {
          // scheduled_time is the post time (e.g., 17:00)
          const [postHours, postMinutes] = item.scheduled_time.split(':')
          const postHour = parseInt(postHours, 10)
          const postMinute = parseInt(postMinutes || '0', 10)
          
          const postMinutesTotal = postHour * 60 + postMinute
          const currentMinutesTotal = currentHour * 60 + currentMinute
          
          // Check if scheduled date is today or in the past
          const scheduledDate = new Date(item.scheduled_date + 'T00:00:00')
          const todayDate = new Date(today + 'T00:00:00')
          const isScheduledDateTodayOrPast = scheduledDate <= todayDate
          
          // Calculate time difference in minutes
          const timeDiffMinutes = (item.scheduled_date === today) 
            ? (postMinutesTotal - currentMinutesTotal)
            : (item.scheduled_date < today ? -999999 : 999999) // Past date = negative, future date = positive
          
          // Check if it's time to post (within 1 minute window for cron timing)
          if (isScheduledDateTodayOrPast && timeDiffMinutes <= 1) {
            // It's time to post now (at exact scheduled_time or slightly past)
            scheduledTime = undefined // Post immediately
            console.log(`[Distribution] Posting item ${item.id} now - scheduled time (${item.scheduled_time}) reached or passed`)
          } else if (timeDiffMinutes > 1 && item.scheduled_date >= today) {
            // Future scheduled time - build ISO string for scheduling
            // Ensure scheduled_time has proper format (HH:MM or HH:MM:SS)
            let timeStr = item.scheduled_time
            if (!timeStr.includes(':')) {
              console.error(`[Distribution] Invalid scheduled_time format for item ${item.id}: ${timeStr}`)
              continue
            }
            
            // Normalize time format to HH:MM:SS
            const timeParts = timeStr.split(':')
            if (timeParts.length === 2) {
              // Add seconds if missing
              timeStr = `${timeStr}:00`
            } else if (timeParts.length > 3) {
              // Too many parts, take first 3
              timeStr = timeParts.slice(0, 3).join(':')
            }
            
            // Create scheduled time in UTC ISO format
            // scheduled_date is in YYYY-MM-DD format, scheduled_time is in HH:MM:SS format
            // Both represent a time in the plan's timezone, which we need to convert to UTC
            try {
              // Parse date and time components
              const [year, month, day] = item.scheduled_date.split('-').map(Number)
              const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number)
              
              // Convert from plan timezone to UTC
              // Method: Create a date string representing the time in the plan timezone,
              // then use Intl to find the UTC equivalent
              
              // Create a formatter for the plan timezone
              const planFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: planTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
              
              // Strategy: We need to find a UTC time that, when formatted in plan timezone,
              // equals our target time. We'll use an iterative approach with proper offset calculation.
              
              // Start with UTC date at the target time
              let candidateUtcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
              
              console.log(`[Distribution] Initial UTC date: ${candidateUtcDate.toISOString()} (created from ${year}-${month}-${day} ${hours}:${minutes}:${seconds})`)
              
              // Check what this UTC time represents in the plan timezone
              let parts = planFormatter.formatToParts(candidateUtcDate)
              let planYear = parseInt(parts.find(p => p.type === 'year')?.value || '0')
              let planMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0')
              let planDay = parseInt(parts.find(p => p.type === 'day')?.value || '0')
              let planHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
              let planMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
              let planSecond = parseInt(parts.find(p => p.type === 'second')?.value || '0')
              
              console.log(`[Distribution] UTC ${candidateUtcDate.toISOString()} represents ${planYear}-${planMonth}-${planDay} ${planHour}:${planMinute}:${planSecond} in ${planTimezone}`)
              
              // Calculate how many minutes off we are
              // If plan timezone shows 19:00 but we want 17:00, we need to go back 2 hours in UTC
              const targetTotalMinutes = hours * 60 + minutes
              const planTotalMinutes = planHour * 60 + planMinute
              const diffMinutes = targetTotalMinutes - planTotalMinutes
              
              console.log(`[Distribution] Target: ${hours}:${minutes} (${targetTotalMinutes} min), Plan shows: ${planHour}:${planMinute} (${planTotalMinutes} min), Difference: ${diffMinutes} minutes`)
              
              // Adjust UTC date by the difference
              // If plan timezone shows later time (e.g., 19:00 when we want 17:00),
              // we need to subtract from UTC to go back in time
              candidateUtcDate = new Date(candidateUtcDate.getTime() - diffMinutes * 60 * 1000)
              
              console.log(`[Distribution] Adjusted UTC date: ${candidateUtcDate.toISOString()}`)
              
              // Verify the conversion
              parts = planFormatter.formatToParts(candidateUtcDate)
              planYear = parseInt(parts.find(p => p.type === 'year')?.value || '0')
              planMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0')
              planDay = parseInt(parts.find(p => p.type === 'day')?.value || '0')
              planHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
              planMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
              planSecond = parseInt(parts.find(p => p.type === 'second')?.value || '0')
              
              console.log(`[Distribution] After adjustment, UTC ${candidateUtcDate.toISOString()} represents ${planYear}-${planMonth}-${planDay} ${planHour}:${planMinute}:${planSecond} in ${planTimezone}`)
              
              // If still not matching, do one more adjustment
              if (planHour !== hours || planMinute !== minutes) {
                console.log(`[Distribution] Still not matching, doing final adjustment...`)
                const finalTargetMinutes = hours * 60 + minutes
                const finalPlanMinutes = planHour * 60 + planMinute
                const finalDiffMinutes = finalTargetMinutes - finalPlanMinutes
                console.log(`[Distribution] Final adjustment: ${finalDiffMinutes} minutes`)
                candidateUtcDate = new Date(candidateUtcDate.getTime() - finalDiffMinutes * 60 * 1000)
                
                // Re-verify
                parts = planFormatter.formatToParts(candidateUtcDate)
                planYear = parseInt(parts.find(p => p.type === 'year')?.value || '0')
                planMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0')
                planDay = parseInt(parts.find(p => p.type === 'day')?.value || '0')
                planHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
                planMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
                planSecond = parseInt(parts.find(p => p.type === 'second')?.value || '0')
                console.log(`[Distribution] After final adjustment, UTC ${candidateUtcDate.toISOString()} represents ${planYear}-${planMonth}-${planDay} ${planHour}:${planMinute}:${planSecond} in ${planTimezone}`)
              }
              
              // Convert to ISO string
              scheduledTime = candidateUtcDate.toISOString()
              
              // Validate
              if (isNaN(candidateUtcDate.getTime())) {
                throw new Error(`Invalid date generated`)
              }
              
              // Log for debugging
              const utcParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'UTC',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }).formatToParts(candidateUtcDate)
              const utcHour = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0')
              const utcMinute = parseInt(utcParts.find(p => p.type === 'minute')?.value || '0')
              
              console.log(`[Distribution] Timezone conversion: ${item.scheduled_date} ${item.scheduled_time} (${planTimezone}) -> ${scheduledTime} (UTC ${utcHour}:${String(utcMinute).padStart(2, '0')}), verified in ${planTimezone}: ${planHour}:${String(planMinute).padStart(2, '0')}:${String(planSecond).padStart(2, '0')}`)
            } catch (e: any) {
              console.error(`[Distribution] Error creating scheduled time for item ${item.id}:`, e.message, e.stack)
              // Fallback: treat as UTC (not ideal but better than failing)
              scheduledTime = `${item.scheduled_date}T${timeStr}.000Z`
              console.log(`[Distribution] Using fallback scheduled time (UTC): ${scheduledTime}`)
            }
            console.log(`[Distribution] Scheduling item ${item.id} for ${scheduledTime} (${timeDiffMinutes} minutes from now)`)
          } else {
            // Not time yet, skip this item (will be processed when time matches)
            console.log(`[Distribution] Skipping item ${item.id} - scheduled time (${item.scheduled_time}) not reached yet (current: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, scheduled: ${postHour}:${postMinute.toString().padStart(2, '0')})`)
            continue
          }
        } else {
          // No scheduled time - post immediately if video is ready
          scheduledTime = undefined
          console.log(`[Distribution] Posting item ${item.id} immediately - no scheduled time set`)
        }

        // Call upload-post.com API
        console.log(`[Distribution] Posting video ${item.video_id} to platforms: ${platforms.join(', ')}`)
        let postResponse
        try {
          postResponse = await postVideo({
          videoUrl: videoData.video_url,
          platforms: platforms as string[],
            caption: item.caption || item.topic || videoData.topic || '',
          scheduledTime,
          userId: uploadPostUserId,
          asyncUpload: true,
        })

          console.log(`[Distribution] Post response for item ${item.id}:`, {
            status: postResponse.status,
            upload_id: postResponse.upload_id,
            resultsCount: postResponse.results?.length || 0,
            hasResults: !!postResponse.results,
          })
        } catch (postError: any) {
          console.error(`[Distribution] Failed to post video for item ${item.id}:`, {
            error: postError.message,
            videoUrl: videoData.video_url,
            platforms,
            userId: uploadPostUserId,
          })
          // Update item with error
          await supabase
            .from('video_plan_items')
            .update({
              status: 'failed',
              error_message: `Failed to post: ${postError.message}`,
            })
            .eq('id', item.id)
          continue // Skip to next item
        }

        // Check if async upload was initiated
        const isAsyncUpload = (postResponse.status === 'pending' || postResponse.status === 'scheduled') && postResponse.upload_id
        const hasImmediateResults = postResponse.results && postResponse.results.length > 0
        const allImmediateSuccess = postResponse.results?.every((r: any) => r.status === 'success')

        console.log(`[Distribution] Upload response analysis:`, {
          isAsyncUpload,
          hasImmediateResults,
          allImmediateSuccess,
          uploadId: postResponse.upload_id,
          resultsCount: postResponse.results?.length || 0,
        })

        // Check if scheduled_posts already exist for this video to prevent duplicates
        const { data: existingPosts } = await supabase
          .from('scheduled_posts')
          .select('id, platform, status')
          .eq('video_id', item.video_id)

        if (existingPosts && existingPosts.length > 0) {
          console.log(`[Distribution] Item ${item.id} already has ${existingPosts.length} scheduled post(s), skipping creation to prevent duplicates`)
          // Update item status to scheduled if it's not already
          if (item.status !== 'scheduled') {
            await supabase
              .from('video_plan_items')
              .update({ status: 'scheduled' })
              .eq('id', item.id)
            console.log(`[Distribution] Updated item ${item.id} status to 'scheduled' (already had scheduled posts)`)
          }
          continue // Skip creating duplicate posts
        }

        // Create scheduled_posts records for each platform
        const postIds: string[] = []
        for (const platform of platforms) {
          const platformResult = postResponse.results?.find((r: any) => r.platform === platform)

          // Determine initial status based on response
          let initialStatus = 'pending'
          if (platformResult?.status === 'success') {
            initialStatus = 'posted'
          } else if (platformResult?.status === 'failed') {
            initialStatus = 'failed'
          } else if (isAsyncUpload) {
            // Async upload started - will check status later via cron job
            initialStatus = 'pending'
          } else if (scheduledTime) {
            // Scheduled for future posting
            initialStatus = 'pending'
          } else {
            // No immediate result - mark as pending and check later
            initialStatus = 'pending'
          }

          const { data: postData, error: postError } = await supabase
            .from('scheduled_posts')
            .insert({
              video_id: item.video_id,
              user_id: plan.user_id,
              platform: platform,
              scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
              status: initialStatus,
              upload_post_id: postResponse.upload_id || platformResult?.post_id || null,
              posted_at: platformResult?.status === 'success' ? new Date().toISOString() : null,
              error_message: platformResult?.error || null,
            })
            .select()
            .single()

          if (postError) {
            console.error(`[Distribution] Failed to create scheduled_post for ${platform}:`, postError)
            // Continue with other platforms even if one fails
            continue
          }

          if (postData) {
            postIds.push(postData.id)
            console.log(`[Distribution] Created scheduled_post ${postData.id} for platform ${platform} with status ${initialStatus}, upload_post_id: ${postData.upload_post_id}`)
          }
        }

        // Update plan item status
        if (postIds.length > 0) {
          // Determine status based on posting result and schedule
          let itemStatus: string
          if (allImmediateSuccess && !scheduledTime) {
            // All platforms posted immediately
            itemStatus = 'posted'
          } else if (scheduledTime) {
            // Scheduled for future posting
            itemStatus = 'scheduled'
          } else if (isAsyncUpload || hasImmediateResults) {
            // Posts are in progress (async) or have results pending
            // Keep as 'completed' - video is ready, posts are being processed
            itemStatus = 'completed'
          } else {
            // Video is ready, posts are pending
            itemStatus = 'completed'
          }

          const updateResult = await supabase
          .from('video_plan_items')
          .update({ 
              status: itemStatus,
            scheduled_post_id: postIds[0] || null,
          })
          .eq('id', item.id)
            .select()

          if (updateResult.error) {
            console.error(`[Distribution] Failed to update item ${item.id} status:`, updateResult.error)
          } else {
            console.log(`[Distribution] Updated item ${item.id} status to ${itemStatus} with ${postIds.length} scheduled posts`)
          }
        } else {
          console.error(`[Distribution] No scheduled posts were created for item ${item.id} - this indicates a problem`)
          // Mark as failed if no posts were created
          await supabase
            .from('video_plan_items')
            .update({
              status: 'failed',
              error_message: 'Failed to create scheduled posts - no posts were created',
            })
            .eq('id', item.id)
        }
      } catch (error: any) {
        console.error(`Error scheduling distribution for item ${item.id}:`, error)
        await supabase
          .from('video_plan_items')
          .update({
            error_message: error.message,
          })
          .eq('id', item.id)
      }
    }
  }

  /**
   * Approve a script (called from UI)
   */
  static async approveScript(itemId: string, userId: string): Promise<void> {
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', itemId)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      throw new Error('Plan item not found')
    }

    if (item.script_status !== 'draft') {
      throw new Error('Only draft scripts can be approved')
    }

    await supabase
      .from('video_plan_items')
      .update({
        script_status: 'approved',
        status: 'approved',
      })
      .eq('id', itemId)
  }

  /**
   * Reject a script (called from UI)
   */
  static async rejectScript(itemId: string, userId: string): Promise<void> {
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', itemId)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      throw new Error('Plan item not found')
    }

    if (item.script_status !== 'draft') {
      throw new Error('Only draft scripts can be rejected')
    }

    await supabase
      .from('video_plan_items')
      .update({
        script_status: 'rejected',
        script: null,
        status: 'ready',
      })
      .eq('id', itemId)
  }

  /**
   * Generate topic for a specific date
   */
  static async generateTopicsForDate(planId: string, date: string, userId: string): Promise<void> {
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('plan_id', planId)
      .eq('scheduled_date', date)
      .eq('status', 'pending')

    if (!items || items.length === 0) return

    for (const item of items) {
      await PlanService.generateTopicForItem(item.id, userId).catch(console.error)
    }
  }

  /**
   * Generate script for a specific item
   */
  static async generateScriptForItem(itemId: string, userId: string): Promise<void> {
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id, auto_approve)')
      .eq('id', itemId)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      throw new Error('Plan item not found')
    }

    if (item.status !== 'ready') {
      throw new Error('Item must be ready to generate script')
    }

    const research = item.research_data
    
    // Prioritize item.topic over research.Idea - user's topic input should always be used
    const topicToUse = item.topic || research?.Idea || ''
    if (!topicToUse) {
      throw new Error('No topic available for script generation')
    }

    let enrichedResearch = research as any

    // If we lack rich research details, fetch them via Perplexity to improve script quality
    if (!enrichedResearch || !enrichedResearch.Description || !enrichedResearch.UsefulTips) {
      try {
        const researchCategory = item.category || enrichedResearch?.Category || 'Lifestyle'
        enrichedResearch = await ResearchService.researchTopic(topicToUse, researchCategory, userId)

        await supabase
          .from('video_plan_items')
          .update({
            description: enrichedResearch.description,
            why_important: enrichedResearch.whyItMatters,
            useful_tips: enrichedResearch.usefulTips,
            category: enrichedResearch.category || item.category,
            research_data: enrichedResearch,
          })
          .eq('id', itemId)
      } catch (researchError: any) {
        console.error('[Script Generation] Research fallback failed, continuing with existing data:', researchError.message)
      }
    }

    // Pull a few recent scripts to discourage repetition
    const { data: recentItems } = await supabase
      .from('video_plan_items')
      .select('script')
      .eq('plan_id', item.plan_id)
      .not('script', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    const recentScripts =
      recentItems
        ?.map((s: any) => s.script as string | null)
        .filter((s: string | null): s is string => !!s)
        .map((s: string) => s.slice(0, 200)) || []

    const antiRepeatHint =
      recentScripts.length > 0
        ? `Avoid repeating or slightly rephrasing these recent scripts or angles:\n- ${recentScripts.join('\n- ')}`
        : ''

    const script = await ScriptService.generateScriptCustom(
      {
        idea: topicToUse, // Always use the item's topic first
        description: [item.description || enrichedResearch?.Description || '', antiRepeatHint].filter(Boolean).join('\n'),
        whyItMatters: item.why_important || enrichedResearch?.WhyItMatters || '',
        usefulTips: item.useful_tips || enrichedResearch?.UsefulTips || '',
        category: item.category || enrichedResearch?.Category || 'Lifestyle',
      },
      userId
    )
    
    console.log(`[Script Generation] Generated script for topic: "${topicToUse}" (item topic: "${item.topic || 'N/A'}")`)

    const plan = item.plan as any
    const newStatus = plan.auto_approve ? 'approved' : 'draft'
    const scriptStatus = plan.auto_approve ? 'approved' : 'draft'

    await supabase
      .from('video_plan_items')
      .update({
        script,
        script_status: scriptStatus,
        status: newStatus,
      })
      .eq('id', itemId)
  }

  /**
   * Generate video for a specific item
   */
  static async generateVideoForItem(itemId: string, userId: string): Promise<void> {
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id)')
      .eq('id', itemId)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      throw new Error('Plan item not found')
    }

    // Check if video already exists
    if (item.video_id) {
      console.log(`[Video Generation] Item ${itemId} already has video_id ${item.video_id}, skipping duplicate creation`)
      return // Video already exists, don't create another one
    }

    if (item.status !== 'approved' || item.script_status !== 'approved') {
      throw new Error('Item must be approved to generate video')
    }

    if (!item.script) {
      throw new Error('Item must have a script')
    }

    // ATOMIC UPDATE: Only update if video_id is still null
    const statusUpdate = await supabase
      .from('video_plan_items')
      .update({ status: 'generating' })
      .eq('id', itemId)
      .eq('status', 'approved')
      .is('video_id', null) // CRITICAL: Only update if video_id is still null
      .select()

    // Check if update actually succeeded (item might have been claimed by another process)
    if (!statusUpdate.data || statusUpdate.data.length === 0 || statusUpdate.data[0].video_id) {
      console.log(`[Video Generation] Item ${itemId} was already claimed by another process (video_id already set), skipping`)
      return // Another process already claimed this item
    }

    const plan = item.plan as any
    const avatarId = (item as any).avatar_id
    const talkingPhotoId = (item as any).talking_photo_id
    
    const video = await VideoService.requestManualVideo(plan.user_id, {
      topic: item.topic!,
      script: item.script,
      style: 'professional',
      duration: 30,
      avatar_id: avatarId, // Can be undefined - will fall back to default avatar
      talking_photo_id: talkingPhotoId, // Look ID if provided
      plan_item_id: item.id,
    })

    // ATOMIC UPDATE: Set video_id and keep status as 'generating' until video is ready
    const finalUpdate = await supabase
      .from('video_plan_items')
      .update({
        video_id: video.id,
        status: 'generating', // Keep as generating until video is ready
      })
      .eq('id', itemId)
      .eq('status', 'generating') // Only update if still in generating state
      .select()

    if (finalUpdate.error) {
      console.error(`[Video Generation] Failed to update video_id for item ${itemId}:`, finalUpdate.error)
    } else if (!finalUpdate.data || finalUpdate.data.length === 0) {
      console.warn(`[Video Generation] ⚠️ Item ${itemId} status changed before video_id could be set (race condition prevented)`)
    } else {
      console.log(`[Video Generation] ✅ Video generation started for item ${itemId}, video_id: ${video.id}. Status: generating (will update to completed when video is ready)`)
    }
  }

  /**
   * Schedule distribution for a specific item
   */
  static async scheduleDistribution(itemId: string, userId: string): Promise<void> {
    const { data: item } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(user_id, default_platforms), videos(*)')
      .eq('id', itemId)
      .single()

    if (!item || (item.plan as any).user_id !== userId) {
      throw new Error('Plan item not found')
    }

    if (item.status !== 'completed') {
      throw new Error('Item must be completed to schedule distribution')
    }

    // Fetch video to verify status and URL
    const { data: videoData } = await supabase
      .from('videos')
      .select('video_url, status, topic')
      .eq('id', item.video_id)
      .single()

    if (!videoData || videoData.status !== 'completed' || !videoData.video_url) {
      throw new Error('Video must be completed with a URL')
    }

    const plan = item.plan as any
    const platforms = item.platforms || plan.default_platforms || []
    if (platforms.length === 0) {
      throw new Error('No platforms specified for distribution')
    }

    // Get user's connected social accounts
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('platform_account_id')
      .eq('user_id', userId)
      .in('platform', platforms)
      .eq('status', 'connected')
      .limit(1)

    if (!accounts || accounts.length === 0) {
      throw new Error('No connected social accounts found for specified platforms')
    }

    const uploadPostUserId = accounts[0].platform_account_id

    // Build scheduled time - convert from plan timezone to UTC
    let scheduledTime: string | undefined
    if (item.scheduled_date && item.scheduled_time) {
      // Normalize time format to ensure proper ISO format
      let timeStr = item.scheduled_time
      if (!timeStr.includes(':')) {
        console.error(`[Distribution] Invalid scheduled_time format: ${timeStr}`)
        scheduledTime = undefined
      } else {
        // Normalize to HH:MM:SS format
        const timeParts = timeStr.split(':')
        if (timeParts.length === 2) {
          timeStr = `${timeStr}:00`
        } else if (timeParts.length > 3) {
          timeStr = timeParts.slice(0, 3).join(':')
        }
        
        // Convert from plan timezone to UTC
        try {
          const plan = item.plan as any
          const planTimezone = plan?.timezone || 'UTC'
          const [year, month, day] = item.scheduled_date.split('-').map(Number)
          const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number)
          
          const planFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: planTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
          
          // Start with UTC date at target time
          let candidateUtcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
          
          // Check what this UTC time represents in plan timezone
          let parts = planFormatter.formatToParts(candidateUtcDate)
          let planHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
          let planMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
          
          // Calculate difference in minutes
          const targetMinutes = hours * 60 + minutes
          const planMinutes = planHour * 60 + planMinute
          const diffMinutes = targetMinutes - planMinutes
          
          // Adjust UTC date
          candidateUtcDate = new Date(candidateUtcDate.getTime() - diffMinutes * 60 * 1000)
          
          // Verify
          parts = planFormatter.formatToParts(candidateUtcDate)
          planHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
          planMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
          
          if (planHour !== hours || planMinute !== minutes) {
            const finalTargetMinutes = hours * 60 + minutes
            const finalPlanMinutes = planHour * 60 + planMinute
            const finalDiffMinutes = finalTargetMinutes - finalPlanMinutes
            candidateUtcDate = new Date(candidateUtcDate.getTime() - finalDiffMinutes * 60 * 1000)
            
            parts = planFormatter.formatToParts(candidateUtcDate)
            planHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
            planMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
          }
          
          scheduledTime = candidateUtcDate.toISOString()
          
          // Log for debugging
          const utcParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(candidateUtcDate)
          const utcHour = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0')
          const utcMinute = parseInt(utcParts.find(p => p.type === 'minute')?.value || '0')
          
          console.log(`[Distribution] Manual schedule: ${item.scheduled_date} ${item.scheduled_time} (${planTimezone}) -> ${scheduledTime} (UTC ${utcHour}:${String(utcMinute).padStart(2, '0')}), verified: ${planHour}:${String(planMinute).padStart(2, '0')}`)
        } catch (e: any) {
          console.error(`[Distribution] Error converting scheduled time:`, e.message, e.stack)
          // Fallback to UTC
          scheduledTime = `${item.scheduled_date}T${timeStr}.000Z`
        }
      }
    }

    // Check if we should skip Upload-Post scheduling (default is true to avoid timezone issues)
    const skipScheduling = process.env.UPLOADPOST_SKIP_SCHEDULING !== 'false'
    
    if (skipScheduling && scheduledTime) {
      // Don't send to Upload-Post now - create pending scheduled_posts records
      // A cron job will send them at the scheduled time
      console.log(`[Distribution] Skipping Upload-Post scheduling - will send at scheduled time: ${scheduledTime}`)
      
      for (const platform of platforms) {
        await supabase
          .from('scheduled_posts')
          .insert({
            video_id: item.video_id,
            user_id: userId,
            platform: platform,
            scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
            status: 'pending',
            upload_post_id: null,
            posted_at: null,
            error_message: null,
          })
      }
    } else {
      // Send to Upload-Post immediately (with or without scheduled_date)
      const postResponse = await postVideo({
        videoUrl: videoData.video_url,
        platforms: platforms as string[],
        caption: item.caption || item.topic || '',
        scheduledTime: skipScheduling ? undefined : scheduledTime,
        userId: uploadPostUserId,
        asyncUpload: true,
      })

      // Create scheduled_posts records
      for (const platform of platforms) {
        const platformResult = postResponse.results?.find((r: any) => r.platform === platform)

        await supabase
          .from('scheduled_posts')
          .insert({
            video_id: item.video_id,
            user_id: userId,
            platform: platform,
            scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
            status: platformResult?.status === 'success' ? 'posted' : 'pending',
            upload_post_id: postResponse.upload_id || platformResult?.post_id,
            posted_at: platformResult?.status === 'success' ? new Date().toISOString() : null,
            error_message: platformResult?.error || null,
          })
      }
    }

    // Update plan item status
    await supabase
      .from('video_plan_items')
      .update({ status: 'scheduled' })
      .eq('id', itemId)
  }

  /**
   * Send scheduled posts to Upload-Post at the right time
   * This is used when UPLOADPOST_SKIP_SCHEDULING=true to avoid timezone issues
   * Includes rate limiting to avoid API rate limit errors
   */
  static async sendScheduledPosts(): Promise<void> {
    const skipScheduling = process.env.UPLOADPOST_SKIP_SCHEDULING !== 'false'
    if (!skipScheduling) {
      return // Only run if skip scheduling is enabled
    }

    const now = new Date()
    const nowISO = now.toISOString()
    
    // Add a small buffer (30 seconds) to account for cron timing and ensure posts are sent
    // even if they're slightly past due (within the same minute)
    const bufferMs = 30 * 1000 // 30 seconds
    const nowWithBuffer = new Date(now.getTime() + bufferMs)
    const nowWithBufferISO = nowWithBuffer.toISOString()

    // Rate limiting: Process fewer posts per run to avoid hitting API limits
    // Process max 3 posts per minute to stay under rate limits
    const maxPostsPerRun = parseInt(process.env.UPLOADPOST_MAX_POSTS_PER_RUN || '3', 10)

    // Find scheduled posts that are due (scheduled_time <= now + buffer) and still pending
    // Order by scheduled_time to process oldest first
    // Use buffer to ensure posts scheduled for the current minute are caught
    const { data: duePosts, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .not('scheduled_time', 'is', null)
      .lte('scheduled_time', nowWithBufferISO)
      .order('scheduled_time', { ascending: true })
      .limit(maxPostsPerRun)

    if (error) {
      console.error('[Scheduled Posts] Error fetching due posts:', error)
      return
    }

    if (!duePosts || duePosts.length === 0) {
      return
    }

    console.log(`[Scheduled Posts] Found ${duePosts.length} posts due to be sent (processing max ${maxPostsPerRun} per run)`)

    // Group by video_id to send all platforms together
    const postsByVideo = new Map<string, typeof duePosts>()
    for (const post of duePosts) {
      const key = `${post.video_id}_${post.user_id}`
      if (!postsByVideo.has(key)) {
        postsByVideo.set(key, [])
      }
      postsByVideo.get(key)!.push(post)
    }

    // Add delay between batches to avoid rate limits
    const delayBetweenBatches = parseInt(process.env.UPLOADPOST_DELAY_MS || '2000', 10) // 2 seconds default

    let isFirstBatch = true
    for (const [key, videoPosts] of postsByVideo) {
      // Add delay before processing each batch (except first)
      if (!isFirstBatch) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
      isFirstBatch = false
      try {
        const firstPost = videoPosts[0]
        
        // Get video URL
        const { data: video } = await supabase
          .from('videos')
          .select('video_url')
          .eq('id', firstPost.video_id)
          .single()

        if (!video || !video.video_url) {
          console.error(`[Scheduled Posts] No video URL for post ${firstPost.id}`)
          await supabase
            .from('scheduled_posts')
            .update({ 
              status: 'failed',
              error_message: 'Video URL not found'
            })
            .in('id', videoPosts.map(p => p.id))
          continue
        }

        const platforms = videoPosts.map(p => p.platform)
        
        // Get upload_post_user_id from social_accounts
        const { data: account } = await supabase
          .from('social_accounts')
          .select('platform_account_id')
          .eq('user_id', firstPost.user_id)
          .eq('platform', platforms[0])
          .eq('status', 'connected')
          .single()

        if (!account || !account.platform_account_id) {
          console.error(`[Scheduled Posts] No upload_post_user_id for post ${firstPost.id}`)
          await supabase
            .from('scheduled_posts')
            .update({ 
              status: 'failed',
              error_message: 'Upload-Post user ID not found'
            })
            .in('id', videoPosts.map(p => p.id))
          continue
        }

        // Get caption from video or plan item
        let caption = ''
        const { data: planItem } = await supabase
          .from('video_plan_items')
          .select('caption, topic')
          .eq('video_id', firstPost.video_id)
          .single()
        if (planItem) {
          caption = planItem.caption || planItem.topic || ''
        } else {
          const { data: videoData } = await supabase
            .from('videos')
            .select('topic')
            .eq('id', firstPost.video_id)
            .single()
          if (videoData) {
            caption = videoData.topic || ''
          }
        }

        console.log(`[Scheduled Posts] Sending ${platforms.length} posts for video ${firstPost.video_id} to Upload-Post`)

        // Send to Upload-Post without scheduled_date (posts immediately)
        const { postVideo } = await import('../lib/uploadpost.js')
        let postResponse
        try {
          postResponse = await postVideo({
            videoUrl: video.video_url,
            platforms,
            caption,
            scheduledTime: undefined, // Don't schedule - post immediately
            userId: account.platform_account_id,
            asyncUpload: true,
          })
        } catch (error: any) {
          // Handle rate limit errors specifically
          if (error.message && error.message.includes('rate limit')) {
            console.warn(`[Scheduled Posts] Rate limit hit, will retry on next run. Error: ${error.message}`)
            // Don't mark as failed - leave as pending so it retries
            // Add a small delay before continuing to other posts
            await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
            continue
          }
          throw error // Re-throw other errors
        }

        // Update all related scheduled_posts
        for (const videoPost of videoPosts) {
          const platformResult = postResponse.results?.find((r: any) => r.platform === videoPost.platform)

          await supabase
            .from('scheduled_posts')
            .update({
              status: platformResult?.status === 'success' ? 'posted' : 'pending',
              upload_post_id: postResponse.upload_id || platformResult?.post_id,
              posted_at: platformResult?.status === 'success' ? new Date().toISOString() : null,
              error_message: platformResult?.error || null,
            })
            .eq('id', videoPost.id)
        }

        console.log(`[Scheduled Posts] Successfully sent posts for video ${firstPost.video_id}`)
      } catch (error: any) {
        console.error(`[Scheduled Posts] Error sending posts:`, error)
        await supabase
          .from('scheduled_posts')
          .update({ 
            status: 'failed',
            error_message: error.message || 'Failed to send to Upload-Post'
          })
          .in('id', videoPosts.map(p => p.id))
      }
    }
  }
}

