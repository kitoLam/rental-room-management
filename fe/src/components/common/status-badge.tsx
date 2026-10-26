import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneClass: Record<StatusTone, { wrap: string; dot: string }> = {
  success: { wrap: 'bg-success/10', dot: 'bg-success' },
  warning: { wrap: 'bg-warning/10', dot: 'bg-warning' },
  danger: { wrap: 'bg-danger/10', dot: 'bg-danger' },
  info: { wrap: 'bg-info/10', dot: 'bg-info' },
  neutral: { wrap: 'bg-border/60', dot: 'bg-muted-foreground' },
}

type StatusBadgeProps = {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}

/**
 * Huy hiệu trạng thái dùng chung toàn app (brief mục 3).
 * Chữ luôn màu chữ chính để đạt tương phản AA; màu trạng thái nằm ở chấm tròn và nền nhạt.
 */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  const t = toneClass[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-foreground',
        t.wrap,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden="true" />
      {children}
    </span>
  )
}
