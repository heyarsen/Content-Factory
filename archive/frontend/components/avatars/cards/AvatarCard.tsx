import { Sparkles, Settings2, Image } from 'lucide-react'
import { AvatarImage } from '../AvatarImage'

interface Avatar {
  id: string
  avatar_name: string
  avatar_url: string | null
  preview_url: string | null
  thumbnail_url: string | null
  status: string
  source?: 'synced' | 'user_photo' | 'ai_generated' | null
}

interface AvatarCardProps {
  avatar: Avatar
  isSelected?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onGenerateLook?: () => void
  onSettings?: () => void
  lookCount?: number
}

export function AvatarCard({
  avatar,
  isSelected = false,
  onClick,
  onDoubleClick,
  onGenerateLook,
  onSettings,
  lookCount,
}: AvatarCardProps) {
  const getStatusBadge = () => {
    if (avatar.status === 'training' || avatar.status === 'pending') {
      return (
        <div className="absolute top-3 right-3 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
          Training
        </div>
      )
    }
    if (avatar.status === 'failed') {
      return (
        <div className="absolute top-3 right-3 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
          Failed
        </div>
      )
    }
    return null
  }

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 cursor-pointer ${
        isSelected
          ? 'border-cyan-500 shadow-xl shadow-cyan-500/20'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
      }`}
    >
      {/* Avatar Image */}
      <div className="aspect-[3/4] relative bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="absolute inset-0">
          <AvatarImage avatar={avatar} size="lg" className="w-full h-full rounded-none" />
        </div>
        
        {/* Status Badge */}
        {getStatusBadge()}

        {/* Source Indicator */}
        {avatar.source === 'ai_generated' && (
          <div className="absolute top-3 left-3 p-2 bg-purple-500/90 backdrop-blur-sm rounded-lg">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        )}

        {/* Hover Overlay with Quick Actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center gap-3">
            {onGenerateLook && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onGenerateLook()
                }}
                className="p-3 bg-white rounded-xl hover:bg-cyan-50 transition-colors"
                title="Generate Look"
              >
                <Image className="h-5 w-5 text-slate-900" />
              </button>
            )}
            {onSettings && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSettings()
                }}
                className="p-3 bg-white rounded-xl hover:bg-cyan-50 transition-colors"
                title="Settings"
              >
                <Settings2 className="h-5 w-5 text-slate-900" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-white">
        <h3 className="font-semibold text-slate-900 mb-1 truncate">{avatar.avatar_name}</h3>
        {lookCount !== undefined && (
          <p className="text-sm text-slate-500">
            {lookCount} look{lookCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}

