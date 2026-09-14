import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leftIcon?: ReactNode
  error?: string
  size?: 'sm' | 'md'
}

const SIZE_CLASSES = {
  sm: 'h-9 text-[12px]',
  md: 'h-11 lg:h-10 text-[13px]',
} as const

const BASE = 'w-full max-w-full box-border rounded-xl border bg-white px-3.5 font-bold text-[#111111] outline-none transition-colors placeholder:text-gray-400 placeholder:font-medium disabled:bg-gray-50 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leftIcon, error, size = 'md', className, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-xl">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            BASE,
            SIZE_CLASSES[size],
            leftIcon ? 'pl-9' : undefined,
            error
              ? 'border-red-300 focus:border-red-500'
              : 'border-[#FDDBB4]/60 focus:border-[#D6402E]',
            className,
          )}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-[11px] font-bold text-red-500">{error}</p>}
    </div>
  )
})
