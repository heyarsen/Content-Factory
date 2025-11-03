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
    xl: 'max-w-4xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div className="flex min-h-screen items-center justify-center px-4 pt-6 pb-10 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        ></div>

        <div
          className={`inline-block w-full transform overflow-hidden rounded-3xl border border-white/60 bg-white/90 text-left align-bottom shadow-[0_45px_95px_-55px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-all sm:my-12 sm:align-middle ${sizes[size]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/60 px-8 py-5">
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100/70 hover:text-primary">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

