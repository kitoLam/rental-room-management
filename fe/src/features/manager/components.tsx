import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowUpRight, Upload, X, Search } from 'lucide-react'
import {
  Page,
  Panel,
  Field,
  InlineError,
  Modal,
  Pagination,
  QueryState,
} from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { tenantStatusLabel } from '@/features/tenant/status'
import { imageAttachment } from '@/features/tenant/attachments'
import { useManager, managerLink, useManagerList } from './context'
import type { Page as PageData } from '@/interfaces/domain'
export function ManagerPage({
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
            VẬN HÀNH CHI NHÁNH
          </p>
          <h1 className="text-page-title font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-6">{children}</div>
    </div>
  )
}
export function ManagerLink({
  to,
  children,
  button = false,
  params = {},
}: {
  to: string
  children: ReactNode
  button?: boolean
  params?: Record<string, string>
}) {
  const { branch } = useManager()
  const link = (
    <Link
      to={managerLink(to, branch.id, params)}
      className={
        button
          ? undefined
          : 'inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary hover:underline'
      }
    >
      {children}
      {!button && <ArrowUpRight size={15} />}
    </Link>
  )
  return button ? <Button asChild>{link}</Button> : link
}
const labels: Record<string, string> = {
  AVAILABLE: 'Có thể thuê',
  OCCUPIED: 'Đang ở',
  HELD: 'Đang giữ',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng hoạt động',
  REQUESTED: 'Chờ duyệt',
  AWAITING_PAYMENT: 'Chờ tiền giữ',
  CONFIRMED: 'Đã xác nhận',
  CONVERTED: 'Đã tạo hợp đồng',
  EXPIRED: 'Hết hạn',
  FINALIZED: 'Đã chốt',
}
export function ManagerStatus({ value }: { value: string }) {
  return (
    <StatusBadge
      tone={
        ['ACTIVE', 'APPROVED', 'VERIFIED', 'CONFIRMED', 'FINALIZED', 'PAID', 'COMPLETED'].includes(
          value,
        )
          ? 'success'
          : ['PENDING', 'REVIEW', 'HELD', 'OPEN', 'AWAITING_PAYMENT', 'CANCEL_REQUESTED'].includes(
                value,
              )
            ? 'warning'
            : ['REJECTED', 'FAILED', 'OVERDUE'].includes(value)
              ? 'danger'
              : 'neutral'
      }
    >
      {labels[value] || tenantStatusLabel(value)}
    </StatusBadge>
  )
}
export type Column<T> = { label: string; render: (row: T) => ReactNode; mobile?: boolean }
export function Records<T extends { id: string }>({
  query,
  columns,
  page,
  onPage,
  empty = 'Chưa có dữ liệu phù hợp.',
}: {
  query: { isPending: boolean; error: Error | null; refetch: () => unknown; data?: PageData<T> }
  columns: Column<T>[]
  page: number
  onPage: (page: number) => void
  empty?: string
}) {
  return (
    <QueryState
      pending={query.isPending}
      error={query.error}
      retry={query.refetch}
      empty={query.data?.content.length === 0}
      emptyMessage={empty}
      emptyAction={null}
    >
      {query.data && (
        <>
          <Panel className="min-w-0 p-0 sm:p-0">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-background/70">
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c.label}
                        scope="col"
                        className="px-5 py-4 text-xs font-bold text-muted-foreground"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {query.data.content.map((row) => (
                    <tr key={row.id}>
                      {columns.map((c) => (
                        <td key={c.label} className="max-w-sm px-5 py-4 align-top leading-6">
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {query.data.content.map((row) => (
                <article key={row.id} className="grid min-w-0 gap-3 p-5">
                  {columns
                    .filter((c) => c.mobile !== false)
                    .map((c, index) => (
                      <div key={c.label} className="min-w-0">
                        {index > 0 && (
                          <p className="mb-1 text-xs text-muted-foreground">{c.label}</p>
                        )}
                        <div
                          className={index === 0 ? 'min-w-0 text-sm font-bold' : 'min-w-0 text-sm'}
                        >
                          {c.render(row)}
                        </div>
                      </div>
                    ))}
                </article>
              ))}
            </div>
          </Panel>
          <p className="text-xs text-muted-foreground">{query.data.totalElements} kết quả</p>
          <Pagination page={page} totalPages={query.data.totalPages} onPage={onPage} />
        </>
      )}
    </QueryState>
  )
}
export function SearchBox({
  value,
  onChange,
  placeholder = 'Tìm theo mã hoặc tên…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative min-w-48 max-w-full flex-1">
      <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
      <input
        className="input pl-10"
        aria-label="Tìm kiếm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
export type FieldSpec = {
  name: string
  label: string
  kind?: 'text' | 'number' | 'date' | 'month' | 'textarea' | 'select' | 'check' | 'list'
  options?: { value: string; label: string }[]
  nullable?: boolean
  hint?: string
  readOnly?: boolean
  min?: number
  step?: number
}
export function ScopeFilters({
  value,
  onChange,
  tenant = false,
  dates = false,
}: {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  tenant?: boolean
  dates?: boolean
}) {
  const rooms = useManagerList('rooms', { size: '100' }),
    tenants = useManagerList('tenants', { size: '100' })
  return (
    <div className="flex flex-wrap gap-3">
      <select
        aria-label="Lọc theo phòng"
        className="input w-auto max-w-full"
        value={value.roomId || ''}
        onChange={(e) => onChange({ ...value, roomId: e.target.value, contractTenantId: '' })}
      >
        <option value="">Tất cả phòng</option>
        {rooms.data?.content.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code} · {r.title}
          </option>
        ))}
      </select>
      {tenant && (
        <select
          aria-label="Lọc theo người thuê"
          className="input w-auto max-w-full"
          value={value.contractTenantId || ''}
          onChange={(e) => onChange({ ...value, contractTenantId: e.target.value })}
        >
          <option value="">Tất cả người thuê</option>
          {tenants.data?.content
            .filter((t) => !value.roomId || t.roomId === value.roomId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.userName} · {t.slotName || t.roomName}
              </option>
            ))}
        </select>
      )}
      {'month' in value && (
        <input
          aria-label="Lọc theo tháng"
          className="input w-auto"
          type="month"
          value={value.month || ''}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
        />
      )}
      {dates && (
        <>
          <input
            className="input w-auto"
            type="date"
            aria-label="Lọc từ ngày"
            value={value.from || ''}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <input
            className="input w-auto"
            type="date"
            aria-label="Lọc đến ngày"
            value={value.to || ''}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
      )}
      <InlineError error={rooms.error || tenants.error} />
    </div>
  )
}
export function ManagerForm({
  schema,
  defaults,
  fields,
  onSubmit,
  pending,
  error,
  submitLabel = 'Lưu thông tin',
  children,
}: {
  schema: z.ZodType
  defaults: Record<string, unknown>
  fields: FieldSpec[]
  onSubmit: (data: Record<string, unknown>) => void
  pending: boolean
  error: unknown
  submitLabel?: string
  children?: ReactNode
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [
        key,
        fields.find((f) => f.name === key)?.kind === 'list' && Array.isArray(value)
          ? value.join('\n')
          : value,
      ]),
    ),
  })
  return (
    <form
      className="grid min-w-0 grid-cols-1 gap-5"
      noValidate
      onSubmit={form.handleSubmit((raw) => {
        const value = { ...raw }
        for (const f of fields) {
          if (f.kind === 'number')
            value[f.name] =
              value[f.name] === '' || value[f.name] == null ? (f.nullable ? null : NaN) : Number(value[f.name])
          if (f.kind === 'list')
            value[f.name] = String(value[f.name] || '')
              .split(/\n|,/)
              .map((v) => v.trim())
              .filter(Boolean)
          if (f.nullable && value[f.name] === '') value[f.name] = null
        }
        const parsed = schema.safeParse(value)
        if (!parsed.success) {
          form.clearErrors()
          for (const issue of parsed.error.issues) {
            const name = issue.path[0]
            if (typeof name === 'string')
              form.setError(name, {
                message: 'Kiểm tra giá trị, định dạng hoặc độ dài của mục này.',
              })
          }
          return
        }
        form.clearErrors()
        onSubmit(parsed.data as Record<string, unknown>)
      })}
    >
      {fields.map((f) => {
        const error = form.formState.errors[f.name]?.message as string | undefined,
          id = `manager-${f.name}`
        if (f.kind === 'check')
          return (
            <div key={f.name}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  {...form.register(f.name)}
                  disabled={pending || f.readOnly}
                />
                {f.label}
              </label>
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
            </div>
          )
        return (
          <Field key={f.name} id={id} label={f.label} error={error} hint={f.hint}>
            {f.kind === 'select' ? (
              <select
                id={id}
                className="input"
                disabled={pending || f.readOnly}
                {...form.register(f.name)}
              >
                <option value="">Chọn…</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.kind === 'textarea' || f.kind === 'list' ? (
              <textarea
                id={id}
                className="input min-h-24"
                readOnly={f.readOnly}
                disabled={pending}
                {...form.register(f.name)}
              />
            ) : (
              <input
                id={id}
                className="input"
                type={
                  f.kind === 'number'
                    ? 'number'
                    : f.kind === 'date'
                      ? 'date'
                      : f.kind === 'month'
                        ? 'month'
                        : 'text'
                }
                inputMode={f.kind === 'number' ? 'decimal' : undefined}
                min={f.min}
                step={f.step ?? 1}
                readOnly={f.readOnly}
                disabled={pending}
                {...form.register(f.name)}
              />
            )}
          </Field>
        )
      })}
      {children}
      <InlineError error={error} />
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
export function ImagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null),
    [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(false)
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <p className="text-sm font-bold">Ảnh minh chứng</p>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        multiple
        aria-label="Tải ảnh minh chứng"
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          e.target.value = ''
          if (value.length + files.length > 3) {
            setError(new Error('Tối đa 3 ảnh.'))
            return
          }
          setLoading(true)
          setError(null)
          try {
            const images = await Promise.all(files.map(imageAttachment))
            onChange([...value, ...images.map((a) => a.url)])
          } catch (err) {
            setError(err instanceof Error ? err : new Error('Không đọc được ảnh.'))
          } finally {
            setLoading(false)
          }
        }}
      />
      <div>
        <Button
          type="button"
          variant="outline"
          loading={loading}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          Chọn ảnh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPG hoặc WebP · tối đa 3 ảnh · 1 MB mỗi ảnh
      </p>
      <div className="grid grid-cols-3 gap-3">
        {value.map((url, n) => (
          <div key={`${url.slice(0, 40)}-${n}`} className="relative min-w-0">
            <img
              src={url}
              alt={`Ảnh minh chứng ${n + 1}`}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="absolute top-1 right-1 bg-surface"
              aria-label={`Xóa ảnh ${n + 1}`}
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== n))}
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>
      <InlineError error={error} />
    </div>
  )
}
export function ActionDialog({
  title,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
  children,
  fields = [],
  defaults = {},
}: {
  title: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (data: Record<string, unknown>) => void
  pending: boolean
  error: unknown
  children?: ReactNode
  fields?: FieldSpec[]
  defaults?: Record<string, unknown>
}) {
  const all = [...fields, { name: 'reason', label: 'Lý do / ghi chú', kind: 'textarea' as const }],
    shape = Object.fromEntries(
      all.map((f) => [
        f.name,
        f.kind === 'number'
          ? z.number().int().nonnegative()
          : z
              .string()
              .trim()
              .min(f.name === 'reason' ? 10 : 1),
      ]),
    )
  return (
    <Modal
      title={title}
      open={open}
      onOpenChange={(v) => {
        if (!pending) onOpenChange(v)
      }}
      description="Kiểm tra đúng chi nhánh và hồ sơ trước khi xác nhận."
    >
      <ManagerForm
        schema={z.object(shape)}
        fields={all}
        defaults={{ reason: '', ...defaults }}
        onSubmit={onConfirm}
        pending={pending}
        error={error}
        submitLabel="Xác nhận"
      >
        {children}
      </ManagerForm>
    </Modal>
  )
}
export function ManagerAccessPage({ message }: { message: string }) {
  return (
    <Page title="Quyền quản lý chi nhánh">
      <Panel>
        <p className="text-sm leading-7">{message}</p>
        <Button asChild className="mt-5">
          <Link to="/user/dashboard">Về tài khoản</Link>
        </Button>
      </Panel>
    </Page>
  )
}
