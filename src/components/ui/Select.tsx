import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  error?: string
  size?: 'sm' | 'md'
}

const SIZE_CLASSES = {
  sm: 'h-9 text-[12px] pl-3 pr-7',
  md: 'h-11 lg:h-10 text-[13px] pl-3.5 pr-9',
} as const

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'w-full appearance-none rounded-xl border bg-white font-bold text-[#111111] outline-none transition-colors disabled:bg-gray-50 disabled:opacity-60',
            SIZE_CLASSES[size],
            error
              ? 'border-red-300 focus:border-red-500'
              : 'border-[#FDDBB4]/60 focus:border-[#D6402E]',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#374151]" />
      </div>
      {error && <p className="mt-1 text-[11px] font-bold text-red-500">{error}</p>}
    </div>
  )
})
