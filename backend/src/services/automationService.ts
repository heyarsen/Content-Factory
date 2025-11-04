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

    for (const plan of plans) {
      try {
        // For daily trigger, check if it's time to process
        if (plan.auto_schedule_trigger === 'daily' && plan.trigger_time) {
          // Convert trigger time to plan's timezone or UTC
          const planTimezone = plan.timezone || 'UTC'
          
          // Get current time in plan's timezone
          const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: planTimezone }))
          const currentHour = nowInTimezone.getHours()
          const currentMinute = nowInTimezone.getMinutes()
          
          // Parse trigger time
          const [triggerHour, triggerMinute] = plan.trigger_time.split(':').map(Number)

          // Only process if within 15 minutes of trigger time (in plan's timezone)
          const triggerMinutes = triggerHour * 60 + triggerMinute
          const currentMinutes = currentHour * 60 + currentMinute
          const timeDiff = Math.abs(currentMinutes - triggerMinutes)
          
          // Handle wrap-around (e.g., 23:50 to 00:05)
          const minutesDiff = Math.min(timeDiff, 1440 - timeDiff)
          
          if (minutesDiff > 15) {
            continue
          }
        }

        // Get pending items for today and upcoming dates
        const today = now.toISOString().split('T')[0]
        const { data: pendingItems } = await supabase
          .from('video_plan_items')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('status', 'pending')
          .gte('scheduled_date', today)
          .limit(plan.videos_per_day)

        if (pendingItems && pendingItems.length > 0) {
          for (const item of pendingItems) {
            if (plan.auto_research) {
              await PlanService.generateTopicForItem(item.id, plan.user_id).catch(console.error)
            }
          }
        }
      } catch (error) {
        console.error(`Error processing plan ${plan.id}:`, error)
      }
    }
  }

  /**
   * Generate script for items with research but no script
   */
  static async generateScriptsForReadyItems(): Promise<void> {
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, auto_approve)')
      .eq('plan.enabled', true)
      .eq('status', 'ready')
      .is('script', null)
      .not('research_data', 'is', null)
      .limit(10)

    if (!items) return

    for (const item of items) {
      try {
        const research = item.research_data
        if (!research) continue

        const script = await ScriptService.generateScriptCustom({
          idea: item.topic || research.Idea || '',
          description: item.description || research.Description || '',
          whyItMatters: item.why_important || research.WhyItMatters || '',
          usefulTips: item.useful_tips || research.UsefulTips || '',
          category: item.category || research.Category || 'Trading',
        })

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
  }

  /**
   * Generate videos for approved scripts
   */
  static async generateVideosForApprovedItems(): Promise<void> {
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id)')
      .eq('plan.enabled', true)
      .eq('status', 'approved')
      .eq('script_status', 'approved')
      .is('video_id', null)
      .not('script', 'is', null)
      .limit(5)

    if (!items) return

    for (const item of items) {
      try {
        const plan = item.plan as any
        await supabase
          .from('video_plan_items')
          .update({ status: 'generating' })
          .eq('id', item.id)

        const video = await VideoService.requestManualVideo(plan.user_id, {
          topic: item.topic!,
          script: item.script!,
          style: 'professional',
          duration: 30,
        })

        await supabase
          .from('video_plan_items')
          .update({
            video_id: video.id,
            status: 'completed',
          })
          .eq('id', item.id)
      } catch (error: any) {
        console.error(`Error generating video for item ${item.id}:`, error)
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
   * Schedule distribution for completed videos
   */
  static async scheduleDistributionForCompletedVideos(): Promise<void> {
    const { data: items } = await supabase
      .from('video_plan_items')
      .select('*, plan:video_plans!inner(enabled, user_id, default_platforms), videos(*)')
      .eq('plan.enabled', true)
      .eq('status', 'completed')
      .not('video_id', 'is', null)
      .limit(10)

    if (!items) return

    for (const item of items) {
      try {
        const plan = item.plan as any
        const video = item.videos as any

        if (!video) continue

        // Fetch video to check status and URL
        const { data: videoData } = await supabase
          .from('videos')
          .select('video_url, status')
          .eq('id', item.video_id)
          .single()

        if (!videoData || videoData.status !== 'completed' || !videoData.video_url) {
          continue
        }

        const platforms = item.platforms || plan.default_platforms || []
        if (platforms.length === 0) continue

        // Get user's connected social accounts
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('platform_account_id')
          .eq('user_id', plan.user_id)
          .in('platform', platforms)
          .eq('status', 'connected')
          .limit(1)

        if (!accounts || accounts.length === 0) continue

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
              user_id: plan.user_id,
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
          .eq('id', item.id)
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
    if (!research) {
      throw new Error('Item must have research data')
    }

    const script = await ScriptService.generateScriptCustom({
      idea: item.topic || research.Idea || '',
      description: item.description || research.Description || '',
      whyItMatters: item.why_important || research.WhyItMatters || '',
      usefulTips: item.useful_tips || research.UsefulTips || '',
      category: item.category || research.Category || 'Trading',
    })

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
      .select('video_url, status')
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
