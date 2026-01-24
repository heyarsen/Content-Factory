import { InputHTMLAttributes, forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, name, ...props }, ref) => {
    const generatedId = useId()
    // Use provided id, or generate one if label exists, or undefined if no label
    const finalId = id || (label ? `input-${generatedId}` : undefined)
    // Use provided name, or derive from id/autocomplete, or undefined
    const finalName = name || (finalId ? finalId : (props.autoComplete || undefined))

    return (
      <div className="w-full">
        {label && finalId && (
          <label
            htmlFor={finalId}
            className="mb-2 block text-sm font-semibold text-slate-500"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={finalId}
          name={finalName}
          className={`w-full rounded-2xl border text-base sm:text-sm transition-shadow duration-200 focus:outline-none ${error
              ? 'border-red-300 bg-white focus:border-red-400 focus:ring-2 focus:ring-red-200'
              : 'border-slate-300 bg-white shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-200'
            } px-3 sm:px-4 py-2.5 sm:py-3 ${className}`}
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

