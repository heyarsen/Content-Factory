import { useState } from 'react'
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

function LookCard({
  look,
  avatar,
  imageUrl,
  onClick,
}: {
  look: PhotoAvatarLook
  avatar: Avatar
  imageUrl: string | null
  onClick: () => void
}) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div
      onClick={onClick}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className="relative w-full h-full">
        {/* Placeholder - shown when no URL or image failed to load */}
        {(!imageUrl || imageError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
            <User className="h-12 w-12 text-slate-400" />
          </div>
        )}
        {/* Image - overlays placeholder if valid and loads successfully */}
        {imageUrl && !imageError && (
          <img
            src={imageUrl}
            alt={look.name || avatar.avatar_name}
            className={`relative w-full h-full object-cover transition-all duration-300 group-hover:scale-105 z-10 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true)
              setImageLoaded(false)
            }}
          />
        )}
      </div>

      {/* Default look indicator */}
      {look.is_default && (
        <div className="absolute top-3 right-3 z-20">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
            <Star className="h-4 w-4 text-white fill-current" />
          </div>
        </div>
      )}

      {/* Look name and avatar name at bottom */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8 z-20">
        <p className="text-white text-sm font-medium truncate">{look.name || 'Look'}</p>
        <p className="text-white/70 text-xs truncate mt-0.5">{avatar.avatar_name}</p>
      </div>
    </div>
  )
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
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse"></div>
        ))}
      </div>
    )
  }

  if (filteredLooks.length === 0) {
    if (avatars.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <User className="h-12 w-12 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-700 mb-2">No avatars yet</p>
          <p className="text-sm text-slate-500 mb-6">Create your first avatar to get started</p>
          <Button onClick={onCreateClick} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Create Avatar
          </Button>
        </div>
      )
    }
    
    // Show empty state with helpful message
    const selectedAvatar = selectedAvatarFilter ? avatars.find(a => a.id === selectedAvatarFilter) : null
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-4">
          <Sparkles className="h-12 w-12 text-purple-400" />
        </div>
        <p className="text-lg font-medium text-slate-700 mb-2">
          {selectedAvatarFilter && selectedAvatar
            ? `No looks yet for "${selectedAvatar.avatar_name}"`
            : 'No looks found'}
        </p>
        <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
          {selectedAvatarFilter
            ? 'This avatar doesn\'t have any looks yet. Generate or upload a look to get started.'
            : 'None of your avatars have looks yet. Select an avatar or create a new one to generate looks.'}
        </p>
        <Button onClick={onCreateClick} size="lg">
          <Sparkles className="h-5 w-5 mr-2" />
          {selectedAvatarFilter ? 'Generate Look' : 'Create Avatar'}
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
      {filteredLooks.map(({ look, avatar }) => {
        const imageUrl = look.image_url || look.preview_url || look.thumbnail_url
        const hasValidUrl = imageUrl && imageUrl.trim() !== ''
        
        return (
          <LookCard
            key={`${avatar.id}-${look.id}`}
            look={look}
            avatar={avatar}
            imageUrl={hasValidUrl ? imageUrl : null}
            onClick={() => onLookClick?.(look, avatar)}
          />
        )
      })}
    </div>
  )
}

