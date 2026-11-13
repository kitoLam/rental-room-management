import { StatusBadge } from '@/components/common/status-badge'
import { formatVnd } from '@/lib/format'
import {
  dayLabel,
  invoiceStatusLabel,
  invoiceStatusTone,
  itemTypeLabel,
  type BillingInvoice,
  type InvoiceStatus,
} from '@/services/billing'

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <StatusBadge tone={invoiceStatusTone[status]}>{invoiceStatusLabel[status]}</StatusBadge>
}

export function KindBadge({ kind }: { kind?: string | null }) {
  return kind === 'SUPPLEMENTARY' ? <StatusBadge tone="info">Bổ sung</StatusBadge> : null
}

/** Line items + totals of one invoice. */
export function InvoiceItemsTable({ invoice }: { invoice: BillingInvoice }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[15px]">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-bold">Khoản</th>
            <th className="py-2 pr-3 font-bold">Thời gian</th>
            <th className="py-2 text-right font-bold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-muted-foreground">
                Chưa có khoản nào.
              </td>
            </tr>
          )}
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-border/60 align-top">
              <td className="py-3 pr-3">
                <p className="font-medium">{item.description || itemTypeLabel[item.type] || item.type}</p>
                <p className="text-xs text-muted-foreground">{itemTypeLabel[item.type] || item.type}</p>
                {item.warning && (
                  <p className="mt-1 inline-block rounded bg-warning/20 px-1.5 py-0.5 text-xs font-medium">⚠ {item.warning}</p>
                )}
              </td>
              <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                {item.fromDate ? `${dayLabel(item.fromDate)} – ${dayLabel(item.toDate)}` : '—'}
              </td>
              <td className={`py-3 text-right font-medium whitespace-nowrap ${item.amount < 0 ? 'text-success' : ''}`}>
                {formatVnd(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-4 ml-auto grid max-w-xs gap-1 text-sm">
        <Row label="Tổng cộng" value={formatVnd(invoice.totalAmount)} strong />
        <Row label="Đã thanh toán" value={formatVnd(invoice.paidAmount ?? 0)} />
        <Row label="Còn phải trả" value={formatVnd(invoice.remainingAmount ?? invoice.totalAmount)} strong />
      </dl>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-bold' : ''}>{value}</dd>
    </div>
  )
}
