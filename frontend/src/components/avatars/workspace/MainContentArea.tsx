import { Avatar, PhotoAvatarLook } from '../../../types/avatar'
import { LooksGallery } from '../gallery/LooksGallery'
import { QuickPromptBar } from '../actions/QuickPromptBar'
import { Grid3x3, List } from 'lucide-react'
import { useAvatarWorkspace } from '../../../contexts/AvatarWorkspaceContext'

interface MainContentAreaProps {
  avatars: Avatar[]
  allLooks: Array<{ look: PhotoAvatarLook; avatar: Avatar }>
  loadingLooks: boolean
  selectedAvatarId: string | null
  onLookClick?: (look: PhotoAvatarLook, avatar: Avatar) => void
  onCreateClick?: () => void
  generatingLookIds?: Set<string>
  onQuickGenerate?: (prompt: string) => void
  generating?: boolean
}

export function MainContentArea({
  avatars,
  allLooks,
  loadingLooks,
  selectedAvatarId,
  onLookClick,
  onCreateClick,
  generatingLookIds = new Set(),
  onQuickGenerate,
  generating,
}: MainContentAreaProps) {
  const { viewMode, setViewMode } = useAvatarWorkspace()
  const filteredLooks = selectedAvatarId
    ? allLooks.filter(item => item.avatar.id === selectedAvatarId)
    : allLooks

  const selectedAvatar = selectedAvatarId ? avatars.find(a => a.id === selectedAvatarId) : null

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {selectedAvatar ? selectedAvatar.avatar_name : 'All Avatars'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {selectedAvatar
              ? `Managing looks for "${selectedAvatar.avatar_name}"`
              : 'View and manage all avatar looks'}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            aria-label="Grid view"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Prompt Bar (shown when avatar selected) */}
      {selectedAvatar && onQuickGenerate && (
        <QuickPromptBar
          onGenerate={onQuickGenerate}
          generating={generating}
          avatarName={selectedAvatar.avatar_name}
        />
      )}

      {/* Looks Gallery */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <LooksGallery
          looks={filteredLooks}
          avatars={avatars}
          selectedAvatarId={selectedAvatarId}
          viewMode={viewMode}
          onCreateClick={onCreateClick || (() => {})}
          onLookClick={onLookClick}
          generatingLookIds={generatingLookIds}
          loading={loadingLooks}
        />
      </div>
    </div>
  )
}

