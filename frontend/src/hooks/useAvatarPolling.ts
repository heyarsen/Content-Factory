import { useEffect, useRef, useCallback } from 'react'
import { pollingManager } from '../lib/pollingManager'
import { shouldShowError, handleError } from '../lib/errorHandler'
import api from '../lib/api'

interface Avatar {
  id: string
  heygen_avatar_id: string
  status: string
}

interface UseAvatarPollingOptions {
  avatars: Avatar[]
  onStatusUpdate?: (avatar: Avatar, status: string) => void
  onTrainingComplete?: (avatar: Avatar) => void
}

export function useAvatarPolling({ avatars, onStatusUpdate, onTrainingComplete }: UseAvatarPollingOptions) {
  const pollingCleanupsRef = useRef<Map<string, () => void>>(new Map())

  // Training status polling
  useEffect(() => {
    const avatarsNeedingUpdate = avatars.filter(avatar =>
      ['pending', 'training', 'generating'].includes(avatar.status)
    )

    if (avatarsNeedingUpdate.length === 0) {
      return
    }

    const pollingKey = 'training-status-polling'

    // Stop existing polling if any
    const existingCleanup = pollingCleanupsRef.current.get(pollingKey)
    if (existingCleanup) {
      existingCleanup()
    }

    // Start new polling operation
    const cleanup = pollingManager.startPolling(
      pollingKey,
      async () => {
        await Promise.all(
          avatarsNeedingUpdate.map(avatar =>
            handleRefreshTrainingStatus(avatar, { silent: true }).catch(err => {
              if (shouldShowError(err)) {
                console.error('Training status check error:', err)
              }
            })
          )
        )
      },
      30000, // Poll every 30 seconds
      {
        immediate: false,
        onError: (error) => {
          if (shouldShowError(error)) {
            console.error('Training status polling error:', error)
          }
        },
      }
    )

    pollingCleanupsRef.current.set(pollingKey, cleanup)

    return () => {
      cleanup()
      pollingCleanupsRef.current.delete(pollingKey)
    }
  }, [avatars])

  const handleRefreshTrainingStatus = useCallback(
    async (avatar: Avatar, options: { silent?: boolean } = {}) => {
      if (!avatar) return
      try {
        const response = await api.get(`/api/avatars/training-status/${avatar.heygen_avatar_id}`)
        const status = response.data?.status
        const normalizedStatus = status === 'ready' ? 'active' : status || avatar.status

        onStatusUpdate?.(avatar, normalizedStatus)

        if (status === 'ready' && onTrainingComplete) {
          onTrainingComplete(avatar)
        }

        if (!options.silent && shouldShowError(null)) {
          // Only show non-critical updates
        }
      } catch (error: any) {
        if (!options.silent && shouldShowError(error)) {
          handleError(error, {
            showToast: true,
            logError: true,
          })
        } else if (!options.silent) {
          handleError(error, {
            showToast: false,
            logError: true,
            silent: true,
          })
        }
      }
    },
    [onStatusUpdate, onTrainingComplete]
  )

  // Cleanup all polling on unmount
  useEffect(() => {
    return () => {
      pollingCleanupsRef.current.forEach(cleanup => cleanup())
      pollingCleanupsRef.current.clear()
    }
  }, [])

  return {
    refreshTrainingStatus: handleRefreshTrainingStatus,
  }
}

