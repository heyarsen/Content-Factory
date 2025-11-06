import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
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
  }

  return (
    <div
      className="fixed inset-0 z-[9999] p-4"
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        aria-hidden="true"
      ></div>

      {/* Modal Content - Centered accounting for sidebar on desktop */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-[calc(18rem+(100%-18rem)/2)] lg:translate-x-[-50%] w-full max-w-full ${sizes[size]} transform overflow-hidden rounded-3xl border border-white/60 bg-white/95 text-left shadow-[0_45px_95px_-55px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/60 px-8 py-5 bg-gradient-to-r from-white to-slate-50/50">
          <h3 className="text-xl font-semibold text-primary">{title}</h3>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100/70 hover:text-primary focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-8 py-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

