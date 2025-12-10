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
  const handleClose = onClose || (() => {})
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
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 pb-8 sm:pt-28 sm:pb-10 px-4 lg:left-72 lg:top-16 lg:right-0 lg:bottom-0 lg:px-6"
      onClick={closeOnOverlayClick ? handleClose : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      ></div>

      {/* Modal Content - Centered */}
      <div
        className={`modal-content relative w-full ${sizes[size]} transform overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xl transition-all flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'calc(100vh - 10rem)'
        }}
      >
        {/* Header - Fixed height */}
        <div className={`flex items-center border-b border-slate-200 px-6 sm:px-8 py-4 bg-white flex-shrink-0 ${showCloseButton ? 'justify-between' : 'justify-center'}`}>
          <h3 className="text-lg font-semibold text-slate-900 truncate pr-2">{title}</h3>
          {showCloseButton && (
      <button
        onClick={handleClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-200 flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {/* Content - Scrollable */}
        <div className="px-6 sm:px-8 py-4 sm:py-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}

