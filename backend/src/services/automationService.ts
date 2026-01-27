import { supabase } from '../lib/supabase.js'
import { PlanService } from './planService.js'
import { ResearchService } from './researchService.js'
import { ScriptService } from './scriptService.js'
import { VideoService } from './videoService.js'
import { SubscriptionService } from './subscriptionService.js'
import { postVideo } from '../lib/uploadpost.js'
import { DateTime } from 'luxon'

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
        const nowInPlanTz = DateTime.now().setZone(planTimezone)
        const today = nowInPlanTz.toFormat('yyyy-MM-dd')

        let shouldProcessPlan = plan.auto_schedule_trigger !== 'daily'

        // For daily trigger, check if it's time to process (at or past trigger time, within 5 minutes window)
        if (plan.auto_schedule_trigger === 'daily' && plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = nowInPlanTz.hour * 60 + nowInPlanTz.minute

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

    // Check if user has an active subscription
    const hasActiveSub = await SubscriptionService.hasActiveSubscription(userId)
    if (!hasActiveSub) {
      console.log(`[Automation] Skipping script generation for plan ${planId} - user ${userId} has no active subscription`)
      return
    }

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

        // Use prompt fields first, then fall back to research data
        const descriptionToUse = item.description || research?.Description || ''
        const whyItMattersToUse = item.why_important || research?.WhyItMatters || ''
        const usefulTipsToUse = item.useful_tips || research?.UsefulTips || ''

        console.log(`[Script Generation] Using fields for batch script generation:`, {
          itemId: item.id,
          topic: item.topic || research?.Idea || '',
          hasPromptDescription: !!item.description,
          hasPromptWhyImportant: !!item.why_important,
          hasPromptUsefulTips: !!item.useful_tips,
          descriptionSource: item.description ? 'prompt' : (research?.Description ? 'research' : 'empty'),
          whyImportantSource: item.why_important ? 'prompt' : (research?.WhyItMatters ? 'research' : 'empty'),
          usefulTipsSource: item.useful_tips ? 'prompt' : (research?.UsefulTips ? 'research' : 'empty'),
        })

        // If no research but has topic, use topic directly
        const script = await ScriptService.generateScriptCustom({
          idea: item.topic || research?.Idea || '',
          description: descriptionToUse,
          whyItMatters: whyItMattersToUse,
          usefulTips: usefulTipsToUse,
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

                  // Check and deduct credits before generating video
                  const { CreditsService } = await import('./creditsService.js')
                  try {
                    await CreditsService.checkAndDeduct(plan.user_id, CreditsService.COSTS.VIDEO_GENERATION, 'automated video generation')
                  } catch (creditError: any) {
                    console.error(`[Automation] Insufficient credits for user ${plan.user_id} to generate video for item ${item.id}:`, creditError.message)
                    await supabase
                      .from('video_plan_items')
                      .update({
                        status: 'failed',
                        error_message: `Insufficient credits: ${creditError.message}`,
                      })
                      .eq('id', item.id)
                    continue // Skip this item
                  }

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

    // Check if user has an active subscription
    const hasActiveSub = await SubscriptionService.hasActiveSubscription(userId)
    if (!hasActiveSub) {
      console.log(`[Automation] Skipping video generation for plan ${planId} - user ${userId} has no active subscription`)
      return
    }

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
        const nowInPlanTz = DateTime.now().setZone(planTimezone)
        const today = nowInPlanTz.toFormat('yyyy-MM-dd')

        // Check if user has an active subscription
        const hasActiveSub = await SubscriptionService.hasActiveSubscription(plan.user_id)
        if (!hasActiveSub) {
          console.log(`[Automation] Skipping research generation for plan ${plan.id} - user ${plan.user_id} has no active subscription`)
          continue
        }

        // Check if trigger time has passed
        if (plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = nowInPlanTz.hour * 60 + nowInPlanTz.minute

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
        const nowInPlanTz = DateTime.now().setZone(planTimezone)
        const today = nowInPlanTz.toFormat('yyyy-MM-dd')

        // Check if user has an active subscription
        const hasActiveSub = await SubscriptionService.hasActiveSubscription(plan.user_id)
        if (!hasActiveSub) {
          console.log(`[Automation] Skipping script generation for plan ${plan.id} - user ${plan.user_id} has no active subscription`)
          continue
        }

        // Check if trigger time has passed
        if (plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = nowInPlanTz.hour * 60 + nowInPlanTz.minute

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
        const nowInPlanTz = DateTime.now().setZone(planTimezone)
        const today = nowInPlanTz.toFormat('yyyy-MM-dd')

        // Check if user has an active subscription
        const hasActiveSub = await SubscriptionService.hasActiveSubscription(plan.user_id)
        if (!hasActiveSub) {
          console.log(`[Automation] Skipping video generation for plan ${plan.id} - user ${plan.user_id} has no active subscription`)
          continue
        }

        // Check if trigger time has passed
        if (plan.trigger_time) {
          const [triggerHourStr, triggerMinuteStr] = plan.trigger_time.split(':')
          const triggerHour = parseInt(triggerHourStr, 10)
          const triggerMinute = parseInt(triggerMinuteStr || '0', 10)

          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = nowInPlanTz.hour * 60 + nowInPlanTz.minute

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

            // Check and deduct credits before generating video
            const { CreditsService } = await import('./creditsService.js')
            try {
              await CreditsService.checkAndDeduct(plan.user_id, CreditsService.COSTS.VIDEO_GENERATION, 'automated video generation')
            } catch (creditError: any) {
              console.error(`[Automation] Insufficient credits for user ${plan.user_id} to generate video for item ${item.id}:`, creditError.message)
              await supabase
                .from('video_plan_items')
                .update({
                  status: 'failed',
                  error_message: `Insufficient credits: ${creditError.message}`,
                })
                .eq('id', item.id)
              continue // Skip this item
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
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms, timezone), videos(*)')
      .eq('plan.enabled', true)
      .eq('status', 'generating')
      .not('video_id', 'is', null)
      .limit(10)

    // Refresh video statuses
    if (itemsWithVideos && itemsWithVideos.length > 0) {
      const { getVideoStatus } = await import('../lib/heygen.js')
      for (const item of itemsWithVideos) {
        const video = item.videos as any

        // [FIX] Check if video is already completed (e.g. by Sora service or other background job)
        if (video?.status === 'completed' && video?.video_url) {
          console.log(`[Distribution] Video ${video.id} is already completed, updating plan item ${item.id} status`)
          await supabase
            .from('video_plan_items')
            .update({ status: 'completed' })
            .eq('id', item.id)
          continue
        }

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
      .select('*, plan:video_plans!inner(enabled, user_id, timezone)')
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
            const planTimezone = (item.plan as any).timezone || 'UTC'
            const now = DateTime.now().setZone(planTimezone)
            const today = now.toFormat('yyyy-MM-dd')

            if (item.scheduled_date && item.scheduled_time) {
              const [hour, minute] = item.scheduled_time.split(':').map(Number)
              const scheduledDateTime = DateTime.fromFormat(
                `${item.scheduled_date} ${item.scheduled_time}`,
                item.scheduled_time.split(':').length === 3 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm',
                { zone: planTimezone }
              )

              const timeDiffMinutes = scheduledDateTime.diff(now, 'minutes').minutes

              console.log(`[Distribution] Item ${item.id} - Plan Timezone: ${planTimezone}, Current Time (in plan tz): ${now.toFormat('yyyy-MM-dd HH:mm')}, Scheduled: ${item.scheduled_date} ${item.scheduled_time} (checking status flow), timeDiff: ${Math.round(timeDiffMinutes)}min`)

              // If scheduled time has passed, this item should be processed for posting
              if (timeDiffMinutes <= 1 && item.scheduled_date <= today) {
                console.log(`[Distribution] Item ${item.id} has no posts but scheduled time passed, will be processed for posting`)
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
              const planTimezone = (item.plan as any).timezone || 'UTC'
              const now = DateTime.now().setZone(planTimezone)
              const today = now.toFormat('yyyy-MM-dd')

              const scheduledDateTime = DateTime.fromFormat(
                `${item.scheduled_date} ${item.scheduled_time}`,
                item.scheduled_time.split(':').length === 3 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm',
                { zone: planTimezone }
              )

              const timeDiffMinutes = scheduledDateTime.diff(now, 'minutes').minutes

              console.log(`[Distribution] Item ${item.id} - Plan Timezone: ${planTimezone}, Current Time (in plan tz): ${now.toFormat('yyyy-MM-dd HH:mm')}, Scheduled: ${item.scheduled_date} ${item.scheduled_time} (checking status flow), timeDiff: ${Math.round(timeDiffMinutes)}min`)

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
    // First get completed items
    const { data: completedItems } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms, timezone), videos(*)')
      .eq('plan.enabled', true)
      .in('status', ['completed', 'scheduled'])
      .not('video_id', 'is', null)
      .limit(10)

    // Then get failed items that might be eligible for retry (only if all posts failed more than 1 hour ago)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: failedItems } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms, timezone), videos(*)')
      .eq('plan.enabled', true)
      .eq('status', 'failed')
      .not('video_id', 'is', null)
      .limit(5) // Limit failed retries to avoid spam

    // Combine items
    const items = [...(completedItems || []), ...(failedItems || [])]

    // Filter to only items without scheduled_post_id OR items with failed posts that are old enough
    const itemsToProcess = items?.filter(item => {
      // Include if no scheduled_post_id
      if (!item.scheduled_post_id) return true

      // For failed items, we'll check more thoroughly below
      if (item.status === 'failed') return true

      return false
    }) || []

    if (itemsToProcess.length === 0) {
      console.log('[Distribution] No completed items found for posting')
      return
    }

    const allItemsCount = items?.length || 0
    console.log(`[Distribution] Found ${itemsToProcess.length} items to process for posting (out of ${allItemsCount} total)`)

    // This check is important even for items without scheduled_post_id, as posts might exist
    // We'll build a new array instead of mutating the existing one to avoid index issues
    const filteredItems: typeof itemsToProcess = []

    for (const item of itemsToProcess) {
      try {
        // Check if user has an active subscription
        const hasActiveSub = await SubscriptionService.hasActiveSubscription(item.plan.user_id)
        if (!hasActiveSub) {
          console.log(`[Distribution] Skipping distribution for item ${item.id} - user ${item.plan.user_id} has no active subscription`)
          continue
        }

        // Always check for existing scheduled posts, regardless of scheduled_post_id
        const { data: existingPosts } = await supabase
          .from('scheduled_posts')
          .select('status, created_at, platform')
          .eq('video_id', item.video_id)

        if (existingPosts && existingPosts.length > 0) {
          const allFailed = existingPosts.every(p => p.status === 'failed')
          const anyPending = existingPosts.some(p => p.status === 'pending' || p.status === 'scheduled')
          const anyPosted = existingPosts.some(p => p.status === 'posted')

          // If any posts are pending or posted, skip to prevent duplicates
          if (anyPending || anyPosted) {
            console.log(`[Distribution] Skipping item ${item.id} - has ${existingPosts.length} existing post(s) with status: ${existingPosts.map(p => `${p.platform}:${p.status}`).join(', ')}`)
            continue
          }

          // If all posts failed, check if we should retry
          if (allFailed) {
            // Check when posts were created - if recent (< 1 hour), don't retry yet
            const mostRecentPost = existingPosts.sort((a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]

            if (mostRecentPost) {
              const postAge = Date.now() - new Date(mostRecentPost.created_at).getTime()
              const oneHour = 60 * 60 * 1000
              if (postAge < oneHour) {
                console.log(`[Distribution] Skipping item ${item.id} - all posts failed recently (${Math.round(postAge / 60000)} minutes ago), waiting before retry`)
                continue
              }
            }
          }
        }

        // Item passed all checks, add it to filtered list
        filteredItems.push(item)
      } catch (error: any) {
        console.error(`[Distribution] Error filtering item ${item.id}:`, error.message)
      }
    }

    // Replace itemsToProcess with filtered list
    itemsToProcess.length = 0
    itemsToProcess.push(...filteredItems)

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
        const planTimezone = (plan as any).timezone || 'UTC'
        const now = DateTime.now().setZone(planTimezone)
        const today = now.toFormat('yyyy-MM-dd')

        console.log(`[Distribution] Item ${item.id} - Plan Timezone: ${planTimezone}, Current Time (in plan tz): ${now.toFormat('yyyy-MM-dd HH:mm')}, Scheduled: ${item.scheduled_date} ${item.scheduled_time} (posting flow)`)

        if (item.scheduled_date && item.scheduled_time) {
          const scheduledDateTime = DateTime.fromFormat(
            `${item.scheduled_date} ${item.scheduled_time}`,
            item.scheduled_time.split(':').length === 3 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm',
            { zone: planTimezone }
          )

          const timeDiffMinutes = scheduledDateTime.diff(now, 'minutes').minutes
          const isScheduledDateTodayOrPast = scheduledDateTime.startOf('day') <= now.startOf('day')

          // Check if it's time to post (within 1 minute window for cron timing)
          if (isScheduledDateTodayOrPast && timeDiffMinutes <= 1) {
            // It's time to post now (at exact scheduled_time or slightly past)
            scheduledTime = undefined // Post immediately
            console.log(`[Distribution] Posting item ${item.id} now - scheduled time (${item.scheduled_time}) reached or passed`)
          } else if (timeDiffMinutes > 1 && item.scheduled_date >= today) {
            // Future scheduled time - wait for trigger time locally
            // We don't send to API yet because we use local scheduler for precision/timezone handling

            // Log once every hour or if status is not yet 'scheduled'
            const shouldLog = item.status !== 'scheduled' || now.minute === 0
            if (shouldLog) {
              console.log(`[Distribution] Item ${item.id} scheduled for future (${item.scheduled_date} ${item.scheduled_time}), waiting for trigger time...`)
            }

            // Update status to 'scheduled' if not already
            if (item.status !== 'scheduled') {
              await supabase
                .from('video_plan_items')
                .update({ status: 'scheduled' })
                .eq('id', item.id)
              console.log(`[Distribution] Updated item ${item.id} status to 'scheduled'`)
            }
            continue
          } else {
            // Not time yet, skip this item (will be processed when time matches)
            console.log(`[Distribution] Skipping item ${item.id} - scheduled time (${item.scheduled_time}) not reached yet (current: ${now.toFormat('HH:mm')}, scheduled: ${item.scheduled_time})`)
            continue
          }
        } else {
          // No scheduled time - post immediately if video is ready
          scheduledTime = undefined
          console.log(`[Distribution] Posting item ${item.id} immediately - no scheduled time set`)
        }

        // Check if scheduled_posts already exist for this video to prevent duplicates
        // IMPORTANT: This check must happen BEFORE calling postVideo API to prevent duplicate posts
        // Also check for posts created very recently (within last 30 seconds) to catch race conditions
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
        const { data: existingPosts } = await supabase
          .from('scheduled_posts')
          .select('id, platform, status, created_at')
          .eq('video_id', item.video_id)

        if (existingPosts && existingPosts.length > 0) {
          // Check if any posts are for the platforms we're trying to post to
          const platformsToPost = item.platforms || plan.default_platforms || []
          const hasActivePostsForPlatforms = existingPosts.some(post => {
            const isForTargetPlatform = platformsToPost.includes(post.platform)
            const isActiveStatus = post.status === 'pending' || post.status === 'scheduled' || post.status === 'posted'
            const isRecent = new Date(post.created_at) >= new Date(thirtySecondsAgo)
            return isForTargetPlatform && (isActiveStatus || isRecent)
          })

          if (hasActivePostsForPlatforms) {
            const relevantPosts = existingPosts.filter(post =>
              platformsToPost.includes(post.platform) &&
              (post.status === 'pending' || post.status === 'scheduled' || post.status === 'posted' ||
                new Date(post.created_at) >= new Date(thirtySecondsAgo))
            )
            console.log(`[Distribution] Item ${item.id} already has ${relevantPosts.length} scheduled post(s) for platforms ${platformsToPost.join(', ')} (statuses: ${relevantPosts.map(p => `${p.platform}:${p.status}`).join(', ')}), skipping to prevent duplicates`)
            // Update item status to scheduled if it's not already
            if (item.status !== 'scheduled') {
              await supabase
                .from('video_plan_items')
                .update({ status: 'scheduled' })
                .eq('id', item.id)
              console.log(`[Distribution] Updated item ${item.id} status to 'scheduled' (already had scheduled posts)`)
            }
            continue // Skip creating duplicate posts - don't call postVideo API
          }
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

    const existingResearch = item.research_data

    // Always use the user's topic (can be short or long-form)
    const topicToUse = item.topic || existingResearch?.Idea || ''
    if (!topicToUse) {
      throw new Error('No topic available for script generation')
    }

    // Check if we have all prompt fields filled - if so, we can skip research or use it as fallback only
    const hasAllPromptFields = !!(item.description && item.why_important && item.useful_tips)

    // Always (re)run research so scripts are based on fresh data and long topics
    // But if we have prompt fields, they will take priority
    const researchCategory = item.category || existingResearch?.Category || existingResearch?.category || 'Lifestyle'
    let enrichedResearch: any = null
    try {
      console.log('[Research] Starting research for item', {
        itemId,
        topic: topicToUse,
        category: researchCategory,
        planId: item.plan_id,
        hasPromptFields: hasAllPromptFields,
        promptDescription: item.description ? 'yes' : 'no',
        promptWhyImportant: item.why_important ? 'yes' : 'no',
        promptUsefulTips: item.useful_tips ? 'yes' : 'no',
      })

      enrichedResearch = await ResearchService.researchTopic(topicToUse, researchCategory, userId)

      console.log('[Research] Completed research for item', {
        itemId,
        topic: topicToUse,
        category: enrichedResearch?.category || researchCategory,
        hasDescription: !!enrichedResearch?.description,
        hasTips: !!enrichedResearch?.usefulTips,
        willUsePromptFields: hasAllPromptFields,
      })

      // Only update description, why_important, useful_tips if they're not already set (from prompts)
      // This preserves user-provided values from prompts
      const updateData: any = {
        category: enrichedResearch.category || item.category,
        research_data: enrichedResearch,
      }

      // Only overwrite if field is empty/null (preserve prompt values)
      if (!item.description) {
        updateData.description = enrichedResearch.description
      }
      if (!item.why_important) {
        updateData.why_important = enrichedResearch.whyItMatters
      }
      if (!item.useful_tips) {
        updateData.useful_tips = enrichedResearch.usefulTips
      }

      await supabase
        .from('video_plan_items')
        .update(updateData)
        .eq('id', itemId)
    } catch (researchError: any) {
      console.error('[Research] Failed for item; aborting script generation to avoid low-quality output:', {
        itemId,
        topic: topicToUse,
        error: researchError.message,
      })
      throw new Error('Research failed; unable to generate script')
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

    // Use prompt fields first, then fall back to research data
    const descriptionToUse = item.description || enrichedResearch?.description || enrichedResearch?.Description || ''
    const whyItMattersToUse = item.why_important || enrichedResearch?.whyItMatters || enrichedResearch?.WhyItMatters || ''
    const usefulTipsToUse = item.useful_tips || enrichedResearch?.usefulTips || enrichedResearch?.UsefulTips || ''

    console.log(`[Script Generation] Using fields for script generation:`, {
      itemId,
      topic: topicToUse,
      hasPromptDescription: !!item.description,
      hasPromptWhyImportant: !!item.why_important,
      hasPromptUsefulTips: !!item.useful_tips,
      descriptionSource: item.description ? 'prompt' : (enrichedResearch?.description ? 'research' : 'empty'),
      whyImportantSource: item.why_important ? 'prompt' : (enrichedResearch?.whyItMatters ? 'research' : 'empty'),
      usefulTipsSource: item.useful_tips ? 'prompt' : (enrichedResearch?.usefulTips ? 'research' : 'empty'),
    })

    const script = await ScriptService.generateScriptCustom(
      {
        idea: topicToUse, // Always use the item's topic first
        description: [
          descriptionToUse,
          antiRepeatHint,
        ].filter(Boolean).join('\n'),
        whyItMatters: whyItMattersToUse,
        usefulTips: usefulTipsToUse,
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

    // Check and deduct credits before generating video
    const { CreditsService } = await import('./creditsService.js')
    try {
      await CreditsService.checkAndDeduct(plan.user_id, CreditsService.COSTS.VIDEO_GENERATION, 'automated video generation')
    } catch (creditError: any) {
      console.error(`[Automation] Insufficient credits for user ${plan.user_id} to generate video for item ${itemId}:`, creditError.message)
      await supabase
        .from('video_plan_items')
        .update({
          status: 'failed',
          error_message: `Insufficient credits: ${creditError.message}`,
        })
        .eq('id', itemId)
      return // Stop processing this item
    }

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

          // Use Luxon for robust timezone conversion
          const scheduledDateTime = DateTime.fromFormat(
            `${item.scheduled_date} ${timeStr}`,
            timeStr.split(':').length === 3 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm',
            { zone: planTimezone }
          )

          if (!scheduledDateTime.isValid) {
            throw new Error(`Invalid date/time: ${scheduledDateTime.invalidReason}`)
          }

          scheduledTime = scheduledDateTime.toUTC().toISO() || undefined

          // Verify by converting back to plan timezone for logging
          const backToPlanTime = scheduledDateTime.setZone(planTimezone)

          console.log(`[Distribution] Manual schedule: ${item.scheduled_date} ${item.scheduled_time} (${planTimezone}) -> ${scheduledTime} (UTC), verified back to plan tz: ${backToPlanTime.toFormat('HH:mm')}`)
        } catch (e: any) {
          console.error(`[Distribution] Error converting scheduled time:`, e.message, e.stack)
          // Fallback to simpler format if possible, but Luxon should handle it
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

        // Check if user has an active subscription before sending posts
        const hasActiveSub = await SubscriptionService.hasActiveSubscription(firstPost.user_id)
        if (!hasActiveSub) {
          console.log(`[Scheduled Posts] Skipping posts for user ${firstPost.user_id} - no active subscription`)
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'failed',
              error_message: 'Subscription expired or cancelled'
            })
            .in('id', videoPosts.map(p => p.id))
          continue
        }

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

