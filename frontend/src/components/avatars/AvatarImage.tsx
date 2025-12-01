import { useState } from 'react'
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
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  
  const imageUrl = avatar.thumbnail_url || avatar.preview_url || avatar.avatar_url
  const hasValidUrl = imageUrl && imageUrl.trim() !== '' && !imageError

  // If className includes w-full or h-full, use those instead of size classes
  const containerClasses = className.includes('w-full') || className.includes('h-full')
    ? className
    : `${sizeClasses[size]} ${className}`
    
  return (
    <div className={`relative ${containerClasses}`}>
      {/* Placeholder - shown when no URL or image failed to load */}
      {(!hasValidUrl || imageError) && showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg">
          <User className={`${size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-8 w-8'} text-white`} />
        </div>
      )}
      {/* Image - overlays placeholder if valid and loads successfully */}
      {hasValidUrl && !imageError && (
        <img
          src={imageUrl}
          alt={avatar.avatar_name}
          className={`absolute inset-0 w-full h-full object-cover rounded-lg z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-200`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true)
            setImageLoaded(false)
            onError?.()
          }}
        />
      )}
    </div>
  )
}

