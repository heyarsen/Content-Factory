import { useCallback, useMemo, useState } from 'react'

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout'

interface RequestOptions {
  timeoutMs?: number
}

export function useRequestState(defaultTimeoutMs = 10000) {
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [error, setError] = useState<unknown>(null)
  const [lastAttemptedAt, setLastAttemptedAt] = useState<Date | null>(null)
  const [hasSucceeded, setHasSucceeded] = useState(false)

  const runRequest = useCallback(async <T>(request: () => Promise<T>, options?: RequestOptions): Promise<T | null> => {
    const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs
    setStatus('loading')
    setError(null)
    setLastAttemptedAt(new Date())

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs)
      })

      const result = await Promise.race([request(), timeoutPromise])
      setStatus('success')
      setHasSucceeded(true)
      return result
    } catch (requestError) {
      setError(requestError)
      if (requestError instanceof Error && requestError.message === 'REQUEST_TIMEOUT') {
        setStatus('timeout')
      } else {
        setStatus('error')
      }
      return null
    }
  }, [defaultTimeoutMs])

  const isInitialLoading = status === 'loading' && !hasSucceeded
  const isRefreshing = status === 'loading' && hasSucceeded

  return useMemo(() => ({
    status,
    error,
    lastAttemptedAt,
    hasSucceeded,
    isInitialLoading,
    isRefreshing,
    runRequest,
  }), [status, error, lastAttemptedAt, hasSucceeded, isInitialLoading, isRefreshing, runRequest])
}
