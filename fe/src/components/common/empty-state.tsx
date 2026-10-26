import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  className?: string
}

/** Trang trống: một câu và một nút hành động (brief mục 4). */
export function EmptyState({ icon: Icon, title, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  )
}
