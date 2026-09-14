import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import type { ButtonVariant } from './Button'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#141414] border border-[#E2503B] text-[#E2503B] hover:bg-black',
  secondary: 'bg-white border border-[#FDDBB4]/60 text-[#374151] hover:bg-[#F9FAFB]',
  danger: 'bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 hover:text-red-600',
  ghost: 'bg-transparent border border-transparent text-[#374151] hover:bg-gray-100',
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-lg',
  lg: 'h-11 w-11 rounded-xl',
} as const

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: keyof typeof SIZE_CLASSES
  icon: ReactNode
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', icon, label, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})
