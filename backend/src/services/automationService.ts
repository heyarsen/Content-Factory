import { supabase } from '../lib/supabase.js'
import { PlanService } from './planService.js'
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
        })

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
                  // Update status to generating
                  await supabase
                    .from('video_plan_items')
                    .update({ status: 'generating' })
                    .eq('id', item.id)
                  
                  // Get avatar_id from plan item (optional - will fall back to default avatar if not provided)
                  const avatarId = (updatedItem as any).avatar_id
                  
                  console.log(`[Video Generation] Immediately generating video for item ${item.id}`, {
                    topic: updatedItem.topic,
                    hasAvatarId: !!avatarId,
                    avatarId: avatarId || 'will use default avatar'
                  })
                  
                  // VideoService.requestManualVideo will automatically use default avatar if avatar_id is not provided
                  const video = await VideoService.requestManualVideo(plan.user_id, {
                    topic: updatedItem.topic || 'Video Content',
                    script: updatedItem.script || '',
                    style: 'professional',
                    duration: 30,
                    avatar_id: avatarId, // Can be undefined - will fall back to default
                  })
                  
                  await supabase
                    .from('video_plan_items')
                    .update({
                      video_id: video.id,
                      status: 'generating', // Keep as generating until video is ready
                    })
                    .eq('id', item.id)
                  
                  console.log(`[Video Generation] Video generation started for item ${item.id}, video_id: ${video.id}. Status: generating (will update to completed when video is ready)`)
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
        // Update status to show video generation in progress IMMEDIATELY
        // This ensures the UI shows "Creating Video" right away
        const statusUpdate = await supabase
          .from('video_plan_items')
          .update({ 
            status: 'generating',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
          .select()

        if (statusUpdate.error) {
          console.error(`[Video Generation] Failed to update status for item ${item.id}:`, statusUpdate.error)
        } else {
          console.log(`[Video Generation] Updated item ${item.id} status to 'generating' (Creating Video) - Topic: "${item.topic || 'N/A'}"`)
        }

        if (!item.topic || !item.script) {
          throw new Error('Missing topic or script for video generation')
        }

        // Get avatar_id from plan item (optional - will fall back to default avatar if not provided)
        const avatarId = (item as any).avatar_id
        
        console.log(`[Video Generation] Creating video for item ${item.id}`, {
          topic: item.topic,
          scriptLength: item.script?.length || 0,
          hasAvatarId: !!avatarId,
          avatarId: avatarId || 'will use default avatar'
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
        })

        console.log(`[Video Generation] Video created with ID: ${video.id}, topic: "${video.topic}"`)

        // Keep status as 'generating' until video is actually completed
        // The video status will be checked by checkVideoStatusAndScheduleDistribution
        const finalUpdate = await supabase
          .from('video_plan_items')
          .update({
            video_id: video.id,
            status: 'generating', // Keep as generating until video is ready
          })
          .eq('id', item.id)
          .select()

        if (finalUpdate.error) {
          console.error(`[Video Generation] Failed to update video_id for item ${item.id}:`, finalUpdate.error)
        } else {
          console.log(`[Video Generation] Video generation started for item ${item.id}, video_id: ${video.id}. Status: generating (will update to completed when video is ready)`)
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
      .select('id, trigger_time, timezone, auto_approve')
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
        })
            
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
            // Update status to show video generation in progress
            const statusUpdate = await supabase
          .from('video_plan_items')
          .update({ status: 'generating' })
          .eq('id', item.id)
              .select()

            if (statusUpdate.error) {
              console.error(`[Video Generation] Failed to update status for item ${item.id}:`, statusUpdate.error)
            } else {
              console.log(`[Video Generation] Updated today's item ${item.id} status to 'generating' (Creating Video)`)
            }

            if (!item.topic || !item.script) {
              throw new Error('Missing topic or script for video generation')
            }

            console.log(`[Video Generation] Creating video for today's item ${item.id} with topic: ${item.topic}`)
        const video = await VideoService.requestManualVideo(plan.user_id, {
              topic: item.topic,
              script: item.script,
          style: 'professional',
          duration: 30,
        })

            const finalUpdate = await supabase
          .from('video_plan_items')
          .update({
            video_id: video.id,
            status: 'completed',
          })
          .eq('id', item.id)
              .select()

            if (finalUpdate.error) {
              console.error(`[Video Generation] Failed to update video_id for item ${item.id}:`, finalUpdate.error)
            } else {
              console.log(`[Video Generation] Generated video for today's item ${item.id}, video_id: ${video.id}`)
            }
      } catch (error: any) {
        console.error(`Error generating video for item ${item.id}:`, error)
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

        // Find the platform-specific result
        const platformResult = uploadStatus.results?.find((r: any) => r.platform === post.platform)

        if (platformResult) {
          const newStatus = platformResult.status === 'success' ? 'posted' :
                           platformResult.status === 'failed' ? 'failed' :
                           'pending'

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

            console.log(`[Distribution] Updated post ${post.id} (${post.platform}) from ${post.status} to ${newStatus}`)

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
                  console.log(`[Distribution] All posts completed for item ${item.id}, updated status to posted`)
                }
              }
            }
          }
        } else if (uploadStatus.status === 'success' || uploadStatus.status === 'failed') {
          // Overall status is known, but no platform-specific result
          const newStatus = uploadStatus.status === 'success' ? 'posted' : 'failed'
          await supabase
            .from('scheduled_posts')
            .update({
              status: newStatus,
              posted_at: newStatus === 'posted' ? new Date().toISOString() : post.posted_at,
              error_message: uploadStatus.error || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id)
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

    // Now get items with completed videos
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms), videos(*)')
      .eq('plan.enabled', true)
      .eq('status', 'completed')
      .not('video_id', 'is', null)
      .is('scheduled_post_id', null) // Only schedule if not already scheduled
      .limit(10)

    if (!items || items.length === 0) {
      console.log('[Distribution] No completed items found for posting')
      return
    }

    console.log(`[Distribution] Found ${items.length} completed items to post`)

    for (const item of items) {
      try {
        const plan = item.plan as any
        const video = item.videos as any

        if (!video) continue

        // Fetch video to check status and URL
        const { data: videoData } = await supabase
          .from('videos')
          .select('video_url, status, topic')
          .eq('id', item.video_id)
          .single()

        if (!videoData || videoData.status !== 'completed' || !videoData.video_url) {
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
            // Create date string in format: YYYY-MM-DDTHH:MM:SS
            const scheduledDateTimeStr = `${item.scheduled_date}T${item.scheduled_time}:00`
            // Parse as if it's in the plan's timezone, then convert to ISO
            try {
              // Use a more reliable method to create the scheduled time
              const scheduledDateObj = new Date(scheduledDateTimeStr)
              // Check if date is valid
              if (isNaN(scheduledDateObj.getTime())) {
                // Fallback: build ISO string manually
                scheduledTime = `${item.scheduled_date}T${item.scheduled_time}:00.000Z`
              } else {
                scheduledTime = scheduledDateObj.toISOString()
              }
            } catch (e) {
              // Fallback: use simple ISO string format
              scheduledTime = `${item.scheduled_date}T${item.scheduled_time}:00.000Z`
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

    const script = await ScriptService.generateScriptCustom({
      idea: topicToUse, // Always use the item's topic first
      description: item.description || research?.Description || '',
      whyItMatters: item.why_important || research?.WhyItMatters || '',
      usefulTips: item.useful_tips || research?.UsefulTips || '',
      category: item.category || research?.Category || 'Trading',
    })
    
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

    if (item.status !== 'approved' || item.script_status !== 'approved') {
      throw new Error('Item must be approved to generate video')
    }

    if (!item.script) {
      throw new Error('Item must have a script')
    }

    await supabase
      .from('video_plan_items')
      .update({ status: 'generating' })
      .eq('id', itemId)

    const plan = item.plan as any
    const video = await VideoService.requestManualVideo(plan.user_id, {
      topic: item.topic!,
      script: item.script,
      style: 'professional',
      duration: 30,
    })

    await supabase
      .from('video_plan_items')
      .update({
        video_id: video.id,
        status: 'completed',
      })
      .eq('id', itemId)
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

    // Build scheduled time
    let scheduledTime: string | undefined
    if (item.scheduled_date && item.scheduled_time) {
      scheduledTime = `${item.scheduled_date}T${item.scheduled_time}`
    }

    // Call upload-post.com API
    const postResponse = await postVideo({
      videoUrl: videoData.video_url,
      platforms: platforms as string[],
      caption: item.caption || item.topic || '',
      scheduledTime,
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

    // Update plan item status
    await supabase
      .from('video_plan_items')
      .update({ status: 'scheduled' })
      .eq('id', itemId)
  }
}

