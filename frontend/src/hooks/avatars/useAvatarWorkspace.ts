import { useMemo, useCallback, useRef } from 'react'
import { useAvatarData } from '../useAvatarData'
import { useAvatarPolling } from '../useAvatarPolling'
import { useLookGeneration } from '../useLookGeneration'
import { useToast } from '../useToast'

export function useAvatarWorkspaceState(selectedAvatarId: string | null) {
  const { toast } = useToast()

  // Load avatar data with lazy loading
  const { avatars, loading, allLooks, loadingLooks, loadAvatars, invalidateLooksCache, addAvatar, refreshLooksForAvatar } = useAvatarData({
    lazyLoadLooks: true,
    selectedAvatarId,
  })

  // Filter looks based on selection
  const looks = useMemo(() => {
    if (!selectedAvatarId) return allLooks
    return allLooks.filter(item => item.avatar.id === selectedAvatarId)
  }, [allLooks, selectedAvatarId])

  // Debounce loadAvatars to prevent too frequent updates
  const lastLoadTimeRef = useRef<number>(0)
  const debouncedLoadAvatars = useCallback(() => {
    const now = Date.now()
    // Only reload if at least 2 seconds have passed since last load
    if (now - lastLoadTimeRef.current > 2000) {
      lastLoadTimeRef.current = now
      loadAvatars()
    }
  }, [loadAvatars])

  // Polling for training status
  const { refreshTrainingStatus } = useAvatarPolling({
    avatars: avatars as any,
    onStatusUpdate: debouncedLoadAvatars,
    onTrainingComplete: useCallback((_avatar: { id: string; heygen_avatar_id: string; status: string }) => {
      toast.success('Avatar training completed!')
      loadAvatars()
      invalidateLooksCache()
    }, [toast, loadAvatars, invalidateLooksCache]),
  })

  // Look generation
  const { generating, generatingLookIds, generateLook } = useLookGeneration({
    onSuccess: () => {
      console.log('[useAvatarWorkspace] Look generation successful, reloading looks...')
      // Invalidate cache and refresh looks for the selected avatar
      if (selectedAvatarId) {
        // Use refreshLooksForAvatar which handles cache invalidation and state update
        refreshLooksForAvatar(selectedAvatarId).then((looks) => {
          console.log(`[useAvatarWorkspace] Refreshed ${looks.length} looks for avatar ${selectedAvatarId}`)
        }).catch(error => {
          console.error('[useAvatarWorkspace] Failed to refresh looks:', error)
        })
      } else {
        invalidateLooksCache()
      }

      // Reload avatars to ensure we have the latest avatar data
      loadAvatars()

      // Also refresh after a short delay to ensure backend has fully processed the new looks
      setTimeout(() => {
        console.log('[useAvatarWorkspace] Delayed refresh of looks...')
        if (selectedAvatarId) {
          refreshLooksForAvatar(selectedAvatarId).then((looks) => {
            console.log(`[useAvatarWorkspace] Delayed refresh: ${looks.length} looks for avatar ${selectedAvatarId}`)
          })
        } else {
          invalidateLooksCache()
        }
        loadAvatars()
      }, 3000)
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  return {
    // Data
    avatars,
    looks,
    allLooks,
    loading,
    loadingLooks,

    // Operations
    loadAvatars,
    invalidateLooksCache,
    addAvatar,
    refreshTrainingStatus,
    generateLook,
    generating,
    generatingLookIds,
    lookGenCheckingStatus: checkingStatus,
    lookGenStage: stage,
    lookGenError: error,
  }
}

