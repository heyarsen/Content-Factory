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

  // Auto-approval job: Runs every 5 minutes
  // Checks for reels with status='pending' and scheduled_time <= now
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running auto-approval job...')
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
  // Processes pending content items (done=false) with research
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
    console.log('[Cron] Running video generation job...')
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

  // Research job: Runs every 15 minutes
  // Processes content items without research
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Running research job...')
    try {
      const contentWithoutResearch = await ContentService.getContentWithoutResearch(undefined, 3)

      for (const contentItem of contentWithoutResearch) {
        try {
          // Schedule research job
          await JobService.scheduleJob('research', {
            content_item_id: contentItem.id,
          })
          console.log(`[Research] Scheduled research for content ${contentItem.id}`)
        } catch (error: any) {
          console.error(`[Research] Error scheduling job for content ${contentItem.id}:`, error)
        }
      }

      if (contentWithoutResearch.length > 0) {
        console.log(`[Research] Processed ${contentWithoutResearch.length} content items`)
      }
    } catch (error: any) {
      console.error('[Research] Error:', error)
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
  // Runs every 5 minutes to catch trigger times more quickly
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running automation: process scheduled plans...')
    try {
      await AutomationService.processScheduledPlans()
      console.log('[Automation] Processed scheduled plans')
    } catch (error: any) {
      console.error('[Automation] Error processing scheduled plans:', error)
    }
  })

  // Automation: Generate research for ready items with topics but no research (Step 1.5)
  // Runs every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Running automation: generate research for ready items...')
    try {
      await AutomationService.generateResearchForReadyItems()
      console.log('[Automation] Generated research for ready items')
    } catch (error: any) {
      console.error('[Automation] Error generating research:', error)
    }
  })

  // Automation: Generate scripts for ready items (Step 2)
  // Runs every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Running automation: generate scripts...')
    try {
      await AutomationService.generateScriptsForReadyItems()
      console.log('[Automation] Generated scripts for ready items')
    } catch (error: any) {
      console.error('[Automation] Error generating scripts:', error)
    }
  })

  // Automation: Generate videos for approved scripts (Step 4)
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running automation: generate videos...')
    try {
      await AutomationService.generateVideosForApprovedItems()
      console.log('[Automation] Generated videos for approved items')
    } catch (error: any) {
      console.error('[Automation] Error generating videos:', error)
    }
  })

  // Automation: Schedule distribution for completed videos (Step 5)
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running automation: schedule distribution...')
    try {
      await AutomationService.scheduleDistributionForCompletedVideos()
      console.log('[Automation] Scheduled distribution for completed videos')
    } catch (error: any) {
      console.error('[Automation] Error scheduling distribution:', error)
    }
  })

  console.log('Job scheduler initialized successfully')
}

