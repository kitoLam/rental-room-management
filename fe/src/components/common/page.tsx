import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Container } from './container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from './error-state'
import { EmptyState } from './empty-state'
import { StatusBadge } from './status-badge'
import { cn } from '@/lib/utils'

export function Page({
  title,
  description,
  eyebrow,
  back,
  actions,
  children,
  narrow = false,
}: {
  title: string
  description?: string
  eyebrow?: string
  back?: string
  actions?: ReactNode
  children: ReactNode
  narrow?: boolean
}) {
  return (
    <Container className={cn('py-8 sm:py-12', narrow && 'max-w-3xl')}>
      {back && (
        <Link
          to={back}
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>
      )}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="text-page-title font-bold tracking-tight text-balance">{title}</h1>
          {description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </Container>
  )
}
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl bg-surface p-5 ring-1 ring-border/70 sm:p-7', className)}>
      {children}
    </section>
  )
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'success' | 'warning'
}) {
  return (
    <div
      role={tone === 'success' ? 'status' : 'note'}
      className={cn(
        'flex gap-3 rounded-lg p-4 text-sm leading-relaxed',
        tone === 'success'
          ? 'bg-primary-soft text-primary'
          : tone === 'warning'
            ? 'bg-warning/10 text-foreground'
            : 'bg-primary-soft text-foreground',
      )}
    >
      {tone === 'success' && <Check className="mt-0.5 size-4 shrink-0" />}
      {children}
    </div>
  )
}
export function InlineError({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="rounded-lg bg-danger/5 p-3 text-sm text-danger">
      {error instanceof Error ? error.message : 'Không thể thực hiện yêu cầu.'}
    </p>
  ) : null
}
export function QueryState({
  pending,
  error,
  retry,
  empty,
  emptyMessage = 'Bạn chưa có hoạt động nào ở đây. Khám phá phòng và bắt đầu khi sẵn sàng.',
  emptyAction,
  children,
}: {
  pending: boolean
  error: Error | null
  retry: () => unknown
  empty?: boolean
  emptyMessage?: string
  emptyAction?: ReactNode
  children?: ReactNode
}) {
  if (pending)
    return (
      <div aria-busy="true" aria-label="Đang tải" className="grid gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  if (error)
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          void retry()
        }}
      />
    )
  if (empty)
    return (
      <EmptyState
        icon={Search}
        title={emptyMessage}
        action={
          emptyAction !== undefined ? (
            emptyAction
          ) : (
            <Button asChild>
              <Link to="/rooms">
                Khám phá phòng
                <ArrowRight />
              </Link>
            </Button>
          )
        }
      />
    )
  return children
}
export function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string
  id: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {Children.map(children, (child) => {
        if (!isValidElement<HTMLAttributes<HTMLElement>>(child) || child.props.id !== id)
          return child
        return cloneElement(child, {
          'aria-invalid': error ? true : child.props['aria-invalid'],
          'aria-describedby':
            [child.props['aria-describedby'], hint ? `${id}-hint` : '', error ? `${id}-error` : '']
              .filter(Boolean)
              .join(' ') || undefined,
        })
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  if (totalPages < 2) return null
  return (
    <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-4">
      <Button
        variant="outline"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <span className="text-sm tabular-nums">
        Trang {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        aria-label="Trang sau"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}
const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã hoàn tất',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
  REQUESTED: 'Đã yêu cầu',
  AWAITING_PAYMENT: 'Chờ thanh toán',
  CONVERTED: 'Đã chuyển hợp đồng',
  EXPIRED: 'Đã hết hạn',
  VERIFIED: 'Đã xác minh',
  FAILED: 'Không thành công',
  REVIEW: 'Cần đối soát',
}
export function RecordStatus({ status }: { status: string }) {
  return (
    <StatusBadge
      tone={
        ['CONFIRMED', 'VERIFIED', 'COMPLETED', 'CONVERTED'].includes(status)
          ? 'success'
          : ['PENDING', 'REQUESTED', 'AWAITING_PAYMENT', 'REVIEW'].includes(status)
            ? 'warning'
            : ['FAILED', 'REJECTED'].includes(status)
              ? 'danger'
              : 'neutral'
      }
    >
      {statusLabels[status] || status}
    </StatusBadge>
  )
}
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  drawer = false,
}: {
  title: string
  description?: string
  open: boolean
  onOpenChange: (value: boolean) => void
  children: ReactNode
  drawer?: boolean
}) {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/50" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault()
              returnFocus.current.focus()
            }
          }}
          className={cn(
            'fixed z-50 max-h-[90dvh] overflow-y-auto bg-surface p-6 shadow-float outline-none',
            drawer
              ? 'inset-y-0 right-0 max-h-dvh w-full max-w-sm'
              : 'top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl',
          )}
        >
          <Dialog.Title className="pr-10 text-xl font-bold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description || 'Thông tin chi tiết và lựa chọn của bạn.'}
          </Dialog.Description>
          <Dialog.Close
            className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-lg hover:bg-background"
            aria-label="Đóng"
          >
            <X size={20} />
          </Dialog.Close>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function ConfirmAction({
  label,
  title,
  description,
  pending,
  onConfirm,
}: {
  label: string
  title: string
  description: string
  pending: boolean
  onConfirm: () => Promise<unknown>
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="text-danger">
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-6 shadow-float">
          <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={pending}>
                Giữ lại
              </Button>
            </Dialog.Close>
            <Button
              loading={pending}
              onClick={() => {
                void onConfirm().catch(() => undefined)
              }}
            >
              Xác nhận hủy
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
