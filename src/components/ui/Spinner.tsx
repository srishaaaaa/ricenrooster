import { cn } from './cn'

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-4',
} as const

type SpinnerProps = {
  size?: keyof typeof SIZES
  className?: string
  /** Use on dark backgrounds (e.g. inside a primary button) */
  inverted?: boolean
}

export function Spinner({ size = 'md', className, inverted = false }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full',
        inverted
          ? 'border-white/30 border-t-white'
          : 'border-[#FDDBB4] border-t-[#D6402E]',
        SIZES[size],
        className,
      )}
    />
  )
}
