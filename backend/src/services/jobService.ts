import { supabase } from '../lib/supabase.js'
import { BackgroundJob } from '../types/database.js'

export type JobType =
  | 'script_generation'
  | 'auto_approval'
  | 'video_generation'
  | 'topic_generation'
  | 'research'

export class JobService {
  private static readonly CREDIT_FAILURE_COOLDOWN_MS = 30 * 60 * 1000

  /**
   * Schedule a background job
   */
  static async scheduleJob(
    jobType: JobType,
    payload: Record<string, any>,
    scheduledAt?: Date
  ): Promise<BackgroundJob> {
    // Prevent duplicate pending/processing video generation jobs for the same reel.
    // Without this guard, cron can enqueue many identical jobs while a reel remains
    // in an unrecoverable state (e.g. insufficient credits), creating noisy retries.
    if (jobType === 'video_generation' && payload?.reel_id) {
      const { data: existingJob, error: existingJobError } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('job_type', 'video_generation')
        .eq('payload->>reel_id', String(payload.reel_id))
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingJobError) {
        console.error('Error checking for existing video generation job:', existingJobError)
      } else if (existingJob) {
        console.log(
          `[Job Queue] Skipping duplicate video_generation job for reel ${payload.reel_id}; existing job ${existingJob.id} is ${existingJob.status}`
        )
        return existingJob as BackgroundJob
      }

      // When a reel fails due to insufficient credits, schedulers can continuously
      // enqueue and fail the same job, creating noisy logs and needless DB churn.
      // Cool down re-queue attempts for a short period after the last credit failure.
      const { data: recentFailedJob, error: recentFailedJobError } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('job_type', 'video_generation')
        .eq('payload->>reel_id', String(payload.reel_id))
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentFailedJobError) {
        console.error('Error checking recent failed video generation job:', recentFailedJobError)
      } else if (
        recentFailedJob?.error_message?.toLowerCase().includes('insufficient credits')
        && Date.now() - new Date(recentFailedJob.updated_at).getTime() < JobService.CREDIT_FAILURE_COOLDOWN_MS
      ) {
        console.log(
          `[Job Queue] Skipping video_generation job for reel ${payload.reel_id}; recent insufficient-credits failure ${recentFailedJob.id} is still in cooldown`
        )
        return recentFailedJob as BackgroundJob
      }
    }

    const { data: job, error } = await supabase
      .from('background_jobs')
      .insert({
        job_type: jobType,
        payload,
        status: 'pending',
        scheduled_at: scheduledAt?.toISOString() || new Date().toISOString(),
        attempts: 0,
        max_attempts: 3,
      })
      .select()
      .single()

    if (error) {
      console.error('Error scheduling job:', error)
      throw new Error(`Failed to schedule job: ${error.message}`)
    }

    console.log(
      `[Job Queue] Scheduled ${jobType} job ${job.id} for ${scheduledAt?.toISOString() || 'now'}`,
      { payload }
    )

    return job
  }

  /**
   * Get pending jobs ready for execution
   */
  static async getPendingJobs(limit = 10): Promise<BackgroundJob[]> {
    const { retrySupabaseOperation } = await import('../lib/supabaseRetry.js')
    
    return retrySupabaseOperation(async () => {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('Error fetching pending jobs:', error)
        throw new Error(`Failed to fetch pending jobs: ${error.message}`)
      }

      // Filter out jobs that have exceeded max attempts
      return (data || []).filter(job => job.attempts < job.max_attempts)
    }, 3, 1000, 'getPendingJobs')
  }

  /**
   * Mark job as processing
   */
  static async markJobProcessing(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('background_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      console.error('Error marking job as processing:', error)
      throw new Error(`Failed to update job status: ${error.message}`)
    }
  }

  /**
   * Mark job as completed
   */
  static async markJobCompleted(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      console.error('Error marking job as completed:', error)
      throw new Error(`Failed to update job status: ${error.message}`)
    }
  }

  /**
   * Mark job as failed
   */
  static async markJobFailed(jobId: string, errorMessage: string, incrementAttempts = true): Promise<void> {
    const job = await this.getJobById(jobId)
    if (!job) {
      throw new Error('Job not found')
    }

    const newAttempts = incrementAttempts ? job.attempts + 1 : job.attempts
    const shouldRetry = newAttempts < job.max_attempts

    const { error } = await supabase
      .from('background_jobs')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        attempts: newAttempts,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
        // Retry after 5 minutes if should retry
        scheduled_at: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined,
      })
      .eq('id', jobId)

    if (error) {
      console.error('Error marking job as failed:', error)
      throw new Error(`Failed to update job status: ${error.message}`)
    }
  }

  /**
   * Get job by ID
   */
  static async getJobById(jobId: string): Promise<BackgroundJob | null> {
    const { data, error } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching job:', error)
      throw new Error(`Failed to fetch job: ${error.message}`)
    }

    return data
  }

  /**
   * Process auto-approval for pending reels
   * Note: This is handled by the job processor, not directly here
   */
  static async processAutoApproval(): Promise<number> {
    // This method is kept for backwards compatibility
    // Actual processing is done in jobs/processors.ts
    const { ReelService } = await import('./reelService.js')
    const reels = await ReelService.getReelsReadyForAutoApproval()
    let approvedCount = 0

    for (const reel of reels) {
      try {
        await ReelService.approveReel(reel.id)
        approvedCount++

        // Trigger video generation
        await JobService.scheduleJob('video_generation', { reel_id: reel.id })
      } catch (error: any) {
        console.error(`Error auto-approving reel ${reel.id}:`, error)
      }
    }

    return approvedCount
  }
}
