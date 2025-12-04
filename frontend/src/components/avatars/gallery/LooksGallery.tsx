import { useState } from 'react'
import { Star, Sparkles, Plus, Image as ImageIcon, Zap } from 'lucide-react'
import { Avatar, PhotoAvatarLook } from '../../../types/avatar'
import { Button } from '../../ui/Button'

interface LooksGalleryProps {
  looks: Array<{ look: PhotoAvatarLook; avatar: Avatar }>
  avatars: Avatar[]
  selectedAvatarId: string | null
  viewMode: 'grid' | 'list'
  onCreateClick: () => void
  onLookClick?: (look: PhotoAvatarLook, avatar: Avatar) => void
  onAddMotion?: (look: PhotoAvatarLook, avatar: Avatar) => void
  generatingLookIds: Set<string>
  addingMotionLookIds?: Set<string>
  loading: boolean
}

export function LooksGallery({
  looks,
  avatars,
  selectedAvatarId,
  viewMode,
  onCreateClick,
  onLookClick,
  onAddMotion,
  generatingLookIds,
  addingMotionLookIds = new Set(),
  loading,
}: LooksGalleryProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (lookId: string) => {
    setImageErrors(prev => new Set(prev).add(lookId))
  }

  const selectedAvatar = selectedAvatarId ? avatars.find(a => a.id === selectedAvatarId) : null

  if (loading) {
    return (
      <div className={viewMode === 'grid' 
        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
        : 'space-y-3'
      }>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div 
            key={i} 
            className={viewMode === 'grid' 
              ? 'aspect-[3/4] bg-slate-200 rounded-2xl animate-pulse' 
              : 'h-20 bg-slate-200 rounded-xl animate-pulse'
            } 
          />
        ))}
      </div>
    )
  }

  if (looks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-6">
          <Sparkles className="h-12 w-12 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          {selectedAvatar ? `No looks yet for "${selectedAvatar.avatar_name}"` : 'No looks found'}
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-md mb-8">
          {selectedAvatar
            ? 'This avatar doesn\'t have any looks yet. Generate or upload a look to get started.'
            : 'None of your avatars have looks yet. Select an avatar or create a new one to generate looks.'}
        </p>
        <Button onClick={onCreateClick} size="lg">
          <Sparkles className="h-5 w-5 mr-2" />
          {selectedAvatar ? 'Generate Look' : 'Create Avatar'}
        </Button>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {/* Create new button */}
        <button
          onClick={onCreateClick}
          className="w-full p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-300 hover:from-slate-100 hover:to-slate-150 flex items-center gap-4 transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
            <Plus className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Create new look</p>
            <p className="text-xs text-slate-500">Generate or upload a new look</p>
          </div>
        </button>

        {/* Generating indicators */}
        {Array.from(generatingLookIds)
          .filter(avatarId => !selectedAvatarId || avatarId === selectedAvatarId)
          .map(avatarId => {
            const avatar = avatars.find(a => a.id === avatarId)
            if (!avatar) return null
            return (
              <div
                key={`generating-${avatarId}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <div className="h-6 w-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">Generating look...</p>
                  <p className="text-xs text-slate-500">{avatar.avatar_name}</p>
                </div>
              </div>
            )
          })}

        {/* Look cards */}
        {looks.map(({ look, avatar }) => {
          const imageUrl = look.image_url || look.preview_url || look.thumbnail_url
          const hasValidUrl = imageUrl && imageUrl.trim() !== '' && !imageErrors.has(look.id)

          return (
            <div
              key={`${avatar.id}-${look.id}`}
              className="group relative flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200"
            >
              {/* Thumbnail */}
              <div 
                onClick={() => onLookClick?.(look, avatar)}
                className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer"
              >
                {!hasValidUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                    <ImageIcon className="h-8 w-8 text-slate-400" />
                  </div>
                ) : (
                  <img
                    src={imageUrl}
                    alt={look.name || avatar.avatar_name}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(look.id)}
                  />
                )}
                {look.is_default && (
                  <div className="absolute top-1 right-1 z-10">
                    <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center shadow-sm">
                      <Star className="h-3 w-3 text-white fill-current" />
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div 
                onClick={() => onLookClick?.(look, avatar)}
                className="flex-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {look.name || 'Unnamed Look'}
                  </h3>
                  {look.is_default && (
                    <span className="px-2 py-0.5 text-xs font-medium text-cyan-700 bg-cyan-50 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{avatar.avatar_name}</p>
                {look.status && (
                  <p className="text-xs text-slate-400 mt-1 capitalize">{look.status}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {onAddMotion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddMotion(look, avatar)
                    }}
                    disabled={addingMotionLookIds.has(look.id)}
                    className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add motion to this look"
                  >
                    {addingMotionLookIds.has(look.id) ? (
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                  </button>
                )}
                <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Grid view
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
        .filter(avatarId => !selectedAvatarId || avatarId === selectedAvatarId)
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
      {looks.map(({ look, avatar }) => {
        const imageUrl = look.image_url || look.preview_url || look.thumbnail_url
        const hasValidUrl = imageUrl && imageUrl.trim() !== '' && !imageErrors.has(look.id)

        return (
          <div
            key={`${avatar.id}-${look.id}`}
            className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 hover:shadow-xl transition-all duration-300"
          >
            <div 
              onClick={() => onLookClick?.(look, avatar)}
              className="relative w-full h-full cursor-pointer"
            >
              {/* Placeholder */}
              {!hasValidUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                  <ImageIcon className="h-12 w-12 text-slate-400" />
                </div>
              )}
              {/* Image */}
              {hasValidUrl && (
                <img
                  src={imageUrl}
                  alt={look.name || avatar.avatar_name}
                  className="relative w-full h-full object-cover transition-all duration-300 group-hover:scale-105 z-10"
                  onError={() => handleImageError(look.id)}
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

            {/* Add Motion button */}
            {onAddMotion && (
              <div className="absolute top-3 left-3 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddMotion(look, avatar)
                  }}
                  disabled={addingMotionLookIds.has(look.id)}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  title="Add motion to this look"
                >
                  {addingMotionLookIds.has(look.id) ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}

            {/* Look name and avatar name at bottom */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8 z-20">
              <p className="text-white text-sm font-medium truncate">{look.name || 'Look'}</p>
              <p className="text-white/70 text-xs truncate mt-0.5">{avatar.avatar_name}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

