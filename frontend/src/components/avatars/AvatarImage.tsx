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
  
  const imageUrl = avatar.thumbnail_url || avatar.preview_url || avatar.avatar_url
  const hasValidUrl = imageUrl && imageUrl.trim() !== ''

  // Use provided className dimensions if available, otherwise use size classes
  const containerSize = className.includes('w-full') && className.includes('h-full')
    ? className
    : className.includes('w-') || className.includes('h-')
    ? className
    : sizeClasses[size]

  if (!hasValidUrl || imageError) {
    if (!showPlaceholder) return null
    return (
      <div className={`${containerSize} flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg ${className.includes('rounded') ? '' : 'rounded-lg'}`}>
        <User className={`${size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-8 w-8'} text-white`} />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={avatar.avatar_name}
      className={`${containerSize} object-cover ${className.includes('rounded') ? className : 'rounded-lg'} ${className}`}
      onError={() => {
        setImageError(true)
        onError?.()
      }}
    />
  )
}
