import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-200 ${
        hover ? 'hover:-translate-y-1 hover:shadow-[0_25px_65px_-30px_rgba(99,102,241,0.35)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

