import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-semibold text-slate-500">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm transition focus:outline-none ${
            error
              ? 'border-red-300 bg-white focus:border-red-300 focus:ring-2 focus:ring-red-200'
              : 'border-white/60 bg-white/80 shadow-inner focus:border-brand-200 focus:ring-2 focus:ring-brand-200'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

