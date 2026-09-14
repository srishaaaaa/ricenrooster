import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#141414] border border-[#E2503B] text-[#E2503B] hover:bg-black active:scale-[0.98]',
  secondary: 'bg-white border border-[#FDDBB4]/60 text-[#374151] hover:bg-[#F9FAFB] active:scale-[0.98]',
  danger: 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 active:scale-[0.98]',
  ghost: 'bg-transparent border border-transparent text-[#374151] hover:bg-gray-100 active:scale-[0.98]',
}

// h-11 (44px) on mobile/tablet for touch targets, stepping down to the
// requested 38-42px on desktop where pointer precision is higher.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[12px] gap-1.5 rounded-lg',
  md: 'h-11 lg:h-10 px-4 text-[13px] gap-2 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, iconLeft, iconRight, fullWidth, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 font-black uppercase tracking-wide transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" inverted={variant === 'primary'} />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  )
})
