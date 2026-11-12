import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import type { TenantPayment } from '@/interfaces/tenant'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { InvoicePayment, PaymentRow } from './billing-shared'
import { EmptyRows, Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantQuery } from './context'
import { ManualPayment } from './manual-payment'
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
            <ManualPayment invoice={query.data} />
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
