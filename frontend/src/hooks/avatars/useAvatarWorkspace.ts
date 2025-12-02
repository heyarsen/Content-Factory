import { useMemo, useCallback, useRef } from 'react'
import { useAvatarData } from '../useAvatarData'
import { useAvatarPolling } from '../useAvatarPolling'
import { useLookGeneration } from '../useLookGeneration'
import { useToast } from '../useToast'

export function useAvatarWorkspaceState(selectedAvatarId: string | null) {
  const { toast } = useToast()

  // Load avatar data with lazy loading
  const { avatars, loading, allLooks, loadingLooks, loadAvatars, invalidateLooksCache, addAvatar, loadLooksForAvatar } = useAvatarData({
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
      // Invalidate cache first so fresh data is fetched
      if (selectedAvatarId) {
        invalidateLooksCache(selectedAvatarId)
        // Reload looks for the selected avatar immediately
        loadLooksForAvatar(selectedAvatarId).then((looks) => {
          // Update allLooks state with the new looks
          const avatar = avatars.find(a => a.id === selectedAvatarId)
          if (avatar && looks) {
            // This will be handled by the useEffect, but we trigger it here too
            // The useEffect depends on avatars, so we need to ensure it runs
          }
        })
      } else {
        invalidateLooksCache()
      }
      
      // Reload avatars to trigger useEffect which will reload looks
      loadAvatars()
      
      // Also reload after a short delay to ensure backend has fully processed the new looks
      setTimeout(() => {
        if (selectedAvatarId) {
          invalidateLooksCache(selectedAvatarId)
          loadLooksForAvatar(selectedAvatarId)
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
  }
}

