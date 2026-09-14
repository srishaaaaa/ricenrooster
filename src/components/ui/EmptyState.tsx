import type { ReactNode } from 'react'
import { cn } from './cn'

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F9FAFB] text-[#D6402E]">
        {icon}
      </div>
      <p className="text-[13px] font-black text-[#111111]">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[12px] font-medium text-[#6B7280]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
