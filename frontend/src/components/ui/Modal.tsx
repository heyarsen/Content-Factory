import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
}

export function Modal({ isOpen, onClose, title, children, size = 'md', closeOnOverlayClick = true }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
    full: 'max-w-[min(90vw,1100px)]',
  }

  return (
    <div
      className="fixed inset-0 z-[9999]"
      onClick={closeOnOverlayClick ? onClose : undefined}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        padding: '1rem',
        paddingTop: '6rem' /* Ensure modal container has space for header (5rem) + padding (1rem) */
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        aria-hidden="true"
      ></div>

      {/* Modal Content - Centered accounting for sidebar and header */}
      <div
        className={`modal-content absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${sizes[size]} transform overflow-hidden rounded-3xl border border-white/60 bg-white/95 text-left shadow-[0_45px_95px_-55px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-all flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        style={{
          // Max dimensions: Account for header (5rem = 80px) and padding
          // Ensure modal never exceeds available vertical space
          // Header is 5rem, we need at least 2rem padding (1rem top + 1rem bottom)
          // So max height = viewport - header - padding
          maxHeight: 'calc(100vh - 7rem)', // Account for header (5rem) + top padding (1rem) + bottom padding (1rem)
          // Max width is handled by CSS media queries in index.css
        }}
      >
        {/* Header - Fixed height */}
        <div className="flex items-center justify-between border-b border-white/60 px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-white to-slate-50/50 flex-shrink-0">
          <h3 className="text-lg sm:text-xl font-semibold text-primary truncate pr-2">{title}</h3>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100/70 hover:text-primary focus:outline-none focus:ring-2 focus:ring-brand-200 flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Content - Scrollable */}
        <div className="px-6 sm:px-8 py-4 sm:py-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}

