import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, QueryState, Field, InlineError, Modal, Notice } from '@/components/common/page'
import { TenantPage, TenantStatus, TenantLink, Facts, EmptyRows } from './components'
import { useTenant, useTenantQuery, useTenantMutation, isActive } from './context'
import { tenantApi } from '@/services/tenant'
import { formatVnd } from '@/lib/format'
import { dateOnly, dateTime } from '@/lib/activity'
import {
  serviceInputSchema,
  proposalInputSchema,
  type TenantService,
  type UtilityCharge,
  type AllocationProposal,
} from '@/interfaces/tenant'
import { allocateVnd } from '@/lib/tenant-finance'

function RegisterService({
  service: s,
  onSuccess,
}: {
  service: TenantService
  onSuccess: () => void
}) {
  const { tenancy: t } = useTenant(),
    form = useForm<z.infer<typeof serviceInputSchema>>({
      resolver: zodResolver(serviceInputSchema),
      defaultValues: {
        serviceId: s.id,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: t.endDate,
        note: '',
      },
    }),
    mutation = useTenantMutation(tenantApi.registerService, onSuccess)
  return (
    <form
      className="grid min-w-0 grid-cols-1 gap-5"
      onSubmit={form.handleSubmit((value) => mutation.mutate(value))}
    >
      <Notice>Đăng ký cần quản lý duyệt trước khi sử dụng.</Notice>
      <Facts
        items={[
          ['Dịch vụ', s.name],
          ['Đơn giá hiện tại', `${formatVnd(s.unitPrice)} / ${s.unit}`],
        ]}
      />
      <Field
        id="service-start"
        label="Bắt đầu sử dụng"
        error={form.formState.errors.startDate?.message}
      >
        <input
          id="service-start"
          type="date"
          className="input"
          min={new Date().toISOString().slice(0, 10)}
          max={t.endDate}
          {...form.register('startDate')}
        />
      </Field>
      <Field
        id="service-end"
        label="Kết thúc (không gồm ngày này)"
        error={form.formState.errors.endDate?.message}
      >
        <input
          id="service-end"
          type="date"
          className="input"
          min={t.startDate}
          max={t.endDate}
          {...form.register('endDate')}
        />
      </Field>
      <Field id="service-note" label="Ghi chú" error={form.formState.errors.note?.message}>
        <textarea id="service-note" className="input min-h-24" {...form.register('note')} />
      </Field>
      <InlineError error={mutation.error} />
      <Button type="submit" loading={mutation.isPending} disabled={!isActive(t)}>
        Gửi đăng ký
      </Button>
    </form>
  )
}
export function ServicesPage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('services', tenantApi.services, [], true),
    [selected, setSelected] = useState<TenantService | null>(null),
    [success, setSuccess] = useState('')
  const cancel = useTenantMutation(tenantApi.cancelService, () => {
    setSelected(null)
    setSuccess('Đã gửi yêu cầu hủy. Dịch vụ chỉ ngừng sau khi quản lý duyệt.')
  })
  const current = query.data?.find((s) => s.id === selected?.id)
  return (
    <TenantPage
      title="Dịch vụ phòng"
      description="Điện, nước luôn có sẵn. Dịch vụ bổ sung được quản lý duyệt riêng."
    >
      {success && <Notice tone="success">{success}</Notice>}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.length === 0}
        emptyMessage="Chưa có dịch vụ được cung cấp cho phòng."
        emptyAction={null}
      >
        <Panel>
          {query.data?.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0"
            >
              <div>
                <h2 className="text-sm font-bold">{s.name}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatVnd(s.unitPrice)} / {s.unit} · {s.mandatory ? 'Bắt buộc' : 'Tùy chọn'}
                </p>
                {s.startDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateOnly(s.startDate)} – {dateOnly(s.endDate!)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {s.status && <TenantStatus value={s.status} />}
                <Button
                  variant="outline"
                  disabled={!isActive(t) && !s.subscriptionId}
                  onClick={() => {
                    cancel.reset()
                    setSelected(s)
                  }}
                >
                  {!s.subscriptionId || ['REJECTED', 'CANCELLED'].includes(s.status || '')
                    ? 'Đăng ký'
                    : 'Chi tiết'}
                </Button>
              </div>
            </div>
          ))}
        </Panel>
      </QueryState>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
        title={selected?.name || 'Dịch vụ'}
      >
        {current &&
          ((!current.subscriptionId || ['REJECTED', 'CANCELLED'].includes(current.status || '')) &&
          !current.mandatory ? (
            <RegisterService
              service={current}
              onSuccess={() => {
                setSelected(null)
                setSuccess('Đã gửi đăng ký dịch vụ, đang chờ quản lý duyệt.')
              }}
            />
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-5">
              <Facts
                items={[
                  ['Đơn giá', `${formatVnd(current.unitPrice)} / ${current.unit}`],
                  ['Trạng thái', current.status ? <TenantStatus value={current.status} /> : null],
                  ['Bắt đầu', current.startDate ? dateOnly(current.startDate) : null],
                  ['Kết thúc', current.endDate ? dateOnly(current.endDate) : null],
                ]}
              />
              {current.mandatory ? (
                <Notice>Điện và nước là dịch vụ bắt buộc, không thể hủy.</Notice>
              ) : (
                <>
                  <InlineError error={cancel.error} />
                  <Button
                    variant="outline"
                    loading={cancel.isPending}
                    disabled={!isActive(t) || current.status !== 'APPROVED'}
                    onClick={() => cancel.mutate(current.id)}
                  >
                    Yêu cầu ngừng dịch vụ
                  </Button>
                </>
              )}
              <h3 className="font-bold">Lịch sử xử lý</h3>
              {current.history.length ? (
                current.history.map((h, i) => (
                  <div key={i} className="border-l-2 border-border pl-4 text-sm">
                    <TenantStatus value={h.status} />
                    <p className="mt-2 leading-6 text-muted-foreground">{h.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateTime(h.at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Được cung cấp theo hợp đồng thuê.</p>
              )}
            </div>
          ))}
      </Modal>
    </TenantPage>
  )
}
export function UtilitiesPage() {
  const query = useTenantQuery('utilities', tenantApi.utilities),
    [month, setMonth] = useState(''),
    [selected, setSelected] = useState<UtilityCharge | null>(null)
  const rows = query.data?.filter((c) => !month || c.billingMonth.startsWith(month)) || []
  return (
    <TenantPage
      title="Điện & nước"
      description="Số liệu chốt kỳ, từng đoạn tính phí và phần được phân bổ cho bạn."
      actions={<TenantLink to="/tenant/utilities/allocations">Đề xuất phân bổ</TenantLink>}
    >
      <Field label="Tháng / năm" id="utility-month">
        <input
          className="input max-w-xs"
          id="utility-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có khoản phí trong kỳ này."
        emptyAction={null}
      >
        <Panel>
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0"
            >
              <div>
                <h2 className="text-sm font-bold">
                  {c.name} · Kỳ {c.billingMonth.slice(0, 7)}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {dateOnly(c.startDate)} – {dateOnly(c.endDate)} · {c.segments.length} đoạn tính
                  phí
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tổng phí phòng: {formatVnd(c.totalAmount)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Phần của bạn</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">{formatVnd(c.myAmount)}</p>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Chi tiết ${c.name}`}
                  onClick={() => setSelected(c)}
                >
                  <ArrowRight size={17} />
                </Button>
              </div>
            </div>
          ))}
        </Panel>
      </QueryState>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
        title={selected ? `Chi tiết phí ${selected.name}` : 'Chi tiết phí'}
      >
        {selected && <ChargeDetail charge={selected} />}
      </Modal>
    </TenantPage>
  )
}
function ChargeDetail({ charge: c }: { charge: UtilityCharge }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <Facts
        items={[
          ['Kỳ phí', `${dateOnly(c.startDate)} – ${dateOnly(c.endDate)}`],
          ['Tổng phí phòng', formatVnd(c.totalAmount)],
          ['Phần của bạn', formatVnd(c.myAmount)],
        ]}
      />
      {c.segments.map((s) => (
        <div key={s.id} className="rounded-lg bg-background p-4">
          <p className="text-sm font-bold">
            {dateOnly(s.startDate)} – {dateOnly(s.endDate)}
          </p>
          <p className="mt-2 text-sm">
            {s.previousReading !== null && s.currentReading !== null
              ? `${s.previousReading} → ${s.currentReading} · `
              : ''}
            {s.quantity} {s.unit} × {formatVnd(s.unitPrice)} = {formatVnd(s.amount)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{s.reason}</p>
        </div>
      ))}
      <p className="text-xs leading-6 text-muted-foreground">{c.snapshot}</p>
      <div className="grid grid-cols-3 gap-2">
        {c.evidence.map((src) => (
          <a key={src} href={src} target="_blank" rel="noopener noreferrer">
            <img
              src={src}
              alt="Ảnh minh chứng chốt phí demo"
              className="aspect-square rounded-lg object-cover"
            />
          </a>
        ))}
      </div>
      {c.invoiceId && (
        <TenantLink to={`/tenant/invoices/${c.invoiceId}`}>Hóa đơn đã nhận khoản phí</TenantLink>
      )}
    </div>
  )
}
function ProposalForm({ charges, onSuccess }: { charges: UtilityCharge[]; onSuccess: () => void }) {
  const { tenancy: t } = useTenant(),
    [chargeId, setChargeId] = useState(charges[0].id),
    [method, setMethod] = useState<'RESIDENT_DAYS' | 'APPROVED_CUSTOM'>('RESIDENT_DAYS'),
    [reason, setReason] = useState(''),
    [custom, setCustom] = useState<Record<string, string>>({}),
    [error, setError] = useState<Error | null>(null)
  const charge = charges.find((c) => c.id === chargeId)!,
    defaults = allocateVnd(charge.totalAmount, charge.participants),
    mutation = useTenantMutation(tenantApi.propose, onSuccess)
  const shares = defaults.map((p) => ({
      ...p,
      amount:
        method === 'RESIDENT_DAYS'
          ? p.amount
          : custom[p.id] === undefined
            ? p.amount
            : Number(custom[p.id]),
    })),
    sum = shares.reduce((s, p) => s + p.amount, 0)
  return (
    <form
      className="grid min-w-0 grid-cols-1 gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        const result = proposalInputSchema.safeParse({ chargeId, method, reason, shares })
        if (!result.success) {
          setError(new Error('Nhập lý do từ 10 ký tự và số tiền nguyên VND hợp lệ.'))
          return
        }
        if (sum !== charge.totalAmount) {
          setError(new Error('Tổng phân bổ phải bằng tổng phí nguồn.'))
          return
        }
        setError(null)
        mutation.mutate(result.data)
      }}
    >
      <Field id="allocation-charge" label="Khoản phí">
        <select
          id="allocation-charge"
          className="input"
          value={chargeId}
          onChange={(e) => {
            setChargeId(e.target.value)
            setCustom({})
          }}
        >
          {charges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.billingMonth.slice(0, 7)} · {formatVnd(c.totalAmount)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="allocation-method" label="Cách đề xuất">
        <select
          id="allocation-method"
          className="input"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          <option value="RESIDENT_DAYS">Theo ngày cư trú</option>
          <option value="APPROVED_CUSTOM">Thỏa thuận riêng, cần duyệt</option>
        </select>
      </Field>
      <div className="grid gap-4">
        {charge.participants.map((p) => (
          <Field id={`share-${p.id}`} key={p.id} label={`${p.label} · ${p.days} ngày cư trú`}>
            <input
              id={`share-${p.id}`}
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={shares.find((s) => s.id === p.id)!.amount}
              readOnly={method === 'RESIDENT_DAYS'}
              onChange={(e) => setCustom({ ...custom, [p.id]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <p
        className={`text-sm font-bold ${sum === charge.totalAmount ? 'text-primary' : 'text-danger'}`}
      >
        Tổng: {Number.isFinite(sum) ? formatVnd(sum) : 'Chưa hợp lệ'} /{' '}
        {formatVnd(charge.totalAmount)}
      </p>
      <Field id="allocation-reason" label="Lý do đề xuất">
        <textarea
          id="allocation-reason"
          className="input min-h-24"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={10}
          maxLength={1000}
          required
        />
      </Field>
      <Notice>Đề xuất cần được quản lý duyệt. Hóa đơn đã phát hành không bị sửa tự động.</Notice>
      <InlineError error={error || mutation.error} />
      <Button type="submit" loading={mutation.isPending} disabled={!isActive(t)}>
        Gửi đề xuất
      </Button>
    </form>
  )
}
export function AllocationsPage() {
  const { tenancy: t } = useTenant(),
    charges = useTenantQuery('utilities', tenantApi.utilities),
    query = useTenantQuery('allocations', tenantApi.allocations, [], true),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<AllocationProposal | null>(null),
    [success, setSuccess] = useState(false)
  const detail = query.data?.find((p) => p.id === selected?.id)
  return (
    <TenantPage
      title="Phân bổ phí sinh hoạt"
      description="Phân bổ mặc định theo số ngày cư trú; thỏa thuận khác cần quản lý duyệt."
      actions={
        <Button onClick={() => setOpen(true)} disabled={!isActive(t) || !charges.data?.length}>
          <Plus size={17} />
          Đề xuất phân bổ
        </Button>
      }
    >
      <TenantLink to="/tenant/utilities">Về điện & nước</TenantLink>
      {success && <Notice tone="success">Đã gửi đề xuất, đang chờ quản lý xét duyệt.</Notice>}
      <QueryState pending={charges.isPending} error={charges.error} retry={charges.refetch}>
        {charges.data?.map((c) => (
          <Panel key={c.id}>
            <h2 className="mb-4 font-bold">
              {c.name} · {c.billingMonth.slice(0, 7)}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {dateOnly(c.startDate)} – {dateOnly(c.endDate)} · Tổng {formatVnd(c.totalAmount)}
            </p>
            {c.participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap justify-between gap-3 border-t border-border py-3 text-sm"
              >
                <span>
                  {p.label} · {p.days} ngày
                </span>
                <span className="font-bold tabular-nums">{formatVnd(p.amount)}</span>
              </div>
            ))}
          </Panel>
        ))}
      </QueryState>
      <Panel>
        <h2 className="mb-5 font-bold">Lịch sử đề xuất</h2>
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {query.data?.length ? (
            query.data.map((p) => (
              <button
                key={p.id}
                className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border py-4 text-left"
                onClick={() => setSelected(p)}
              >
                <div>
                  <p className="text-sm font-bold">
                    {charges.data?.find((c) => c.id === p.chargeId)?.name || 'Phí sinh hoạt'} ·{' '}
                    {p.method === 'RESIDENT_DAYS' ? 'Theo ngày cư trú' : 'Thỏa thuận riêng'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateTime(p.createdAt)}</p>
                </div>
                <TenantStatus value={p.status} />
              </button>
            ))
          ) : (
            <EmptyRows>Chưa có đề xuất phân bổ.</EmptyRows>
          )}
        </QueryState>
      </Panel>
      <Modal title="Đề xuất phân bổ" open={open} onOpenChange={setOpen}>
        {charges.data?.length && (
          <ProposalForm
            charges={charges.data}
            onSuccess={() => {
              setOpen(false)
              setSuccess(true)
            }}
          />
        )}
      </Modal>
      <Modal
        title="Chi tiết đề xuất"
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
        drawer
      >
        {detail && (
          <div className="grid min-w-0 grid-cols-1 gap-5">
            <TenantStatus value={detail.status} />
            <p className="text-sm leading-6">{detail.reason}</p>
            {detail.shares.map((s) => (
              <div key={s.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {charges.data
                    ?.find((c) => c.id === detail.chargeId)
                    ?.participants.find((p) => p.id === s.id)?.label || 'Người cư trú'}
                </span>
                <strong className="tabular-nums">{formatVnd(s.amount)}</strong>
              </div>
            ))}
            {detail.decidedAt && (
              <p className="text-xs text-muted-foreground">
                Xử lý lúc {dateTime(detail.decidedAt)}
              </p>
            )}
            <Notice>{detail.decision || 'Đang chờ người có thẩm quyền xét duyệt.'}</Notice>
          </div>
        )}
      </Modal>
    </TenantPage>
  )
}
