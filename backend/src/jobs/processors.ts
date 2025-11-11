import { JobService, type JobType } from '../services/jobService.js'
import { ContentService } from '../services/contentService.js'
import { ReelService } from '../services/reelService.js'
import { VideoService } from '../services/videoService.js'
import { ResearchService } from '../services/researchService.js'
import { ScriptService } from '../services/scriptService.js'
import { BackgroundJob } from '../types/database.js'

/**
 * Process a single background job
 */
export async function processJob(job: BackgroundJob): Promise<void> {
  try {
    await JobService.markJobProcessing(job.id)

    switch (job.job_type as JobType) {
      case 'script_generation':
        await processScriptGeneration(job)
        break

      case 'auto_approval':
        await processAutoApproval(job)
        break

      case 'video_generation':
        await processVideoGeneration(job)
        break

      case 'topic_generation':
        await processTopicGeneration(job)
        break

      case 'research':
        await processResearch(job)
        break

      default:
        throw new Error(`Unknown job type: ${job.job_type}`)
    }

    await JobService.markJobCompleted(job.id)
  } catch (error: any) {
    console.error(`Error processing job ${job.id}:`, error)
    await JobService.markJobFailed(job.id, error.message, true)
  }
}

/**
 * Process script generation job
 */
async function processScriptGeneration(job: BackgroundJob): Promise<void> {
  const { content_item_id } = job.payload

  if (!content_item_id) {
    throw new Error('content_item_id is required for script generation')
  }

  const contentItem = await ContentService.getContentItemById(content_item_id)
  if (!contentItem) {
    throw new Error('Content item not found')
  }

  if (!contentItem.research) {
    throw new Error('Content item must have research data')
  }

  // Generate script
  const script = await ScriptService.generateScriptFromContent(contentItem)

  // Create reel
  const research = contentItem.research
  const reel = await ReelService.createReel(contentItem.user_id, {
    content_item_id: contentItem.id,
    topic: research.Idea || contentItem.topic,
    category: contentItem.category,
    description: research.Description || null,
    why_it_matters: research.WhyItMatters || null,
    useful_tips: research.UsefulTips || null,
    script,
  })

  // Mark content as done
  await ContentService.markContentDone(contentItem.id)

  // Schedule auto-approval check
  await JobService.scheduleJob('auto_approval', { reel_id: reel.id })
}

/**
 * Process auto-approval job
 */
async function processAutoApproval(job: BackgroundJob): Promise<void> {
  // Process all reels ready for auto-approval
  const reels = await ReelService.getReelsReadyForAutoApproval()

  for (const reel of reels) {
    try {
      await ReelService.approveReel(reel.id)

      // Schedule video generation
      await JobService.scheduleJob('video_generation', { reel_id: reel.id })
    } catch (error: any) {
      console.error(`Error auto-approving reel ${reel.id}:`, error)
    }
  }
}

/**
 * Process video generation job
 */
async function processVideoGeneration(job: BackgroundJob): Promise<void> {
  const { reel_id } = job.payload

  if (!reel_id) {
    throw new Error('reel_id is required for video generation')
  }

  const reel = await ReelService.getReelById(reel_id)
  if (!reel) {
    throw new Error('Reel not found')
  }

  // Idempotency: if the reel already has a video assigned, skip generation
  if (reel.heygen_video_id || reel.video_url) {
    console.log('[Reel Generation] Skipping: reel already has video', {
      reelId: reel_id,
      heygen_video_id: reel.heygen_video_id,
      hasVideoUrl: !!reel.video_url,
    })
    return
  }

  if (reel.status !== 'approved') {
    throw new Error(`Reel is not approved (status: ${reel.status})`)
  }

  if (!reel.script) {
    throw new Error('Reel must have a script')
  }

  // Get user_id from reel (required for avatar lookup)
  const userId = reel.user_id
  if (!userId) {
    throw new Error('Reel must have a user_id to generate video')
  }

  // Generate video with user_id for avatar lookup
  const videoData = await VideoService.generateVideoForReel(reel, userId)

  // Update reel with video information
  await ReelService.updateReelVideo(reel_id, {
    video_url: videoData.video_url ?? null,
    heygen_video_id: videoData.video_id,
  })
}

/**
 * Process topic generation job
 */
async function processTopicGeneration(job: BackgroundJob): Promise<void> {
  const { user_id } = job.payload

  if (!user_id) {
    throw new Error('user_id is required for topic generation')
  }

  // Generate topics
  const topics = await ResearchService.generateTopics(user_id)

  // Create content items
  for (const topic of topics) {
    const category = topic.Category === 'Fin. Freedom' ? 'Fin. Freedom' : topic.Category
    await ContentService.createContentItem(user_id, {
      topic: topic.Idea,
      category: category as 'Trading' | 'Lifestyle' | 'Fin. Freedom',
    })
  }
}

/**
 * Process research job
 */
async function processResearch(job: BackgroundJob): Promise<void> {
  const { content_item_id } = job.payload

  if (!content_item_id) {
    throw new Error('content_item_id is required for research')
  }

  const contentItem = await ContentService.getContentItemById(content_item_id)
  if (!contentItem) {
    throw new Error('Content item not found')
  }

  // Research topic
  const research = await ResearchService.researchTopic(contentItem.topic, contentItem.category)

  // Update content item with research
  await ContentService.updateContentResearch(content_item_id, research)
}

/**
 * Process all pending jobs
 */
export async function processJobQueue(limit = 10): Promise<number> {
  const jobs = await JobService.getPendingJobs(limit)
  let processed = 0

  for (const job of jobs) {
    try {
      await processJob(job)
      processed++
    } catch (error: any) {
      console.error(`Failed to process job ${job.id}:`, error)
    }
  }

  return processed
}

