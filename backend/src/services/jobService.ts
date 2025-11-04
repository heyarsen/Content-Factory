import { supabase } from '../lib/supabase.js'
import { BackgroundJob } from '../types/database.js'

export type JobType =
  | 'script_generation'
  | 'auto_approval'
  | 'video_generation'
  | 'topic_generation'
  | 'research'

export class JobService {
  /**
   * Schedule a background job
   */
  static async scheduleJob(
    jobType: JobType,
    payload: Record<string, any>,
    scheduledAt?: Date
  ): Promise<BackgroundJob> {
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

    return job
  }

  /**
   * Get pending jobs ready for execution
   */
  static async getPendingJobs(limit = 10): Promise<BackgroundJob[]> {
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

