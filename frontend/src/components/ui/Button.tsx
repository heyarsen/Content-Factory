import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  className = '',
  disabled,
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]'
  
  const variants = {
    primary:
      'bg-gradient-to-r from-brand-500 via-brand-500 to-brand-600 text-white shadow-[0_18px_35px_-18px_rgba(79,70,229,0.8)] hover:from-brand-500 hover:via-brand-500 hover:to-brand-500 active:scale-[0.99]',
    secondary:
      'border border-slate-200 bg-white/80 text-primary shadow-sm hover:border-brand-200 hover:text-brand-600 hover:shadow-md active:scale-[0.99]',
    danger:
      'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_18px_35px_-18px_rgba(220,38,38,0.6)] hover:from-red-500 hover:to-red-500 active:scale-[0.99]',
    ghost:
      'border border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white/80 hover:text-primary active:scale-[0.99] shadow-none',
  }
  
  const sizes = {
    sm: 'px-3.5 py-2 text-xs min-h-[44px] min-w-[44px] touch-manipulation',
    md: 'px-5 py-2.5 text-sm min-h-[44px] min-w-[44px] touch-manipulation',
    lg: 'px-7 py-3 text-base min-h-[44px] min-w-[44px] touch-manipulation',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="-ml-1 mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && leftIcon && <span className="-ml-1 mr-2 inline-flex h-4 w-4 items-center justify-center">{leftIcon}</span>}
      <span className="inline-flex items-center gap-2">{children}</span>
      {!loading && rightIcon && <span className="ml-2 inline-flex h-4 w-4 items-center justify-center">{rightIcon}</span>}
    </button>
  )
}

