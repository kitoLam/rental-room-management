import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type ChartBarProps = {
  value: number
  max: number
  vertical?: boolean
  className?: string
  title?: string
}

export function ChartBar({ value, max, vertical = false, className, title }: ChartBarProps) {
  const ratio = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  // Only runtime data is passed here; visual rules live in src/index.css.
  const variables = { '--chart-value': `${ratio}%` } as CSSProperties
  return (
    <div
      className={cn(
        'chart-bar',
        vertical ? 'chart-bar--vertical' : 'chart-bar--horizontal',
        className,
      )}
      data-empty={value <= 0}
      style={variables}
      title={title}
    />
  )
}
