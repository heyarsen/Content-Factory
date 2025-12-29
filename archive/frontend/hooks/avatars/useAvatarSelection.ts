import { useCallback, useMemo } from 'react'
import { useAvatarWorkspace } from '../../contexts/AvatarWorkspaceContext'
import { Avatar, PhotoAvatarLook } from '../../types/avatar'

export function useAvatarSelection(avatars: Avatar[]) {
  const {
    selectedAvatarId,
    selectedLooks,
    setSelectedAvatarId,
    toggleLookSelection,
    clearLookSelection,
  } = useAvatarWorkspace()

  const selectedAvatar = useMemo(() => {
    return selectedAvatarId ? avatars.find(a => a.id === selectedAvatarId) : null
  }, [avatars, selectedAvatarId])

  const selectAvatar = useCallback((avatarId: string | null) => {
    setSelectedAvatarId(avatarId)
    clearLookSelection() // Clear look selection when avatar changes
  }, [setSelectedAvatarId, clearLookSelection])

  const filteredLooks = useCallback((allLooks: Array<{ look: PhotoAvatarLook; avatar: Avatar }>) => {
    if (!selectedAvatarId) return allLooks
    return allLooks.filter(item => item.avatar.id === selectedAvatarId)
  }, [selectedAvatarId])

  return {
    selectedAvatarId,
    selectedAvatar,
    selectedLooks,
    selectAvatar,
    toggleLookSelection,
    clearLookSelection,
    filteredLooks,
  }
}

