import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/80 px-8 py-12 text-center shadow-[0_25px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 shadow-inner">
        {icon || <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="text-xl font-semibold text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

