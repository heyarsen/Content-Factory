import { useCallback } from 'react'
import { useAvatarWorkspace } from '../../contexts/AvatarWorkspaceContext'

export function useContextPanel() {
  const { panelType, panelData, openPanel, closePanel } = useAvatarWorkspace()

  const openAvatarDetails = useCallback((avatar: any) => {
    openPanel('avatar-details', { avatar })
  }, [openPanel])

  const openLookDetails = useCallback((look: any, avatar: any) => {
    openPanel('look-details', { look, avatar })
  }, [openPanel])

  const openCreateAvatar = useCallback(() => {
    openPanel('create-avatar')
  }, [openPanel])

  const openGenerateLook = useCallback((avatar?: any) => {
    openPanel('generate-look', avatar ? { avatar } : null)
  }, [openPanel])

  return {
    panelType,
    panelData,
    isOpen: panelType !== null,
    openPanel,
    closePanel,
    openAvatarDetails,
    openLookDetails,
    openCreateAvatar,
    openGenerateLook,
  }
}

