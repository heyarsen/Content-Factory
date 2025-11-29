/**
 * Job Manager - Tracks background polling operations with cancellation support
 */

export interface JobStatus {
  id: string
  type: 'look_generation' | 'ai_generation' | 'training'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  generationId?: string
  groupId?: string
  avatarId?: string
  userId?: string
  startedAt: number
  completedAt?: number
  error?: string
  metadata?: Record<string, any>
}

class JobManager {
  private jobs = new Map<string, JobStatus>()
  private cancellationTokens = new Map<string, AbortController>()

  /**
   * Create a new job
   */
  createJob(
    type: JobStatus['type'],
    generationId: string,
    options: {
      groupId?: string
      avatarId?: string
      userId?: string
      metadata?: Record<string, any>
    } = {}
  ): string {
    const jobId = `${type}_${generationId}_${Date.now()}`
    const job: JobStatus = {
      id: jobId,
      type,
      status: 'pending',
      generationId,
      groupId: options.groupId,
      avatarId: options.avatarId,
      userId: options.userId,
      startedAt: Date.now(),
      metadata: options.metadata,
    }

    this.jobs.set(jobId, job)
    this.cancellationTokens.set(jobId, new AbortController())

    return jobId
  }

  /**
   * Update job status
   */
  updateJob(jobId: string, updates: Partial<JobStatus>): void {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    Object.assign(job, updates)
    if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
      job.completedAt = Date.now()
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Get job by generation ID
   */
  getJobByGenerationId(generationId: string, type?: JobStatus['type']): JobStatus | undefined {
    for (const job of this.jobs.values()) {
      if (job.generationId === generationId && (!type || job.type === type)) {
        return job
      }
    }
    return undefined
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string, type?: JobStatus['type']): JobStatus[] {
    const jobs: JobStatus[] = []
    for (const job of this.jobs.values()) {
      if (job.userId === userId && (!type || job.type === type)) {
        jobs.push(job)
      }
    }
    return jobs.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) {
      return false
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false
    }

    const controller = this.cancellationTokens.get(jobId)
    if (controller) {
      controller.abort()
    }

    this.updateJob(jobId, { status: 'cancelled' })
    return true
  }

  /**
   * Get cancellation token for a job
   */
  getCancellationToken(jobId: string): AbortController | undefined {
    return this.cancellationTokens.get(jobId)
  }

  /**
   * Check if job is cancelled
   */
  isCancelled(jobId: string): boolean {
    const controller = this.cancellationTokens.get(jobId)
    return controller?.signal.aborted || false
  }

  /**
   * Clean up old completed jobs (older than 1 hour)
   */
  cleanupOldJobs(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt &&
        job.completedAt < oneHourAgo
      ) {
        this.jobs.delete(jobId)
        this.cancellationTokens.delete(jobId)
      }
    }
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): JobStatus[] {
    return Array.from(this.jobs.values()).filter(
      job => job.status === 'pending' || job.status === 'in_progress'
    )
  }
}

// Singleton instance
export const jobManager = new JobManager()

// Cleanup old jobs every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    jobManager.cleanupOldJobs()
  }, 30 * 60 * 1000)
}

