import { tenantStatusLabel } from './status'
import { ManualPayment } from './manual-payment'
import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, RefreshCw, ArrowRight } from 'lucide-react'
import { useSession } from '@/features/auth/session-store'
import {
  Panel,
  QueryState,
  Field,
  InlineError,
  Modal,
  Notice,
  Pagination,
} from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { TenantPage, TenantStatus, Facts, TenantLink, EmptyRows } from './components'
import { useTenant, useTenantQuery, useTenantMutation, isActive, tenantLink } from './context'
import { tenantApi } from '@/services/tenant'
import { provider } from '@/services/config'
import { formatVnd } from '@/lib/format'
import { dateOnly, dateTime } from '@/lib/activity'
import type { Invoice, TenantPayment } from '@/interfaces/tenant'

export function InvoicesPage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('invoices', tenantApi.invoices, [], true)
  const [month, setMonth] = useState(''),
    [state, setState] = useState(''),
    [document, setDocument] = useState(''),
    [page, setPage] = useState(1)
  const rows = (query.data || []).filter(
      (i) =>
        (!month || i.billingMonth.startsWith(month)) &&
        (!document || i.documentStatus === document) &&
        (!state || (i.documentStatus === 'ISSUED' && i.financialStatus === state)),
    ),
    pages = Math.ceil(rows.length / 6),
    current = Math.min(page, Math.max(1, pages))
  return (
    <TenantPage
      title="Hóa đơn của tôi"
      description="Công nợ và thanh toán được theo dõi riêng cho chỗ ở đang chọn."
    >
      <div className="flex flex-wrap gap-3">
        <Field id="invoice-month" label="Tháng / năm">
          <input
            id="invoice-month"
            type="month"
            className="input w-full"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
          />
        </Field>
        <Field id="invoice-state" label="Thanh toán">
          <select
            id="invoice-state"
            className="input"
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'].map((s) => (
              <option key={s} value={s}>
                {tenantStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="invoice-document" label="Chứng từ">
          <select
            id="invoice-document"
            className="input"
            value={document}
            onChange={(e) => {
              setDocument(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {['ISSUED', 'DRAFT', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>
                {tenantStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có hóa đơn phù hợp."
        emptyAction={null}
      >
        <Panel>
          <ul className="divide-y divide-border">
            {rows.slice((current - 1) * 6, current * 6).map((i) => (
              <li key={i.id} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      to={tenantLink(`/tenant/invoices/${i.id}`, t)}
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      {i.code}
                    </Link>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Kỳ {i.billingMonth.slice(0, 7)} · {t.roomName}
                      {t.slotName ? ` · ${t.slotName}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.branchName} · Hạn {dateOnly(i.dueDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Phát hành: {i.issuedAt ? dateTime(i.issuedAt) : 'Chưa phát hành'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TenantStatus value={i.documentStatus} />
                    {i.documentStatus === 'ISSUED' && <TenantStatus value={i.financialStatus} />}
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ['Tổng hóa đơn', i.totalAmount],
                    ['Đã phân bổ', i.verifiedAllocated],
                    ['Áp dụng trả trước', i.prepaidApplied],
                    ['Còn phải trả', i.outstanding],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-sm font-bold tabular-nums">
                        {formatVnd(Number(value))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </Panel>
        <Pagination page={current} totalPages={pages} onPage={setPage} />
      </QueryState>
    </TenantPage>
  )
}
const payFormSchema = z.object({
  amount: z.number().int('Nhập số nguyên VND.').positive('Số tiền phải lớn hơn 0.').max(1000000000),
  payerName: z.string().trim().min(2, 'Nhập tên người thanh toán.').max(100),
  outcome: z.enum(['success', 'pending', 'review', 'failure']),
})
type PayForm = z.infer<typeof payFormSchema>
function InvoicePayment({
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
export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    [open, setOpen] = useState(false),
    [payment, setPayment] = useState<TenantPayment | null>(null)
  const query = useTenantQuery(
      'invoice',
      (id) => tenantApi.invoice(id, invoiceId),
      [invoiceId],
      true,
    ),
    payments = useTenantQuery('payments', tenantApi.payments, [], true)
  return (
    <TenantPage
      title="Chi tiết hóa đơn"
      actions={<TenantLink to="/tenant/invoices">Danh sách hóa đơn</TenantLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            {payment && (
              <Notice tone="success">
                Đã ghi nhận {payment.reference}. Dư nợ chỉ cập nhật sau khi thanh toán được xác minh
                và phân bổ.
              </Notice>
            )}
            <Panel>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{query.data.code}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t.branchName} · {t.roomName}
                    {t.slotName ? ` · ${t.slotName}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <TenantStatus value={query.data.documentStatus} />
                  {query.data.documentStatus === 'ISSUED' && (
                    <TenantStatus value={query.data.financialStatus} />
                  )}
                </div>
              </div>
              <Facts
                items={[
                  ['Kỳ hóa đơn', query.data.billingMonth.slice(0, 7)],
                  ['Hạn thanh toán', dateOnly(query.data.dueDate)],
                  [
                    'Ngày phát hành',
                    query.data.issuedAt ? dateTime(query.data.issuedAt) : 'Chưa phát hành',
                  ],
                  ['Quan hệ thuê', t.id],
                ]}
              />
              <div className="mt-6 divide-y divide-border border-y border-border">
                {query.data.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.snapshot}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums">{formatVnd(item.amount)}</p>
                  </div>
                ))}
              </div>
              <dl className="ml-auto mt-5 grid max-w-md gap-3 text-sm">
                {[
                  ['Tổng hóa đơn', query.data.totalAmount],
                  ['Đã áp dụng trả trước', query.data.prepaidApplied],
                  ['Thanh toán đã xác minh, phân bổ', query.data.verifiedAllocated],
                  ['Còn phải trả', query.data.outstanding],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-bold tabular-nums">{formatVnd(Number(value))}</dd>
                  </div>
                ))}
              </dl>
              {query.data.prepaidApplied > 0 && (
                <p className="mt-5 break-all text-xs text-muted-foreground">
                  Nguồn trả trước: {query.data.prepaidSourcePaymentId}. Áp dụng từ khoản tiền đã
                  thu, không phải lần thu mới.
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    void query.refetch()
                    void payments.refetch()
                  }}
                >
                  <RefreshCw size={16} />
                  Cập nhật trạng thái
                </Button>
                <Button
                  onClick={() => setOpen(true)}
                  disabled={
                    !isActive(t) ||
                    query.data.documentStatus !== 'ISSUED' ||
                    query.data.availableToPay <= 0
                  }
                >
                  Thanh toán hóa đơn
                </Button>
              </div>
              {query.data.availableToPay < query.data.outstanding && (
                <p className="mt-3 text-right text-xs text-muted-foreground">
                  Một phần tiền đang chờ xác minh / đối soát, chưa trừ vào dư nợ.
                </p>
              )}
            </Panel>
            <ManualPayment invoice={query.data}/>
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử thanh toán hóa đơn</h2>
              <QueryState
                pending={payments.isPending}
                error={payments.error}
                retry={payments.refetch}
              >
                {payments.data?.filter((p) => p.invoiceId === invoiceId).length ? (
                  payments.data
                    .filter((p) => p.invoiceId === invoiceId)
                    .map((p) => <PaymentRow key={p.id} payment={p} />)
                ) : (
                  <EmptyRows>Chưa có giao dịch cho hóa đơn này.</EmptyRows>
                )}
              </QueryState>
            </Panel>
            <Modal
              title="Thanh toán hóa đơn"
              open={open}
              onOpenChange={(v) => setOpen(v)}
              description="Kiểm tra số tiền và người thanh toán trước khi tiếp tục."
            >
              <InvoicePayment
                invoice={query.data}
                onClose={() => setOpen(false)}
                onPaid={(p) => {
                  setPayment(p)
                  setOpen(false)
                }}
              />
            </Modal>
          </>
        )}
      </QueryState>
    </TenantPage>
  )
}
function PaymentRow({ payment: p, onOpen }: { payment: TenantPayment; onOpen?: () => void }) {
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
export function PaymentsPage() {
  const { tenancy: t } = useTenant(),
    [params, setParams] = useSearchParams(),
    query = useTenantQuery('payments', tenantApi.payments, [], true),
    [state, setState] = useState(''),
    [month, setMonth] = useState(''),
    [page, setPage] = useState(1)
  const id = params.get('paymentId'),
    selected = query.data?.find((p) => p.id === id),
    rows = (query.data || []).filter(
      (p) => (!state || p.status === state) && (!month || p.createdAt.startsWith(month)),
    ),
    pages = Math.ceil(rows.length / 6),
    current = Math.min(page, Math.max(1, pages))
  function show(paymentId: string | null) {
    const next = new URLSearchParams(params)
    if (paymentId) next.set('paymentId', paymentId)
    else next.delete('paymentId')
    setParams(next)
  }
  return (
    <TenantPage
      title="Lịch sử thanh toán"
      description="Giao dịch nhận tiền và phân bổ được theo dõi riêng."
      actions={
        <Button variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw size={16} />
          Cập nhật
        </Button>
      }
    >
      <div className="flex flex-wrap gap-3">
        <Field label="Trạng thái" id="payment-filter">
          <select
            id="payment-filter"
            className="input"
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {['PENDING', 'VERIFIED', 'REVIEW', 'FAILED'].map((s) => (
              <option key={s} value={s}>
                {tenantStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tháng nhận tiền" id="payment-month">
          <input
            className="input"
            id="payment-month"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
          />
        </Field>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có thanh toán phù hợp."
        emptyAction={null}
      >
        <Panel>
          {rows.slice((current - 1) * 6, current * 6).map((p) => (
            <PaymentRow key={p.id} payment={p} onOpen={() => show(p.id)} />
          ))}
        </Panel>
        <Pagination page={current} totalPages={pages} onPage={setPage} />
      </QueryState>
      <Modal
        open={!!id}
        onOpenChange={(v) => {
          if (!v) show(null)
        }}
        title="Chi tiết thanh toán"
        drawer
      >
        {selected ? (
          <>
            <TenantStatus value={selected.status} />
            <div className="mt-5">
              <Facts
                items={[
                  ['Tham chiếu', selected.reference],
                  ['Người thanh toán', selected.payerName],
                  ['Số tiền nhận', formatVnd(selected.amountReceived)],
                  ['Đã phân bổ hóa đơn', formatVnd(selected.allocatedAmount)],
                  [
                    'Trả trước kỳ đầu / kỳ cuối',
                    `${formatVnd(selected.prepaidFirstAmount)} / ${formatVnd(selected.prepaidLastAmount)}`,
                  ],
                  [
                    'Đã áp dụng kỳ đầu / kỳ cuối',
                    `${formatVnd(selected.prepaidFirstApplied)} / ${formatVnd(selected.prepaidLastApplied)}`,
                  ],
                  [
                    'Xác minh lúc',
                    selected.verifiedAt ? dateTime(selected.verifiedAt) : 'Chưa xác minh',
                  ],
                  ['Môi trường', selected.environment === 'SANDBOX' ? 'Mô phỏng' : 'Thực tế'],
                ]}
              />
            </div>
            {selected.invoiceId && (
              <Link
                className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary"
                to={tenantLink(`/tenant/invoices/${selected.invoiceId}`, t)}
              >
                Xem hóa đơn liên quan
              </Link>
            )}
            {selected.evidence.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {selected.evidence.map((src) => (
                  <a
                    key={src}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline"
                  >
                    Xem chứng từ
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-xs text-muted-foreground">Chưa có chứng từ đính kèm.</p>
            )}
          </>
        ) : (
          <InlineError
            error={
              query.isPending ? null : new Error('Không tìm thấy thanh toán được phép truy cập.')
            }
          />
        )}
      </Modal>
    </TenantPage>
  )
}
