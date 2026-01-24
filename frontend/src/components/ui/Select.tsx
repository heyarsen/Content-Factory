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
          className={`w-full rounded-2xl border px-3 sm:px-4 pr-10 py-2.5 sm:py-3 text-base sm:text-sm transition focus:outline-none appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236789a1' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")] bg-[length:16px_16px] bg-no-repeat bg-[right_0.85rem_center] ${error
              ? 'border-red-300 bg-white focus:border-red-400 focus:ring-2 focus:ring-red-200'
              : 'border-slate-300 bg-white shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-200'
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

