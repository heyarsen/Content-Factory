import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-semibold text-slate-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-2xl border text-sm transition-shadow duration-200 focus:outline-none ${
            error
              ? 'border-red-300 bg-white focus:border-red-300 focus:ring-2 focus:ring-red-200'
              : 'border-white/60 bg-white/80 shadow-inner focus:border-brand-200 focus:ring-2 focus:ring-brand-200'
          } px-4 py-3 ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

