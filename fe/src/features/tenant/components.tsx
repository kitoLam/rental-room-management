import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { useTenant, tenantLink } from './context'

import { tenantStatusLabel } from './status'
export function TenantStatus({ value }: { value: string }) {
  return (
    <StatusBadge
      tone={
        ['ACTIVE', 'PAID', 'VERIFIED', 'APPROVED', 'COMPLETED'].includes(value)
          ? 'success'
          : ['PENDING', 'PARTIAL', 'REVIEW', 'CANCEL_REQUESTED', 'OPEN', 'IN_PROGRESS'].includes(
                value,
              )
            ? 'warning'
            : ['OVERDUE', 'FAILED', 'REJECTED', 'URGENT'].includes(value)
              ? 'danger'
              : 'neutral'
      }
    >
      {tenantStatusLabel(value)}
    </StatusBadge>
  )
}
export function TenantPage({
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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            KHÔNG GIAN CỦA BẠN
          </p>
          <h1 className="text-page-title font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-6">{children}</div>
    </div>
  )
}
export function TenantLink({
  to,
  children,
  button = false,
}: {
  to: string
  children: ReactNode
  button?: boolean
}) {
  const { tenancy } = useTenant()
  const link = (
    <Link
      to={tenantLink(to, tenancy)}
      className={
        button
          ? undefined
          : 'inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline'
      }
    >
      {children}
      {!button && <ArrowUpRight size={15} />}
    </Link>
  )
  return button ? <Button asChild>{link}</Button> : link
}
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-words text-sm font-bold leading-6">
            {value ?? 'Chưa có thông tin'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
export function EmptyRows({
  children = 'Chưa có dữ liệu trong kỳ này.',
}: {
  children?: ReactNode
}) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}
