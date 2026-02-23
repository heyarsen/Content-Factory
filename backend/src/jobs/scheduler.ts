import cron from 'node-cron'
import { JobService } from '../services/jobService.js'
import { ContentService } from '../services/contentService.js'
import { ReelService } from '../services/reelService.js'
import { AutomationService } from '../services/automationService.js'
import { processJobQueue } from './processors.js'

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler(): void {
  console.log('Initializing job scheduler...')

  // Subscription expiration job: Runs every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running subscription expiration job...')
    try {
      const { SubscriptionService } = await import('../services/subscriptionService.js')
      await SubscriptionService.expireSubscriptions()
    } catch (error: any) {
      console.error('[Subscription Expiration] Error:', error)
    }
  })

  // Auto-approval job: Runs every 5 minutes
  // Checks for reels with status='pending' and scheduled_time <= now
  cron.schedule('*/5 * * * *', async () => {
    try {
      const reels = await ReelService.getReelsReadyForAutoApproval()

      for (const reel of reels) {
        try {
          await ReelService.approveReel(reel.id)
          console.log(`[Auto-approval] Approved reel ${reel.id}`)

          // Schedule video generation
          await JobService.scheduleJob('video_generation', { reel_id: reel.id })
        } catch (error: any) {
          console.error(`[Auto-approval] Error approving reel ${reel.id}:`, error)
        }
      }

      if (reels.length > 0) {
        console.log(`[Auto-approval] Processed ${reels.length} reels`)
      }
    } catch (error: any) {
      console.error('[Auto-approval] Error:', error)
    }
  })

  // Script generation job: Runs every 10 minutes
  // Processes pending content items (done=false) that are ready for script generation
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Running script generation job...')
    try {
      const pendingContent = await ContentService.getPendingContent(undefined, 5)

      for (const contentItem of pendingContent) {
        if (!contentItem.research) {
          continue // Skip if no research
        }

        try {
          // Schedule script generation job
          await JobService.scheduleJob('script_generation', {
            content_item_id: contentItem.id,
          })
          console.log(`[Script Generation] Scheduled script generation for content ${contentItem.id}`)
        } catch (error: any) {
          console.error(`[Script Generation] Error scheduling job for content ${contentItem.id}:`, error)
        }
      }

      if (pendingContent.length > 0) {
        console.log(`[Script Generation] Processed ${pendingContent.length} content items`)
      }
    } catch (error: any) {
      console.error('[Script Generation] Error:', error)
    }
  })

  // Video generation job: Runs every 5 minutes
  // Processes approved reels without video
  cron.schedule('*/5 * * * *', async () => {
    try {
      const approvedReels = await ReelService.getApprovedReelsWithoutVideo(undefined)

      for (const reel of approvedReels) {
        try {
          // Schedule video generation job
          await JobService.scheduleJob('video_generation', {
            reel_id: reel.id,
          })
          console.log(`[Video Generation] Scheduled video generation for reel ${reel.id}`)
        } catch (error: any) {
          console.error(`[Video Generation] Error scheduling job for reel ${reel.id}:`, error)
        }
      }

      if (approvedReels.length > 0) {
        console.log(`[Video Generation] Processed ${approvedReels.length} reels`)
      }
    } catch (error: any) {
      console.error('[Video Generation] Error:', error)
    }
  })

  // Job queue processor: Runs every minute
  // Processes background_jobs table
  cron.schedule('* * * * *', async () => {
    try {
      const processed = await processJobQueue(10)
      if (processed > 0) {
        console.log(`[Job Queue] Processed ${processed} jobs`)
      }
    } catch (error: any) {
      console.error('[Job Queue] Error:', error)
    }
  })

  // Automation: Process scheduled plans - generate topics (Step 1)
  // Runs every minute to catch trigger times exactly
  cron.schedule('* * * * *', async () => {
    try {
      await AutomationService.processScheduledPlans()
    } catch (error: any) {
      console.error('[Automation] Error processing scheduled plans:', error)
    }
  })

  // Automation: Generate scripts for ready items (Step 2)
  // Runs every 2 minutes for faster processing
  cron.schedule('*/2 * * * *', async () => {
    try {
      await AutomationService.generateScriptsForReadyItems()
    } catch (error: any) {
      console.error('[Automation] Error generating scripts:', error)
    }
  })

  // Automation: Generate videos for approved scripts (Step 4)
  // Runs every 2 minutes for faster processing
  cron.schedule('*/2 * * * *', async () => {
    try {
      await AutomationService.generateVideosForApprovedItems()
    } catch (error: any) {
      console.error('[Automation] Error generating videos:', error)
    }
  })

  // Automation: Check video status and schedule distribution for completed videos (Step 5)
  // Runs every minute to check video status more frequently
  cron.schedule('* * * * *', async () => {
    try {
      await AutomationService.checkVideoStatusAndScheduleDistribution()
    } catch (error: any) {
      console.error('[Automation] Error checking video status and scheduling distribution:', error)
    }
  })

  // Send scheduled posts to Upload-Post at the right time (when UPLOADPOST_SKIP_SCHEDULING=true)
  // Runs every minute for accurate timing (can be adjusted via env var)
  // Set UPLOADPOST_SEND_INTERVAL_MINUTES to change interval (default: 1 for accurate posting times)
  const sendInterval = parseInt(process.env.UPLOADPOST_SEND_INTERVAL_MINUTES || '1', 10)
  cron.schedule(`*/${sendInterval} * * * *`, async () => {
    try {
      await AutomationService.sendScheduledPosts()
    } catch (error: any) {
      console.error('[Automation] Error sending scheduled posts:', error)
      // Don't throw - let it retry on next run
    }
  })

  // Video status background refresher: Runs every 30 seconds
  // Refreshes status of ALL videos in generating/pending status across all users
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const { VideoService } = await import('../services/videoService.js')
      const result = await VideoService.refreshAllGeneratingVideos()
      if (result.processed > 0) {
        console.log(`[Cron] Video status refresher: Processed ${result.processed} videos, updated ${result.updated}`)
      }
    } catch (error: any) {
      console.error('[Video Status Refresher] Error:', error)
    }
  })

  console.log('Job scheduler initialized successfully')
}
