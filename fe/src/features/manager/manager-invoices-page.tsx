import { Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { InvoiceItemsTable, InvoiceStatusBadge } from '@/features/billing/invoice-parts'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { billingApi, currentPeriod, dayLabel, periodLabel, type BillingInvoice } from '@/services/billing'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManagerPage } from './components'
import { useManager } from './context'

type RoomGroup = { roomId: string; roomNumber: string; invoices: BillingInvoice[] }

/** Invoices of a month, one collapsible block per room listing the invoice of each slot. */
export function ManagerInvoices() {
  const { branch } = useManager()
  const now = currentPeriod()
  const [year, setYear] = useState(Number(now.slice(0, 4)))
  const [month, setMonth] = useState(Number(now.slice(5, 7)))
  const [viewing, setViewing] = useState<BillingInvoice | null>(null)
  const period = `${year}-${String(month).padStart(2, '0')}`
  const query = useQuery({
    queryKey: ['branch-invoices', branch.id, period],
    queryFn: () => billingApi.branchInvoices(branch.id, period),
  })

  const rooms = useMemo(() => {
    const map = new Map<string, RoomGroup>()
    for (const invoice of query.data || []) {
      const key = invoice.roomId || 'unknown'
      const group = map.get(key) || { roomId: key, roomNumber: invoice.roomNumber || '—', invoices: [] }
      group.invoices.push(invoice)
      map.set(key, group)
    }
    return [...map.values()]
  }, [query.data])
  const total = (query.data || []).reduce((sum, i) => sum + i.totalAmount, 0)
  const paid = (query.data || []).reduce((sum, i) => sum + (i.paidAmount ?? 0), 0)

  return (
    <ManagerPage
      title="Hóa đơn"
      description="Hoá đơn từng slot theo tháng, nhóm theo phòng. Mở một phòng để xem hoá đơn của các slot trong đó."
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tháng</span>
            <select className="input w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-sm">
            <span className="font-medium">Năm</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Năm trước" onClick={() => setYear((y) => y - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <span className="w-14 text-center font-bold tabular-nums">{year}</span>
              <Button variant="outline" size="icon" aria-label="Năm sau" onClick={() => setYear((y) => y + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`Số hoá đơn ${periodLabel(period).toLowerCase()}`} value={String(query.data?.length ?? 0)} />
        <Stat label="Tổng phải thu" value={formatVnd(total)} />
        <Stat label="Đã thu" value={formatVnd(paid)} />
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rooms.length === 0}
        emptyMessage={`Chưa có hoá đơn nào ${periodLabel(period).toLowerCase()}.`}
      >
        <div className="grid gap-3">
          {rooms.map((room) => (
            <RoomBlock key={room.roomId} room={room} onView={setViewing} />
          ))}
        </div>
      </QueryState>
      <Modal
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? `Hoá đơn ${viewing.invoiceNumber ?? ''}` : 'Hoá đơn'}
        description={
          viewing
            ? `Phòng ${viewing.roomNumber ?? '—'} · Slot ${viewing.slotCode ?? '—'} · ${viewing.tenantName ?? ''} · hạn ${dayLabel(viewing.dueDate)}`
            : undefined
        }
      >
        {viewing && <InvoiceItemsTable invoice={viewing} />}
      </Modal>
    </ManagerPage>
  )
}

function RoomBlock({ room, onView }: { room: RoomGroup; onView: (i: BillingInvoice) => void }) {
  const [open, setOpen] = useState(false)
  const total = room.invoices.reduce((sum, i) => sum + i.totalAmount, 0)
  const unpaid = room.invoices.reduce((sum, i) => sum + (i.remainingAmount ?? 0), 0)
  return (
    <Panel className="p-0 sm:p-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-primary-soft/40"
      >
        <span className="flex items-center gap-3">
          <ChevronDown size={18} className={cn('transition-transform', !open && '-rotate-90')} />
          <span>
            <span className="block font-bold">Phòng {room.roomNumber}</span>
            <span className="text-xs text-muted-foreground">{room.invoices.length} hoá đơn</span>
          </span>
        </span>
        <span className="text-right text-sm">
          <span className="block font-bold tabular-nums">{formatVnd(total)}</span>
          <span className={cn('text-xs', unpaid > 0 ? 'text-warning' : 'text-success')}>
            {unpaid > 0 ? `Còn ${formatVnd(unpaid)}` : 'Đã thu đủ'}
          </span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-bold">Slot · người thuê</th>
                <th className="px-3 py-3 font-bold">Số hoá đơn</th>
                <th className="px-3 py-3 font-bold">Tổng / còn lại</th>
                <th className="px-3 py-3 font-bold">Hạn</th>
                <th className="px-3 py-3 font-bold">Trạng thái</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {room.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold">Slot {invoice.slotCode || '—'}</p>
                    <p className="text-xs text-muted-foreground">{invoice.tenantName}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{invoice.invoiceNumber}</td>
                  <td className="px-3 py-3 tabular-nums">
                    <p className="font-semibold">{formatVnd(invoice.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">Còn {formatVnd(invoice.remainingAmount ?? 0)}</p>
                  </td>
                  <td className="px-3 py-3">{dayLabel(invoice.dueDate)}</td>
                  <td className="px-3 py-3">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" onClick={() => onView(invoice)}>
                      <Eye size={16} />
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border/70">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}
