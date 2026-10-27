import { Field, InlineError, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  proposalInputSchema,
  serviceInputSchema,
  type TenantService,
  type UtilityCharge,
} from '@/interfaces/tenant'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { allocateVnd } from '@/lib/tenant-finance'
import { tenantApi } from '@/services/tenant'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Facts, TenantLink } from './components'
import { isActive, useTenant, useTenantMutation } from './context'

export function RegisterService({
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
    mutation = useTenantMutation(
      (id, value: z.infer<typeof serviceInputSchema>) =>
        tenantApi.registerService(id, { ...value, contractId: t.contractId, roomServiceId: s.id }),
      onSuccess,
    )
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
export function ChargeDetail({ charge: c }: { charge: UtilityCharge }) {
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
export function ProposalForm({
  charges,
  onSuccess,
}: {
  charges: UtilityCharge[]
  onSuccess: () => void
}) {
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
