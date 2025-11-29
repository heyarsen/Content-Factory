import { User, Star, Sparkles, Plus } from 'lucide-react'
import { Button } from '../ui/Button'

interface Avatar {
  id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
}

interface PhotoAvatarLook {
  id: string
  name?: string
  status?: string
  image_url?: string
  preview_url?: string
  thumbnail_url?: string
  created_at?: number
  updated_at?: number | null
  is_default?: boolean
}

interface LooksGridProps {
  looks: Array<{ look: PhotoAvatarLook; avatar: Avatar }>
  selectedAvatarFilter: string | null
  onCreateClick: () => void
  generatingLookIds: Set<string>
  loading: boolean
  avatars: Avatar[]
  onLookClick?: (look: PhotoAvatarLook, avatar: Avatar) => void
}

export function LooksGrid({
  looks,
  selectedAvatarFilter,
  onCreateClick,
  generatingLookIds,
  loading,
  avatars,
  onLookClick,
}: LooksGridProps) {
  // Filter looks based on selected avatar
  const filteredLooks = selectedAvatarFilter
    ? looks.filter(item => item.avatar.id === selectedAvatarFilter)
    : looks

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse"></div>
        ))}
      </div>
    )
  }

  if (filteredLooks.length === 0 && avatars.length > 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-12">
        <p className="text-sm text-slate-500 mb-4">No looks yet for this avatar</p>
        <Button onClick={onCreateClick} size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Look
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {/* Create new card */}
      <button
        onClick={onCreateClick}
        className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-300 hover:from-slate-100 hover:to-slate-150 flex flex-col items-center justify-center gap-3 transition-all duration-200 group"
      >
        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
          <Plus className="h-6 w-6 text-white" />
        </div>
        <span className="text-sm font-medium text-slate-700">Create new</span>
      </button>

      {/* Generating indicators */}
      {Array.from(generatingLookIds)
        .filter(avatarId => !selectedAvatarFilter || avatarId === selectedAvatarFilter)
        .map(avatarId => {
          const avatar = avatars.find(a => a.id === avatarId)
          if (!avatar) return null
          return (
            <div
              key={`generating-${avatarId}`}
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
                <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-medium text-slate-700">Generating...</p>
                <p className="text-xs text-slate-500 mt-1">{avatar.avatar_name}</p>
              </div>
            </div>
          )
        })}

      {/* Look cards */}
      {filteredLooks.map(({ look, avatar }) => (
        <div
          key={`${avatar.id}-${look.id}`}
          onClick={() => onLookClick?.(look, avatar)}
          className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 hover:shadow-xl transition-all duration-300 cursor-pointer"
        >
          {(() => {
            const imageUrl = look.image_url || look.preview_url || look.thumbnail_url
            const hasValidUrl = imageUrl && imageUrl.trim() !== ''
            return (
              <div className="relative w-full h-full">
                {/* Placeholder - always rendered as fallback */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                  <User className="h-12 w-12 text-slate-400" />
                </div>
                {/* Image - overlays placeholder if valid and loads successfully */}
                {hasValidUrl && (
                  <img
                    src={imageUrl}
                    alt={look.name || avatar.avatar_name}
                    className="relative w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 z-10"
                    onError={(e) => {
                      // Hide image on error to show placeholder
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                )}
              </div>
            )
          })()}

          {/* Default look indicator */}
          {look.is_default && (
            <div className="absolute top-3 right-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                <Star className="h-4 w-4 text-white fill-current" />
              </div>
            </div>
          )}

          {/* Look name and avatar name at bottom */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8">
            <p className="text-white text-sm font-medium truncate">{look.name || 'Look'}</p>
            <p className="text-white/70 text-xs truncate mt-0.5">{avatar.avatar_name}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

