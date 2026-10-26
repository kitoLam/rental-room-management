import type { ReactNode } from 'react'
import type { useOwnerFilters } from './context'
import { SearchBox } from '@/features/manager/components'
import { formatVnd } from '@/lib/format'
export function OwnerPage({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            CHỦ TRỌ / TROPRO
          </p>
          <h1 className="text-page-title font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      <div className="grid min-w-0 gap-6">{children}</div>
    </div>
  )
}
export function OwnerFilters({
  state,
  statuses = [],
  period = false,
  children,
}: {
  state: ReturnType<typeof useOwnerFilters>
  statuses?: { value: string; label: string }[]
  period?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <SearchBox
        value={state.filters.q}
        onChange={(v) => state.change('q', v)}
        placeholder="Tìm trong phạm vi hiện tại…"
      />
      {statuses.length > 0 && (
        <select
          aria-label="Lọc trạng thái"
          className="input w-auto max-w-full"
          value={state.filters.status}
          onChange={(e) => state.change('status', e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {statuses.map((s) => (
            <option value={s.value} key={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      {period && (
        <input
          aria-label="Kỳ báo cáo"
          type="month"
          className="input w-auto max-w-full"
          value={state.filters.month || ''}
          onChange={(e) => state.change('month', e.target.value)}
        />
      )}
      {children}
    </div>
  )
}
export function MoneyStats({ items }: { items: [string, number][] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 bg-surface p-5">
          <p className="mb-3 text-xs leading-5 text-muted-foreground">{label}</p>
          <p className="break-words text-xl font-bold tracking-tight tabular-nums">
            {formatVnd(value)}
          </p>
        </div>
      ))}
    </div>
  )
}
