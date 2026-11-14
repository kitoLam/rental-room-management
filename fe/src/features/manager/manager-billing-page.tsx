import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  billingApi,
  currentPeriod,
  dayLabel,
  itemTypeLabel,
  periodLabel,
  type InvoiceEstimate,
  type SlotEstimate,
} from '@/services/billing'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { ManagerPage } from './components'
import { useManager } from './context'

type Room = InvoiceEstimate['rooms'][number]
type Target = { label: string; contractIds?: string[]; count: number; amount: number }

const FEES: { key: keyof SlotEstimate; label: string; types: string[] }[] = [
  { key: 'rentAmount', label: 'Tiền phòng', types: ['ROOM_RENT'] },
  { key: 'roomServiceAmount', label: 'Dịch vụ phòng', types: ['ROOM_SERVICE'] },
  { key: 'electricityAmount', label: 'Tiền điện', types: ['ELECTRICITY'] },
  { key: 'slotServiceAmount', label: 'Dịch vụ tự chọn', types: ['SLOT_SERVICE'] },
]

/**
 * Invoice estimate: what the month's invoices would look like for slots that have no invoice yet
 * (nothing is stored). Staff check the 4 fees, then confirm to create the invoices; a slot invoiced
 * here is skipped by the day-1 job.
 */
export function ManagerBilling() {
  const { branch } = useManager()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const [target, setTarget] = useState<Target | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const estimate = useQuery({
    queryKey: ['invoice-estimate', branch.id, period],
    queryFn: () => billingApi.estimate(branch.id, period),
    enabled: /^\d{4}-\d{2}$/.test(period),
  })
  const confirm = useMutation({
    mutationFn: (t: Target) => billingApi.confirmEstimate(branch.id, period, t.contractIds),
    onSuccess: (result) => {
      setTarget(null)
      setDone(
        `Đã tạo ${result.created.length} hoá đơn ${periodLabel(period).toLowerCase()}` +
          (result.skippedContractIds.length ? `, bỏ qua ${result.skippedContractIds.length} slot đã có hoá đơn.` : '.'),
      )
      void queryClient.invalidateQueries({ queryKey: ['invoice-estimate'] })
      void queryClient.invalidateQueries({ queryKey: ['branch-invoices'] })
    },
  })
  const data = estimate.data
  const slotCount = data?.rooms.reduce((n, r) => n + r.slots.length, 0) ?? 0
  const warningCount = data?.rooms.reduce((n, r) => n + r.slots.filter((s) => s.warnings.length > 0).length, 0) ?? 0

  return (
    <ManagerPage
      title="Ước tính hoá đơn"
      description="Xem trước hoá đơn của tháng cho các slot chưa có hoá đơn: tiền phòng theo ngày ở, dịch vụ phòng và tiền điện chia theo số người ở trong tháng, dịch vụ tự chọn. Kiểm tra rồi xác nhận tạo; slot đã tạo sẽ không bị cron đầu tháng sau lập lại."
      actions={
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Tháng</span>
          <input
            type="month"
            value={period}
            max={currentPeriod()}
            onChange={(e) => e.target.value && e.target.value <= currentPeriod() && setPeriod(e.target.value)}
            className="h-11 rounded-lg border border-border bg-surface px-3"
          />
        </label>
      }
    >
      {done && <Notice tone="success">{done}</Notice>}
      <QueryState pending={estimate.isPending} error={estimate.error} retry={estimate.refetch}>
        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Slot chờ lập hoá đơn" value={String(slotCount)} />
              <Stat label="Đã có hoá đơn tháng này" value={`${data.invoicedCount} slot`} />
              <Stat label="Tổng tiền ước tính" value={formatVnd(data.totalAmount)} />
              <Stat label="Slot cần kiểm tra" value={String(warningCount)} warn={warningCount > 0} />
            </div>
            {period === data.currentPeriod && (
              <Notice>
                Tháng {periodLabel(period).slice(6)} chưa kết thúc: tiền điện và dịch vụ có thể còn thay đổi. Cron sẽ tự
                lập hoá đơn tháng này vào ngày 1 tháng sau cho các slot chưa có.
              </Notice>
            )}
            {data.rooms.length === 0 ? (
              <Panel>
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Không còn slot nào cần lập hoá đơn {periodLabel(period).toLowerCase()}.
                </p>
              </Panel>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {data.rooms.length} phòng · {slotCount} slot
                  </p>
                  <Button
                    onClick={() =>
                      setTarget({ label: `tất cả ${slotCount} slot`, count: slotCount, amount: data.totalAmount })
                    }
                  >
                    <FilePlus2 size={16} />
                    Tạo hoá đơn cho tất cả
                  </Button>
                </div>
                <div className="grid gap-4">
                  {data.rooms.map((room) => (
                    <RoomCard key={room.roomId} room={room} onCreate={setTarget} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </QueryState>
      <Modal
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !confirm.isPending) {
            setTarget(null)
            confirm.reset()
          }
        }}
        title="Xác nhận tạo hoá đơn"
        description={target ? `${periodLabel(period)} · ${target.label}` : undefined}
      >
        {target && (
          <div className="grid gap-4">
            <p className="text-sm">
              Tạo <strong>{target.count}</strong> hoá đơn, tổng <strong>{formatVnd(target.amount)}</strong>. Hoá đơn được
              phát hành ngay để người thuê thanh toán; các slot này sẽ không bị cron lập lại.
            </p>
            <InlineError error={confirm.error} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" disabled={confirm.isPending} onClick={() => setTarget(null)}>
                Huỷ
              </Button>
              <Button loading={confirm.isPending} onClick={() => confirm.mutate(target)}>
                <CheckCircle2 size={16} />
                Xác nhận tạo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ManagerPage>
  )
}

function RoomCard({ room, onCreate }: { room: Room; onCreate: (t: Target) => void }) {
  const [open, setOpen] = useState(true)
  const flagged = room.slots.some((s) => s.warnings.length > 0)
  return (
    <Panel className={cn('p-0 sm:p-0', flagged && 'ring-2 ring-warning/60')}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button type="button" className="flex items-center gap-3 text-left" onClick={() => setOpen((v) => !v)}>
          <ChevronDown size={18} className={cn('transition-transform', !open && '-rotate-90')} />
          <div>
            <p className="font-bold">
              Phòng {room.roomNumber}
              {room.title && <span className="font-normal text-muted-foreground"> · {room.title}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {room.slots.length} slot chờ lập · {room.occupants} người ở trong tháng · {formatVnd(room.totalAmount)}
            </p>
          </div>
          {flagged && (
            <StatusBadge tone="warning">
              <AlertTriangle size={12} className="mr-1 inline" />
              Cần kiểm tra
            </StatusBadge>
          )}
        </button>
        <Button
          variant="outline"
          onClick={() =>
            onCreate({
              label: `phòng ${room.roomNumber}`,
              contractIds: room.slots.map((s) => s.contractId),
              count: room.slots.length,
              amount: room.totalAmount,
            })
          }
        >
          <FilePlus2 size={16} />
          Tạo cho cả phòng
        </Button>
      </div>
      {open && (
        <div className="grid gap-4 border-t border-border p-5 xl:grid-cols-2">
          {room.slots.map((slot) => (
            <SlotCard key={slot.contractId} slot={slot} roomNumber={room.roomNumber} onCreate={onCreate} />
          ))}
        </div>
      )}
    </Panel>
  )
}

function SlotCard({
  slot,
  roomNumber,
  onCreate,
}: {
  slot: SlotEstimate
  roomNumber?: string | null
  onCreate: (t: Target) => void
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-background p-4', slot.electricityUnchanged && 'border-warning')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            Slot {slot.slotCode || '—'} · {slot.tenantName || 'Người thuê'}
          </p>
          <p className="text-sm text-muted-foreground">
            {slot.contractNumber} · ở {dayLabel(slot.stayFrom)} – {dayLabel(slot.stayTo)}
          </p>
        </div>
        <Button
          variant="soft"
          onClick={() =>
            onCreate({
              label: `phòng ${roomNumber}, slot ${slot.slotCode || ''}`,
              contractIds: [slot.contractId],
              count: 1,
              amount: slot.totalAmount,
            })
          }
        >
          <FilePlus2 size={16} />
          Tạo hoá đơn
        </Button>
      </div>
      {slot.warnings.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-lg bg-warning/15 p-3 text-sm ring-1 ring-warning/40">
          {slot.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-4">
        {FEES.map((fee, index) => {
          const items = slot.items.filter((i) => fee.types.includes(i.type))
          return (
            <div key={fee.key}>
              <div className="flex justify-between text-base font-bold">
                <span>
                  Phí {index + 1}: {fee.label}
                </span>
                <span className="tabular-nums">{formatVnd(slot[fee.key] as number)}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không có khoản nào.</p>
              ) : (
                <ul className="mt-1.5 grid gap-1">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        'flex justify-between gap-3 rounded-md px-2.5 py-1.5 text-[15px]',
                        item.warning ? 'bg-warning/20 font-semibold ring-1 ring-warning/50' : 'text-foreground/80',
                      )}
                    >
                      <span>
                        {item.warning && <AlertTriangle size={15} className="mr-1.5 inline text-warning" />}
                        {item.description || itemTypeLabel[item.type]}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatVnd(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex justify-between border-t border-border pt-3 text-lg font-bold">
        <span>Tổng cộng</span>
        <span className="text-primary tabular-nums">{formatVnd(slot.totalAmount)}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-xl p-4 ring-1', warn ? 'bg-warning/15 ring-warning/50' : 'bg-surface ring-border/70')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', warn && 'text-warning')}>{value}</p>
    </div>
  )
}
