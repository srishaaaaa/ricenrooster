import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#111111] outline-none transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium disabled:bg-gray-50 disabled:opacity-60',
          error
            ? 'border-red-300 focus:border-red-500'
            : 'border-[#FDDBB4]/60 focus:border-[#D6402E]',
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1 text-[11px] font-bold text-red-500">{error}</p>}
    </div>
  )
})
