/**
 * Polling Manager - Handles polling operations with deduplication and cleanup
 */

type PollingKey = string
type PollingCallback = () => Promise<void> | void
type PollingCleanup = () => void

interface PollingOperation {
  key: PollingKey
  intervalId?: NodeJS.Timeout
  timeoutId?: NodeJS.Timeout
  callback: PollingCallback
  cleanup: PollingCleanup
  isActive: boolean
}

class PollingManager {
  private operations = new Map<PollingKey, PollingOperation>()
  private debounceTimers = new Map<PollingKey, NodeJS.Timeout>()

  /**
   * Start a polling operation with deduplication
   * If a polling operation with the same key already exists, it will be ignored
   */
  startPolling(
    key: PollingKey,
    callback: PollingCallback,
    interval: number,
    options: {
      immediate?: boolean // Run callback immediately on start
      maxAttempts?: number // Maximum number of polling attempts
      onComplete?: () => void // Called when polling completes
      onError?: (error: unknown) => void // Called on error
      cleanup?: PollingCleanup // Custom cleanup function
    } = {}
  ): () => void {
    const {
      immediate = false,
      maxAttempts,
      onComplete,
      onError,
      cleanup,
    } = options

    // If already polling, return existing cleanup function
    if (this.operations.has(key)) {
      const existing = this.operations.get(key)!
      if (existing.isActive) {
        // Return cleanup function for the existing operation
        return () => this.stopPolling(key)
      }
    }

    let attemptCount = 0
    let intervalId: NodeJS.Timeout | undefined
    let timeoutId: NodeJS.Timeout | undefined

    const wrappedCallback = async () => {
      try {
        attemptCount++
        
        // Check max attempts
        if (maxAttempts && attemptCount > maxAttempts) {
          this.stopPolling(key)
          if (onError) {
            onError(new Error('Polling timeout: maximum attempts reached'))
          }
          return
        }

        await callback()

        // If callback returns a truthy value, stop polling
        // This allows callbacks to signal completion
      } catch (error) {
        if (onError) {
          onError(error)
        } else {
          console.error(`Polling error for key "${key}":`, error)
        }
        // Continue polling on error (unless callback explicitly stops it)
      }
    }

    const cleanupFn: PollingCleanup = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = undefined
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      if (cleanup) {
        cleanup()
      }
    }

    const operation: PollingOperation = {
      key,
      callback: wrappedCallback,
      cleanup: cleanupFn,
      isActive: true,
    }

    this.operations.set(key, operation)

    // Run immediately if requested
    if (immediate) {
      wrappedCallback().catch(err => {
        if (onError) onError(err)
      })
    }

    // Start interval
    intervalId = setInterval(() => {
      if (operation.isActive) {
        wrappedCallback().catch(err => {
          if (onError) onError(err)
        })
      }
    }, interval)

    operation.intervalId = intervalId

    // Store cleanup function that can be called externally
    const stopPolling = () => {
      this.stopPolling(key)
      if (onComplete) {
        onComplete()
      }
    }

    return stopPolling
  }

  /**
   * Start a recursive polling operation (uses setTimeout instead of setInterval)
   */
  startRecursivePolling(
    key: PollingKey,
    callback: PollingCallback,
    delay: number,
    options: {
      immediate?: boolean
      maxAttempts?: number
      onComplete?: () => void
      onError?: (error: unknown) => void
      cleanup?: PollingCleanup
      shouldContinue?: (result: any) => boolean // Return false to stop polling
    } = {}
  ): () => void {
    const {
      immediate = false,
      maxAttempts,
      onComplete,
      onError,
      cleanup,
      shouldContinue,
    } = options

    // If already polling, return existing cleanup function
    if (this.operations.has(key)) {
      const existing = this.operations.get(key)!
      if (existing.isActive) {
        return () => this.stopPolling(key)
      }
    }

    let attemptCount = 0
    let timeoutId: NodeJS.Timeout | undefined
    let isCancelled = false

    const poll = async () => {
      if (isCancelled) return

      try {
        attemptCount++

        // Check max attempts
        if (maxAttempts && attemptCount > maxAttempts) {
          this.stopPolling(key)
          if (onError) {
            onError(new Error('Polling timeout: maximum attempts reached'))
          }
          return
        }

        const result = await callback()

        // Check if we should continue polling
        if (shouldContinue && !shouldContinue(result)) {
          this.stopPolling(key)
          if (onComplete) {
            onComplete()
          }
          return
        }

        // Schedule next poll if still active
        if (!isCancelled && this.operations.has(key)) {
          timeoutId = setTimeout(poll, delay)
        }
      } catch (error) {
        if (onError) {
          onError(error)
        } else {
          console.error(`Recursive polling error for key "${key}":`, error)
        }
        // Continue polling on error unless cancelled
        if (!isCancelled && this.operations.has(key)) {
          timeoutId = setTimeout(poll, delay)
        }
      }
    }

    const cleanupFn: PollingCleanup = () => {
      isCancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      if (cleanup) {
        cleanup()
      }
    }

    const operation: PollingOperation = {
      key,
      callback: poll,
      cleanup: cleanupFn,
      isActive: true,
    }

    this.operations.set(key, operation)

    // Run immediately if requested
    if (immediate) {
      poll().catch(err => {
        if (onError) onError(err)
      })
    } else {
      // Start first poll after delay
      timeoutId = setTimeout(poll, delay)
      operation.timeoutId = timeoutId
    }

    // Return cleanup function
    return () => {
      this.stopPolling(key)
      if (onComplete) {
        onComplete()
      }
    }
  }

  /**
   * Stop a specific polling operation
   */
  stopPolling(key: PollingKey): void {
    const operation = this.operations.get(key)
    if (operation) {
      operation.isActive = false
      operation.cleanup()
      this.operations.delete(key)
    }

    // Clear debounce timer if exists
    const debounceTimer = this.debounceTimers.get(key)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      this.debounceTimers.delete(key)
    }
  }

  /**
   * Stop all polling operations
   */
  stopAll(): void {
    const keys = Array.from(this.operations.keys())
    keys.forEach(key => this.stopPolling(key))
  }

  /**
   * Check if a polling operation is active
   */
  isPolling(key: PollingKey): boolean {
    return this.operations.has(key) && this.operations.get(key)!.isActive
  }

  /**
   * Debounce a polling start (useful for rapid status checks)
   */
  debouncedStartPolling(
    key: PollingKey,
    callback: PollingCallback,
    interval: number,
    debounceMs: number = 1000,
    options: Parameters<PollingManager['startPolling']>[2] = {}
  ): () => void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // If already polling, return cleanup
    if (this.isPolling(key)) {
      return () => this.stopPolling(key)
    }

    // Set debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key)
      this.startPolling(key, callback, interval, options)
    }, debounceMs)

    this.debounceTimers.set(key, timer)

    // Return cleanup function
    return () => {
      if (timer) {
        clearTimeout(timer)
        this.debounceTimers.delete(key)
      }
      this.stopPolling(key)
    }
  }
}

// Singleton instance
export const pollingManager = new PollingManager()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pollingManager.stopAll()
  })

  // Also cleanup when page becomes hidden (Page Visibility API)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Optionally pause polling when tab is hidden
      // For now, we'll let it continue but this can be customized
    }
  })
}

