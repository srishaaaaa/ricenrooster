import type { ReactNode } from 'react'
import { cn } from './cn'

export type StatAccent = 'gold' | 'green' | 'red' | 'blue' | 'violet' | 'amber'

const ACCENT_CLASSES: Record<StatAccent, string> = {
  gold: 'bg-[#FFF8E8] text-[#D6402E]',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-orange-50 text-orange-600',
}

export interface StatCardProps {
  label: string
  value: ReactNode
  icon: ReactNode
  accent?: StatAccent
  className?: string
}

export function StatCard({ label, value, icon, accent = 'gold', className }: StatCardProps) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border border-[#FDDBB4]/40 bg-white p-4 shadow-sm', className)}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ACCENT_CLASSES[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-wider text-[#6B7280]">{label}</p>
        <p className="truncate text-lg font-black text-[#111111]">{value}</p>
      </div>
    </div>
  )
}

export function StatCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3', className)}>
      {children}
    </div>
  )
}
