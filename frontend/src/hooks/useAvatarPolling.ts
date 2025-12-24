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
  // Store avatars that need polling in a ref to persist across renders
  const avatarsToPollRef = useRef<Map<string, Avatar>>(new Map())

  const handleRefreshTrainingStatus = useCallback(
    async (avatar: Avatar, options: { silent?: boolean } = {}) => {
      if (!avatar) return
      try {
        let normalizedStatus = avatar.status
        let statusChanged = false

        if (avatar.status === 'generating') {
          const response = await api.get(`/api/avatars/generation-status/${avatar.heygen_avatar_id}`)
          const status = response.data?.status

          if (status === 'success') {
            normalizedStatus = 'awaiting_selection'
            statusChanged = true
          } else if (status === 'failed') {
            normalizedStatus = 'failed'
            statusChanged = true
          }
        } else {
          const response = await api.get(`/api/avatars/training-status/${avatar.heygen_avatar_id}`, {
            timeout: 300000, // 5 minutes timeout for status checks
          })
          const status = response.data?.status
          normalizedStatus = status === 'ready' ? 'active' : status || avatar.status
          statusChanged = normalizedStatus !== avatar.status
        }

        // Update the stored avatar status
        if (avatarsToPollRef.current.has(avatar.id)) {
          const storedAvatar = avatarsToPollRef.current.get(avatar.id)!
          storedAvatar.status = normalizedStatus
          avatarsToPollRef.current.set(avatar.id, storedAvatar)
        }

        // Only call onStatusUpdate if status actually changed
        if (statusChanged) {
          onStatusUpdate?.(avatar, normalizedStatus)
        }

        // Remove from polling if status changed to active/ready
        if (normalizedStatus === 'active' || normalizedStatus === 'ready') {
          avatarsToPollRef.current.delete(avatar.id)
          if (onTrainingComplete && statusChanged) {
            onTrainingComplete(avatar)
          }
        }

        if (!options.silent && shouldShowError(null)) {
          // Only show non-critical updates
        }
      } catch (error: any) {
        // Don't remove from polling on error - keep trying
        // Only log if it's a significant error
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

  // Update the ref with current avatars that need polling
  useEffect(() => {
    const avatarsNeedingUpdate = avatars.filter(avatar =>
      ['pending', 'training', 'generating'].includes(avatar.status)
    )

    // Add new avatars to the polling ref
    avatarsNeedingUpdate.forEach(avatar => {
      avatarsToPollRef.current.set(avatar.id, avatar)
    })

    // Remove avatars that are no longer in pending/training/generating status
    // but keep them if they're still in the avatars list (in case of temporary load failures)
    for (const [id, storedAvatar] of avatarsToPollRef.current.entries()) {
      const currentAvatar = avatars.find(a => a.id === id)
      if (currentAvatar && !['pending', 'training', 'generating'].includes(currentAvatar.status)) {
        // Status changed - remove from polling
        avatarsToPollRef.current.delete(id)
      } else if (!currentAvatar && !['pending', 'training', 'generating'].includes(storedAvatar.status)) {
        // Avatar not in current list and status changed - remove from polling
        avatarsToPollRef.current.delete(id)
      }
    }
  }, [avatars])

  // Training status polling
  useEffect(() => {
    // Use the ref to get avatars that need polling (persists across renders)
    const avatarsNeedingUpdate = Array.from(avatarsToPollRef.current.values()).filter(avatar =>
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
        // Get current avatars from ref (may include avatars not in current avatars array)
        const currentAvatarsToPoll = Array.from(avatarsToPollRef.current.values()).filter(avatar =>
          ['pending', 'training', 'generating'].includes(avatar.status)
        )

        await Promise.all(
          currentAvatarsToPoll.map(avatar =>
            handleRefreshTrainingStatus(avatar, { silent: true }).catch(err => {
              // Don't log timeout errors as they're expected for long-running operations
              if (shouldShowError(err) && !err.message?.includes('timeout') && !err.code?.includes('ECONNABORTED')) {
                console.error('Training status check error:', err)
              }
            })
          )
        )
      },
      30000, // Poll every 30 seconds
      {
        immediate: true, // Start polling immediately
        onError: (error: unknown) => {
          // Don't log timeout errors as they're expected
          const err = error as { message?: string; code?: string }
          if (shouldShowError(error) && !err.message?.includes('timeout') && !err.code?.includes('ECONNABORTED')) {
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
  }, [avatars, handleRefreshTrainingStatus]) // eslint-disable-line react-hooks/exhaustive-deps

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

