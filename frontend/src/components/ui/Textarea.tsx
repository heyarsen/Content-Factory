import { TextareaHTMLAttributes, forwardRef, useId } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, name, ...props }, ref) => {
    const generatedId = useId()
    // Use provided id, or generate one if label exists, or undefined if no label
    const finalId = id || (label ? `textarea-${generatedId}` : undefined)
    // Use provided name, or derive from id, or undefined
    const finalName = name || (finalId ? finalId : undefined)

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
        <textarea
          ref={ref}
          id={finalId}
          name={finalName}
          className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm transition focus:outline-none ${
            error
              ? 'border-red-300 bg-white focus:border-red-400 focus:ring-2 focus:ring-red-200'
              : 'border-slate-300 bg-white shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-200'
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

