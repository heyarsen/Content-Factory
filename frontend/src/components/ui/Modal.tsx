import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
}

export function Modal({ isOpen, onClose, title, children, size = 'md', closeOnOverlayClick = true, showCloseButton = true }: ModalProps) {
  const handleClose = onClose || (() => { })
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
    sm: 'max-w-4xl',
    md: 'max-w-4xl',
    lg: 'max-w-5xl',
    xl: 'max-w-7xl',
    full: 'max-w-[min(98vw,1600px)]',
  }

  return (
    <div
      className="fixed z-[9999] inset-0 lg:left-72 lg:top-16 flex items-center justify-center p-2 sm:p-6"
      onClick={closeOnOverlayClick ? handleClose : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        aria-hidden="true"
      ></div>

      {/* Modal Content - Centered */}
      <div
        className={`modal-content relative w-full ${sizes[size]} transform overflow-hidden rounded-[20px] sm:rounded-[32px] border border-white/40 bg-white/95 text-left shadow-2xl transition-all flex flex-col backdrop-blur-xl`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'calc(100vh - 1rem)',
          height: size === 'full' ? 'calc(100vh - 1rem)' : 'auto'
        }}
      >
        {/* Header - Fixed height */}
        <div className={`flex items-center border-b border-slate-200 px-4 sm:px-8 py-3 sm:py-4 bg-white flex-shrink-0 ${showCloseButton ? 'justify-between' : 'justify-center'}`}>
          <h3 className="text-lg font-semibold text-slate-900 truncate pr-2">{title}</h3>
          {showCloseButton && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-200 flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="px-4 sm:px-8 py-4 sm:py-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}

