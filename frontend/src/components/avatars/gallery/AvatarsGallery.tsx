import { useState } from 'react'
import { User, Sparkles, Plus, Settings2, Image } from 'lucide-react'
import { Avatar } from '../../../types/avatar'
import { AvatarImage } from '../AvatarImage'
import { Button } from '../../ui/Button'

interface AvatarsGalleryProps {
  avatars: Avatar[]
  loading: boolean
  viewMode: 'grid' | 'list'
  onAvatarClick: (avatar: Avatar) => void
  onCreateClick: () => void
  onGenerateLook?: (avatar: Avatar) => void
}

export function AvatarsGallery({
  avatars,
  loading,
  viewMode,
  onAvatarClick,
  onCreateClick,
  onGenerateLook,
}: AvatarsGalleryProps) {
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

  if (avatars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
          <User className="h-12 w-12 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2 text-center">
          No avatars yet
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-md mb-8">
          Create your first avatar by uploading a photo or generating one with AI
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={onCreateClick} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Create Avatar
          </Button>
        </div>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {avatars.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => onAvatarClick(avatar)}
            className="w-full p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left flex items-center gap-4"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <AvatarImage avatar={avatar} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {avatar.avatar_name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {avatar.source === 'ai_generated' ? 'AI Generated' : avatar.source === 'user_photo' ? 'Photo Upload' : 'Synced'}
              </p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Grid view
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {avatars.map((avatar) => (
        <div
          key={avatar.id}
          onClick={() => onAvatarClick(avatar)}
          className="group relative rounded-2xl overflow-hidden border-2 border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
        >
          {/* Avatar Image */}
          <div className="aspect-[3/4] relative bg-gradient-to-br from-slate-100 to-slate-200">
            <div className="absolute inset-0">
              <AvatarImage avatar={avatar} className="w-full h-full" />
            </div>

            {/* Hover Overlay with Quick Actions */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-3">
                {onGenerateLook && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onGenerateLook(avatar)
                    }}
                    className="p-3 bg-white rounded-xl hover:bg-cyan-50 transition-colors"
                    title="Generate Look"
                  >
                    <Image className="h-5 w-5 text-slate-900" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAvatarClick(avatar)
                  }}
                  className="p-3 bg-white rounded-xl hover:bg-cyan-50 transition-colors"
                  title="Settings"
                >
                  <Settings2 className="h-5 w-5 text-slate-900" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-1 truncate">{avatar.avatar_name}</h3>
            <p className="text-xs text-slate-500">
              {avatar.source === 'ai_generated' ? 'AI Generated' : avatar.source === 'user_photo' ? 'Photo Upload' : 'Synced'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

