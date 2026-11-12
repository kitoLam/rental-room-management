import { InlineError, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { InvoiceItemsTable, InvoiceStatusBadge, KindBadge } from '@/features/billing/invoice-parts'
import { formatVnd } from '@/lib/format'
import { billingApi, dayLabel, MIN_ONLINE_PAYMENT, PAYABLE, periodLabel } from '@/services/billing'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { TenantPage } from './components'
import { canPayOnline, usePayInvoice } from '@/features/billing/pay'

export function MonthlyInvoiceDetailPage() {
  const { invoiceId = '' } = useParams()
  const invoice = useQuery({
    queryKey: ['billing', 'invoice', invoiceId],
    queryFn: () => billingApi.invoice('tenant', invoiceId),
  })
  const pay = usePayInvoice()
  const data = invoice.data
  const remaining = data ? (data.remainingAmount ?? data.totalAmount) : 0

  return (
    <TenantPage
      title={data ? `Hoá đơn ${periodLabel(data.period)}` : 'Hoá đơn'}
      description={data?.invoiceNumber || undefined}
      actions={
        <Button asChild variant="outline">
          <Link to="/tenant/my-room">
            <ArrowLeft size={16} />
            Phòng của tôi
          </Link>
        </Button>
      }
    >
      <QueryState pending={invoice.isPending} error={invoice.error} retry={invoice.refetch}>
        {data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="grid gap-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <InvoiceStatusBadge status={data.status} />
                    <KindBadge kind={data.kind} />
                  </p>
                  <p className="text-muted-foreground">Ngày phát hành: {dayLabel(data.issueDate)}</p>
                  <p className="text-muted-foreground">Hạn thanh toán: {dayLabel(data.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Còn phải trả</p>
                  <p className="text-2xl font-bold">{formatVnd(remaining)}</p>
                </div>
              </div>
              <InvoiceItemsTable invoice={data} />
            </Panel>
            {data.status === 'PAID' && <Notice tone="success">Hoá đơn đã được thanh toán đủ.</Notice>}
            {PAYABLE.includes(data.status) && remaining > 0 && remaining < MIN_ONLINE_PAYMENT && (
              <Notice tone="warning">
                Số tiền còn lại dưới {formatVnd(MIN_ONLINE_PAYMENT)}, VNPay không nhận. Vui lòng trả trực tiếp cho quản lý.
              </Notice>
            )}
            {canPayOnline(data) && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <InlineError error={pay.error} />
                <Button size="lg" loading={pay.isPending} onClick={() => pay.mutate(data)}>
                  <CreditCard size={18} />
                  Thanh toán {formatVnd(remaining)} qua VNPay
                </Button>
              </div>
            )}
          </>
        )}
      </QueryState>
    </TenantPage>
  )
}
