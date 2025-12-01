import { useMemo } from 'react'
import { useAvatarData } from '../useAvatarData'
import { useAvatarPolling } from '../useAvatarPolling'
import { useLookGeneration } from '../useLookGeneration'
import { useToast } from '../useToast'

export function useAvatarWorkspaceState(selectedAvatarId: string | null) {
  const { toast } = useToast()

  // Load avatar data with lazy loading
  const { avatars, loading, allLooks, loadingLooks, loadAvatars, invalidateLooksCache, addAvatar } = useAvatarData({
    lazyLoadLooks: true,
    selectedAvatarId,
  })

  // Filter looks based on selection
  const looks = useMemo(() => {
    if (!selectedAvatarId) return allLooks
    return allLooks.filter(item => item.avatar.id === selectedAvatarId)
  }, [allLooks, selectedAvatarId])

  // Polling for training status
  const { refreshTrainingStatus } = useAvatarPolling({
    avatars: avatars as any,
    onStatusUpdate: () => {
      loadAvatars()
    },
    onTrainingComplete: (_avatar) => {
      toast.success('Avatar training completed!')
      loadAvatars()
      invalidateLooksCache()
    },
  })

  // Look generation
  const { generating, generatingLookIds, generateLook } = useLookGeneration({
    onSuccess: () => {
      loadAvatars()
      invalidateLooksCache()
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

