import { InlineError, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { InvoiceStatusBadge } from '@/features/billing/invoice-parts'
import { canPayOnline, usePayInvoice } from '@/features/billing/pay'
import { useSession } from '@/features/auth/session-store'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { billingApi, currentPeriod, dayLabel, PAYABLE, type BillingInvoice } from '@/services/billing'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CreditCard, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TenantPage } from './components'
import { tenantLink, useTenant } from './context'

/** The tenant's monthly invoices of the selected tenancy: one card per month (1–12) of a year. */
export function InvoicesPage() {
  const { tenancy } = useTenant()
  const userId = useSession((s) => s.user!.id)
  const now = currentPeriod()
  const currentYear = Number(now.slice(0, 4))
  const [year, setYear] = useState(currentYear)
  const query = useQuery({ queryKey: ['billing', 'my-invoices', userId], queryFn: billingApi.myInvoices })
  const pay = usePayInvoice()

  // Invoices belong to a contract (= the slot of this tenancy).
  const mine = useMemo(
    () => (query.data || []).filter((i) => i.contractId === tenancy.contractId),
    [query.data, tenancy.contractId],
  )
  const byPeriod = useMemo(() => {
    const map = new Map<string, BillingInvoice[]>()
    for (const invoice of mine) map.set(invoice.period, [...(map.get(invoice.period) || []), invoice])
    return map
  }, [mine])
  const ofYear = mine.filter((i) => i.period.startsWith(`${year}-`))
  const unpaid = mine.filter((i) => PAYABLE.includes(i.status))
  const owed = unpaid.reduce((sum, i) => sum + (i.remainingAmount ?? i.totalAmount), 0)
  const paidThisYear = ofYear.reduce((sum, i) => sum + (i.paidAmount ?? 0), 0)

  return (
    <TenantPage
      title="Hoá đơn"
      description="Hoá đơn hằng tháng của chỗ ở đang chọn: tiền phòng, dịch vụ, tiền điện. Thanh toán trực tuyến qua VNPay."
      actions={
        <div className="flex items-center gap-2" aria-label="Chọn năm">
          <Button variant="outline" size="icon" aria-label="Năm trước" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft size={18} />
          </Button>
          <span className="min-w-20 text-center text-lg font-bold tabular-nums">{year}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Năm sau"
            disabled={year >= currentYear}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      }
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Còn phải trả" value={formatVnd(owed)} tone={owed > 0 ? 'warn' : 'ok'} />
          <Summary label="Hoá đơn chưa thanh toán" value={String(unpaid.length)} />
          <Summary label={`Đã thanh toán ${year}`} value={formatVnd(paidThisYear)} />
        </div>
        <InlineError error={pay.error} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const period = `${year}-${String(month).padStart(2, '0')}`
            const invoices = byPeriod.get(period) || []
            return (
              <MonthCard
                key={period}
                month={month}
                current={period === now}
                invoices={invoices}
                detailHref={(id) => tenantLink(`/tenant/invoices/${id}`, tenancy)}
                paying={pay.isPending ? pay.variables?.id : undefined}
                onPay={(invoice) => pay.mutate(invoice)}
              />
            )
          })}
        </div>
      </QueryState>
    </TenantPage>
  )
}

function MonthCard({
  month,
  current,
  invoices,
  detailHref,
  paying,
  onPay,
}: {
  month: number
  current: boolean
  invoices: BillingInvoice[]
  detailHref: (id: string) => string
  paying?: string | null
  onPay: (invoice: BillingInvoice) => void
}) {
  const owed = invoices.some((i) => PAYABLE.includes(i.status))
  return (
    <Panel
      className={cn(
        'flex min-h-44 flex-col gap-3 p-4 sm:p-4',
        current && 'ring-2 ring-primary/60',
        owed && 'ring-2 ring-warning/60',
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Tháng {month}</h2>
        {current && <span className="text-xs font-semibold text-primary">Tháng này</span>}
      </div>
      {invoices.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
          Không có hoá đơn
        </p>
      ) : (
        invoices.map((invoice) => {
          const remaining = invoice.remainingAmount ?? invoice.totalAmount
          return (
            <div key={invoice.id} className="flex flex-1 flex-col gap-2">
              <InvoiceStatusBadge status={invoice.status} />
              <p className="text-xl font-bold tabular-nums">{formatVnd(invoice.totalAmount)}</p>
              <div className="grid gap-0.5 text-sm text-muted-foreground">
                {PAYABLE.includes(invoice.status) && (
                  <span>
                    Còn phải trả <strong className="text-foreground">{formatVnd(remaining)}</strong>
                  </span>
                )}
                <span>Hạn {dayLabel(invoice.dueDate)}</span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" className="flex-1">
                  <Link to={detailHref(invoice.id!)}>
                    <Eye size={16} />
                    Chi tiết
                  </Link>
                </Button>
                {canPayOnline(invoice) && (
                  <Button className="flex-1" loading={paying === invoice.id} onClick={() => onPay(invoice)}>
                    <CreditCard size={16} />
                    Thanh toán
                  </Button>
                )}
              </div>
            </div>
          )
        })
      )}
    </Panel>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'ok' }) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 ring-1',
        tone === 'warn' ? 'bg-warning/15 ring-warning/50' : 'bg-surface ring-border/70',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums', tone === 'warn' && 'text-warning')}>{value}</p>
    </div>
  )
}
