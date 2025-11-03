interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info'
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100/80 text-slate-600',
    success: 'bg-emerald-100/80 text-emerald-600',
    error: 'bg-rose-100/80 text-rose-600',
    warning: 'bg-amber-100/80 text-amber-600',
    info: 'bg-sky-100/80 text-sky-600',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${variants[variant]} shadow-sm`}
    >
      {children}
    </span>
  )
}

