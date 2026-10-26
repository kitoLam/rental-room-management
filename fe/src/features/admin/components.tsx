import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { SearchBox } from '@/features/manager/components'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { useAdminFilters } from './context'
import { statusNames } from './labels'
import { Modal } from '@/components/common/page'
import { useMediaQuery } from '@/hooks/use-media-query'
export function AdminStatus({ value }: { value: string }) {
  return (
    <StatusBadge
      tone={
        ['ACTIVE', 'APPROVED'].includes(value)
          ? 'success'
          : ['PENDING', 'PENDING_VERIFICATION', 'INVITED'].includes(value)
            ? 'warning'
            : ['LOCKED', 'REJECTED'].includes(value)
              ? 'danger'
              : 'neutral'
      }
    >
      {statusNames[value] || value}
    </StatusBadge>
  )
}
export function AdminPage({
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
            QUẢN TRỊ HỆ THỐNG
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
export function AdminLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
      to={to}
    >
      {children}
    </Link>
  )
}
export function AdminFilters({
  state,
  statuses = [],
  dates = false,
  children,
  search = true,
}: {
  state: ReturnType<typeof useAdminFilters>
  statuses?: string[]
  dates?: boolean
  children?: ReactNode
  search?: boolean
}) {
  const desktop = useMediaQuery('(min-width: 768px)'),
    [open, setOpen] = useState(false)
  const controls = (
    <>
      {statuses.length > 0 && (
        <select
          aria-label="Lọc trạng thái"
          className="input w-auto max-w-full"
          value={state.filters.status || ''}
          onChange={(e) => state.change('status', e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusNames[s] || s}
            </option>
          ))}
        </select>
      )}
      {dates && (
        <>
          <input
            className="input w-auto max-w-full"
            type="date"
            aria-label="Từ ngày"
            value={state.filters.from || ''}
            onChange={(e) => state.change('from', e.target.value)}
          />
          <input
            className="input w-auto max-w-full"
            type="date"
            aria-label="Đến ngày"
            value={state.filters.to || ''}
            onChange={(e) => state.change('to', e.target.value)}
          />
        </>
      )}
      {children}
      <select
        aria-label="Số dòng mỗi trang"
        className="input w-auto"
        value={state.filters.size}
        onChange={(e) => state.change('size', e.target.value)}
      >
        {[8, 20, 50].map((n) => (
          <option key={n} value={n}>
            {n} dòng
          </option>
        ))}
      </select>
      <Button variant="ghost" onClick={state.clear}>
        Xóa bộ lọc
      </Button>
    </>
  )
  return (
    <div className="flex flex-wrap items-center gap-3">
      {search && (
        <SearchBox
          value={state.filters.q}
          onChange={(v) => state.change('q', v)}
          placeholder="Tìm tên, liên hệ hoặc mã…"
        />
      )}
      {desktop ? (
        controls
      ) : (
        <>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Bộ lọc
          </Button>
          <Modal title="Bộ lọc danh sách" open={open} onOpenChange={setOpen} drawer>
            <div className="grid gap-5">
              {controls}
              <Button onClick={() => setOpen(false)}>Xem kết quả</Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  )
}
