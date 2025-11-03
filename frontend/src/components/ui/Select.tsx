import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-semibold text-slate-500">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full rounded-2xl border px-4 py-3 text-sm transition focus:outline-none ${
            error
              ? 'border-red-300 bg-white focus:border-red-300 focus:ring-2 focus:ring-red-200'
              : 'border-white/60 bg-white/80 shadow-inner focus:border-brand-200 focus:ring-2 focus:ring-brand-200'
          } ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

