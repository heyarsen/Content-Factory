import { Sparkles, Upload, Trash2, Star } from 'lucide-react'
import { Button } from '../../ui/Button'

interface QuickActionBarProps {
  hasSelection: boolean
  selectedCount: number
  onGenerateLook?: () => void
  onUpload?: () => void
  onDelete?: () => void
  onSetDefault?: () => void
  className?: string
}

export function QuickActionBar({
  hasSelection,
  selectedCount,
  onGenerateLook,
  onUpload,
  onDelete,
  onSetDefault,
  className = '',
}: QuickActionBarProps) {
  if (!hasSelection) return null

  return (
    <div className={`sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 py-3 px-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onGenerateLook && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onGenerateLook}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Look
            </Button>
          )}
          {onUpload && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onUpload}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          )}
          {onSetDefault && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSetDefault}
            >
              <Star className="h-4 w-4 mr-2" />
              Set Default
            </Button>
          )}
          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

