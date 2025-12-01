import { AvatarSidebar } from './AvatarSidebar'
import { MainContentArea } from './MainContentArea'
import { ContextPanel } from './ContextPanel'
import { Avatar, PhotoAvatarLook } from '../../../types/avatar'
import { useContextPanel } from '../../../hooks/avatars/useContextPanel'
import { CreateAvatarPanel } from '../panels/CreateAvatarPanel'
import { GenerateLookPanel } from '../panels/GenerateLookPanel'
import { AvatarDetailsPanel } from '../panels/AvatarDetailsPanel'
import { LookDetailsPanel } from '../panels/LookDetailsPanel'

interface AvatarWorkspaceProps {
  avatars: Avatar[]
  loading: boolean
  allLooks: Array<{ look: PhotoAvatarLook; avatar: Avatar }>
  loadingLooks: boolean
  selectedAvatarId: string | null
  onSelectAvatar: (avatarId: string | null) => void
  onCreateAvatarClick: () => void
  onCreateAvatar: (data: { avatarName: string; photoFiles: File[] }) => Promise<void>
  onGenerateLook: (data: {
    avatar: Avatar
    prompt: string
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
  }) => Promise<void>
  onLookClick?: (look: PhotoAvatarLook, avatar: Avatar) => void
  onQuickGenerate?: (prompt: string) => void
  onGenerateAIClick?: () => void
  onAvatarClick?: (avatar: Avatar) => void
  generating?: boolean
  generatingLookIds?: Set<string>
}

export function AvatarWorkspace({
  avatars,
  loading,
  allLooks,
  loadingLooks,
  selectedAvatarId,
  onSelectAvatar,
  onCreateAvatarClick,
  onCreateAvatar,
  onGenerateLook,
  onLookClick,
  onQuickGenerate,
  onGenerateAIClick,
  onAvatarClick,
  generating,
  generatingLookIds = new Set(),
}: AvatarWorkspaceProps) {
  const panel = useContextPanel()
  
  const renderPanelContent = () => {
    if (!panel.isOpen) return null

    switch (panel.panelType) {
      case 'create-avatar':
        return (
          <CreateAvatarPanel
            onCreate={onCreateAvatar}
            onGenerateAI={() => {
              panel.closePanel()
              onGenerateAIClick?.()
            }}
          />
        )
      case 'generate-look':
        const generateAvatar = panel.panelData?.avatar || (selectedAvatarId ? avatars.find(a => a.id === selectedAvatarId) : undefined)
        return (
          <GenerateLookPanel
            avatar={generateAvatar}
            onGenerate={onGenerateLook}
            generating={generating}
          />
        )
      case 'avatar-details':
        const detailAvatar = panel.panelData?.avatar
        if (!detailAvatar) return null
        const lookCount = allLooks.filter(l => l.avatar.id === detailAvatar.id).length
        return (
          <AvatarDetailsPanel
            avatar={detailAvatar}
            lookCount={lookCount}
            onGenerateLook={() => panel.openGenerateLook(detailAvatar)}
          />
        )
      case 'look-details':
        const { look, avatar: lookAvatar } = panel.panelData || {}
        if (!look || !lookAvatar) return null
        return (
          <LookDetailsPanel
            look={look}
            avatar={lookAvatar}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-full gap-6 relative">
      {/* Left Sidebar - Avatar List */}
      <AvatarSidebar
        avatars={avatars}
        loading={loading}
        selectedAvatarId={selectedAvatarId}
        onSelectAvatar={onSelectAvatar}
        onCreateAvatarClick={onCreateAvatarClick}
      />

      {/* Main Content Area - Avatars or Looks Display */}
      <MainContentArea
        avatars={avatars}
        allLooks={allLooks}
        loadingLooks={loadingLooks}
        selectedAvatarId={selectedAvatarId}
        onSelectAvatar={onSelectAvatar}
        onLookClick={onLookClick}
        onAvatarClick={onAvatarClick}
        onCreateClick={() => panel.openCreateAvatar()}
        generatingLookIds={generatingLookIds}
        onQuickGenerate={onQuickGenerate}
        generating={generating}
      />

      {/* Context Panel - Slide-in panels for details/actions */}
      <ContextPanel
        isOpen={panel.isOpen}
        onClose={panel.closePanel}
        title={
          panel.panelType === 'create-avatar' ? 'Create Avatar' :
          panel.panelType === 'generate-look' ? 'Generate Look' :
          panel.panelType === 'avatar-details' ? 'Avatar Details' :
          panel.panelType === 'look-details' ? 'Look Details' :
          undefined
        }
      >
        {renderPanelContent()}
      </ContextPanel>
    </div>
  )
}

