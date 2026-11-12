import { InlineError, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { InvoiceStatusBadge, KindBadge } from '@/features/billing/invoice-parts'
import { formatVnd } from '@/lib/format'
import { canPayOnline, usePayInvoice } from '@/features/billing/pay'
import { billingApi, dayLabel, PAYABLE, periodLabel } from '@/services/billing'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'

/** "Hoá đơn hàng tháng" section of the tenant's room page (real backend data). */
export function MonthlyInvoices() {
  const invoices = useQuery({ queryKey: ['billing', 'my-invoices'], queryFn: billingApi.myInvoices })
  const pay = usePayInvoice()
  const unpaid = (invoices.data || [])
    .filter((i) => PAYABLE.includes(i.status))
    .reduce((sum, i) => sum + (i.remainingAmount ?? i.totalAmount), 0)

  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <ReceiptText size={18} />
            Hoá đơn hàng tháng
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiền phòng, điện nước và dịch vụ của từng tháng. Thanh toán trực tuyến qua VNPay.
          </p>
        </div>
        {unpaid > 0 && (
          <p className="text-sm">
            Cần thanh toán: <span className="font-bold text-danger">{formatVnd(unpaid)}</span>
          </p>
        )}
      </div>
      <InlineError error={invoices.error || pay.error} />
      {invoices.isPending && <p className="text-sm text-muted-foreground">Đang tải hoá đơn...</p>}
      {invoices.data?.length === 0 && (
        <p className="rounded-lg bg-background p-4 text-sm text-muted-foreground">
          Bạn chưa có hoá đơn nào. Hoá đơn sẽ xuất hiện khi quản lý phát hành hoá đơn tháng.
        </p>
      )}
      <ul className="grid gap-3">
        {invoices.data?.map((invoice) => (
          <li
            key={invoice.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {periodLabel(invoice.period)}
                <InvoiceStatusBadge status={invoice.status} />
                <KindBadge kind={invoice.kind} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.invoiceNumber} · Hạn thanh toán {dayLabel(invoice.dueDate)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right">
                <p className="font-bold">{formatVnd(invoice.totalAmount)}</p>
                {(invoice.paidAmount ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Còn {formatVnd(invoice.remainingAmount ?? 0)}
                  </p>
                )}
              </div>
              <Button asChild variant="outline">
                <Link to={`/tenant/my-room/invoices/${invoice.id}`}>Chi tiết</Link>
              </Button>
              {canPayOnline(invoice) && (
                <Button
                  loading={pay.isPending && pay.variables?.id === invoice.id}
                  disabled={pay.isPending}
                  onClick={() => pay.mutate(invoice)}
                >
                  <CreditCard size={16} />
                  Thanh toán
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
