import { Plus } from 'lucide-react'
import { AvatarImage } from './AvatarImage'

interface Avatar {
  id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
}

interface AvatarSelectorProps {
  avatars: Avatar[]
  selectedAvatarId: string | null
  onSelect: (avatarId: string | null) => void
  onCreateClick: () => void
  maxVisible?: number
}

export function AvatarSelector({
  avatars,
  selectedAvatarId,
  onSelect,
  onCreateClick,
  maxVisible = 7,
}: AvatarSelectorProps) {
  const visibleAvatars = avatars.slice(0, maxVisible)
  const extraAvatarsCount = Math.max(0, avatars.length - maxVisible)

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {/* "All" button */}
      <button
        onClick={() => onSelect(null)}
        className={`flex flex-col items-center gap-2 flex-shrink-0 group transition-all duration-200`}
      >
        <div
          className={`w-20 h-20 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
            selectedAvatarId === null
              ? 'border-cyan-400 bg-white shadow-lg shadow-cyan-100'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span
            className={`text-sm font-semibold ${
              selectedAvatarId === null ? 'text-slate-900' : 'text-slate-600'
            }`}
          >
            All
          </span>
        </div>
      </button>

      {/* Avatar rounded squares */}
      {visibleAvatars.map((avatar) => (
        <button
          key={avatar.id}
          onClick={() => onSelect(avatar.id === selectedAvatarId ? null : avatar.id)}
          className="flex flex-col items-center gap-2 flex-shrink-0 group transition-all duration-200"
        >
          <div
            className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
              selectedAvatarId === avatar.id
                ? 'border-cyan-400 shadow-lg shadow-cyan-100'
                : 'border-transparent hover:border-slate-300'
            }`}
          >
            <AvatarImage avatar={avatar} size="lg" />
          </div>
          <span
            className={`text-xs font-medium max-w-[72px] truncate ${
              selectedAvatarId === avatar.id ? 'text-slate-900' : 'text-slate-600'
            }`}
          >
            {avatar.avatar_name}
          </span>
        </button>
      ))}

      {/* Create Avatar button */}
      <button
        onClick={onCreateClick}
        className="flex flex-col items-center gap-2 flex-shrink-0 group transition-all duration-200"
      >
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-dashed border-cyan-300 hover:border-cyan-400 hover:from-cyan-100 hover:to-blue-100 flex items-center justify-center transition-all duration-200">
          <Plus className="h-8 w-8 text-cyan-600" />
        </div>
        <span className="text-xs font-medium max-w-[72px] truncate text-slate-600">Create Avatar</span>
      </button>

      {/* "+N more" button */}
      {extraAvatarsCount > 0 && (
        <button
          onClick={() => {
            // Show first hidden avatar
            const hiddenAvatars = avatars.slice(maxVisible)
            if (hiddenAvatars.length > 0) {
              onSelect(hiddenAvatars[0].id)
            }
          }}
          className="flex flex-col items-center gap-2 flex-shrink-0 group"
        >
          <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center border-2 border-transparent hover:border-slate-600 transition-all duration-200">
            <span className="text-white font-semibold">+{extraAvatarsCount}</span>
          </div>
        </button>
      )}
    </div>
  )
}

