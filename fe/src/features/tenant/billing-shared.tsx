import { Field, InlineError, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import type { Invoice, TenantPayment } from '@/interfaces/tenant'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { provider } from '@/services/config'
import { tenantApi } from '@/services/tenant'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Copy } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Facts, TenantStatus } from './components'
import { isActive, useTenant, useTenantMutation } from './context'

const payFormSchema = z.object({
  amount: z.number().int('Nhập số nguyên VND.').positive('Số tiền phải lớn hơn 0.').max(1000000000),
  payerName: z.string().trim().min(2, 'Nhập tên người thanh toán.').max(100),
  outcome: z.enum(['success', 'pending', 'review', 'failure']),
})
type PayForm = z.infer<typeof payFormSchema>
export function InvoicePayment({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: Invoice
  onClose: () => void
  onPaid: (payment: TenantPayment) => void
}) {
  const { tenancy: t } = useTenant(),
    name = useSession((s) => s.user!.fullName),
    submission = useRef<{ signature: string; key: string } | null>(null),
    [copyState, setCopyState] = useState('')
  const form = useForm<PayForm>({
    resolver: zodResolver(payFormSchema),
    defaultValues: { amount: invoice.availableToPay, payerName: name, outcome: 'success' },
  })
  const mutation = useTenantMutation(
    (id, data: PayForm & { idempotencyKey: string }) => tenantApi.pay(id, invoice.id, data),
    onPaid,
  )
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyState('Đã sao chép.')
    } catch {
      setCopyState('Không thể sao chép. Hãy chọn và sao chép nội dung bên trên.')
    }
  }
  return (
    <form
      className="grid min-w-0 grid-cols-1 gap-5"
      onSubmit={(event) =>
        void form.handleSubmit((value) => {
          if (value.amount > invoice.availableToPay) {
            form.setError('amount', { message: 'Số tiền vượt mức có thể thanh toán.' })
            return
          }
          const signature = JSON.stringify(value)
          if (submission.current?.signature !== signature)
            submission.current = { signature, key: crypto.randomUUID() }
          mutation.mutate({ ...value, idempotencyKey: submission.current.key })
        })(event)
      }
    >
      <Notice>{invoice.instructions.text}</Notice>
      <Facts
        items={[
          ['Mức còn có thể thanh toán', formatVnd(invoice.availableToPay)],
          ['Môi trường', invoice.instructions.environment === 'SANDBOX' ? 'Mô phỏng' : 'Thực tế'],
        ]}
      />
      <div className="rounded-lg bg-background p-4">
        <p className="mb-2 text-xs text-muted-foreground">Nội dung tham chiếu</p>
        <p className="break-all text-sm font-bold">{invoice.instructions.reference}</p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void copy(invoice.instructions.reference)}
        >
          <Copy size={16} />
          Sao chép nội dung
        </Button>
        {invoice.instructions.qrUrl && (
          <img
            src={invoice.instructions.qrUrl}
            alt="Mã QR do nhà cung cấp thanh toán trả về"
            className="mx-auto max-w-52"
          />
        )}
      </div>
      <Field
        id="pay-amount"
        label="Số tiền thanh toán (VND)"
        error={form.formState.errors.amount?.message}
      >
        <input
          id="pay-amount"
          className="input"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          max={invoice.availableToPay}
          {...form.register('amount', { valueAsNumber: true })}
        />
      </Field>
      <Button
        type="button"
        variant="ghost"
        className="justify-start"
        onClick={() => void copy(String(form.getValues('amount')))}
      >
        <Copy size={16} />
        Sao chép số tiền
      </Button>
      <Field
        id="payer-name"
        label="Người thanh toán"
        hint="Có thể thanh toán thay cho người thuê."
        error={form.formState.errors.payerName?.message}
      >
        <input id="payer-name" className="input" {...form.register('payerName')} />
      </Field>
      {provider('tenant') === 'mock' && (
        <Field id="payment-scenario" label="Kịch bản thanh toán mô phỏng">
          <select id="payment-scenario" className="input" {...form.register('outcome')}>
            <option value="success">Được xác minh sau vài giây</option>
            <option value="pending">Tiếp tục chờ xử lý</option>
            <option value="review">Cần đối soát</option>
            <option value="failure">Không thành công</option>
          </select>
        </Field>
      )}
      {copyState && (
        <p role="status" className="text-xs text-muted-foreground">
          {copyState}
        </p>
      )}
      <InlineError error={mutation.error} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
          Đóng
        </Button>
        <Button
          loading={mutation.isPending}
          disabled={!isActive(t) || invoice.availableToPay <= 0}
          type="submit"
        >
          {invoice.instructions.environment === 'SANDBOX'
            ? 'Bắt đầu thanh toán demo'
            : 'Gửi thanh toán'}
        </Button>
      </div>
    </form>
  )
}
export function PaymentRow({
  payment: p,
  onOpen,
}: {
  payment: TenantPayment
  onOpen?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-4 first:border-0 first:pt-0">
      <div className="min-w-0">
        <p className="break-all text-sm font-bold">{p.reference}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {dateTime(p.createdAt)} · {p.environment === 'SANDBOX' ? 'Mô phỏng' : 'Thực tế'} ·{' '}
          {p.method === 'SANDBOX' ? 'Sandbox' : 'Chuyển khoản'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {p.invoiceId ? 'Thanh toán hóa đơn' : 'Tiền thuê trả trước'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold tabular-nums">{formatVnd(p.amountReceived)}</span>
        <TenantStatus value={p.status} />
        {onOpen && (
          <Button variant="ghost" aria-label={`Chi tiết ${p.reference}`} onClick={onOpen}>
            <ArrowRight size={17} />
          </Button>
        )}
      </div>
    </div>
  )
}
