import { User } from 'lucide-react'

interface AvatarImageProps {
  avatar: {
    avatar_url?: string | null
    preview_url?: string | null
    thumbnail_url?: string | null
    avatar_name: string
  }
  size?: 'sm' | 'md' | 'lg'
  showPlaceholder?: boolean
  className?: string
  onError?: () => void
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
}

export function AvatarImage({
  avatar,
  size = 'md',
  showPlaceholder = true,
  className = '',
  onError,
}: AvatarImageProps) {
  const imageUrl = avatar.thumbnail_url || avatar.preview_url || avatar.avatar_url
  const hasValidUrl = imageUrl && imageUrl.trim() !== ''

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Placeholder - always rendered as fallback */}
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg">
          <User className={`${size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-8 w-8'} text-white`} />
        </div>
      )}
      {/* Image - overlays placeholder if valid and loads successfully */}
      {hasValidUrl && (
        <img
          src={imageUrl}
          alt={avatar.avatar_name}
          className="relative w-full h-full object-cover rounded-lg z-10"
          onError={(e) => {
            // Hide image on error to show placeholder
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            onError?.()
          }}
        />
      )}
    </div>
  )
}

