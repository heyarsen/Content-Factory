import { Sparkles, MoreVertical } from 'lucide-react'
import { AvatarImage } from '../AvatarImage'
import { Avatar } from '../../../types/avatar'

interface AvatarCardCompactProps {
  avatar: Avatar
  isSelected: boolean
  onClick: () => void
  lookCount?: number
}

export function AvatarCardCompact({
  avatar,
  isSelected,
  onClick,
  lookCount,
}: AvatarCardCompactProps) {
  const getStatusBadge = () => {
    if (avatar.status === 'active' || avatar.status === 'ready') {
      return null // No badge needed for active
    }
    if (avatar.status === 'training' || avatar.status === 'pending') {
      return (
        <div className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
      )
    }
    if (avatar.status === 'failed') {
      return (
        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
      )
    }
    return null
  }

  const getSourceIcon = () => {
    if (avatar.source === 'ai_generated') {
      return <Sparkles className="h-3 w-3 text-purple-500" />
    }
    return null
  }

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-xl border-2 transition-all duration-200 text-left group ${
        isSelected
          ? 'border-cyan-500 bg-cyan-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar Image */}
        <div className="relative flex-shrink-0">
          <div className={`w-16 h-16 rounded-lg overflow-hidden bg-slate-100 ${
            isSelected ? 'ring-2 ring-cyan-500' : ''
          }`}>
            <AvatarImage avatar={avatar} size="lg" className="w-full h-full rounded-lg" />
          </div>
          {getStatusBadge()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {avatar.avatar_name}
            </h3>
            {getSourceIcon()}
          </div>
          {lookCount !== undefined && (
            <p className="text-xs text-slate-500">
              {lookCount} look{lookCount !== 1 ? 's' : ''}
            </p>
          )}
          {avatar.status !== 'active' && avatar.status !== 'ready' && (
            <p className="text-xs text-amber-600 capitalize mt-1">
              {avatar.status}
            </p>
          )}
        </div>

        {/* More Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            // Will open context menu
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </button>
  )
}

