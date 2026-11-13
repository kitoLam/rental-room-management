import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { managerApi } from '@/services/manager'
import { roomSlotsApi, type RoomSlotUsage } from '@/services/room-slots'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Lock } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ManagerLink, ManagerPage } from './components'
import { useManagerQuery } from './context'

const statusLabel: Record<RoomSlotUsage['status'], string> = {
  AVAILABLE: 'Sẵn sàng',
  OCCUPIED: 'Đang ở',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng',
}

const today = () => new Date().toLocaleDateString('en-CA')
const dayLabel = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—')

/** Slots of a room: who holds what, and the manually editable "rentable from" date of free slots. */
export function ManagerSlots() {
  const { roomId = '' } = useParams()
  const queryClient = useQueryClient()
  const room = useManagerQuery('room', (b) => managerApi.get(b, 'rooms', roomId), [roomId])
  const slots = useQuery({ queryKey: ['room-slots', roomId], queryFn: () => roomSlotsApi.list(roomId) })
  const [editing, setEditing] = useState<RoomSlotUsage | null>(null)
  const [date, setDate] = useState('')
  const save = useMutation({
    mutationFn: () => roomSlotsApi.setAvailableFrom(roomId, editing!.id, date),
    onSuccess: () => {
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ['room-slots', roomId] })
    },
  })
  const close = () => {
    if (save.isPending) return
    setEditing(null)
    save.reset()
  }
  const free = slots.data?.filter((s) => !s.busy).length ?? 0

  return (
    <ManagerPage
      title="Chỗ ở trong phòng"
      description={
        room.data
          ? `Phòng ${room.data.code} · ${room.data.title}. Chỉnh ngày bắt đầu cho thuê của các chỗ còn trống.`
          : undefined
      }
      actions={<ManagerLink to={`/manager/rooms/${roomId}`}>Về phòng</ManagerLink>}
    >
      <QueryState pending={slots.isPending} error={slots.error} retry={slots.refetch}>
        {slots.data && (
          <>
            <Notice>
              {free} / {slots.data.length} chỗ đang trống. Ngày bắt đầu cho thuê chỉ chỉnh được khi chỗ chưa có ai ở, giữ
              chỗ hay chờ hợp đồng.
            </Notice>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {slots.data.map((slot) => (
                <Panel key={slot.id} className={cn('flex flex-col gap-3 p-5 sm:p-5', slot.busy && 'bg-muted/30')}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">Chỗ {slot.slotCode}</h2>
                    <StatusBadge tone={slot.busy ? 'warning' : slot.status === 'AVAILABLE' ? 'success' : 'neutral'}>
                      {slot.busy ? 'Đang bận' : statusLabel[slot.status]}
                    </StatusBadge>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Cho thuê từ</p>
                    <p className="text-base font-semibold">{dayLabel(slot.availableFrom)}</p>
                  </div>
                  {slot.busy ? (
                    <p className="mt-auto flex items-start gap-2 rounded-lg bg-warning/15 p-3 text-sm">
                      <Lock size={16} className="mt-0.5 shrink-0 text-warning" />
                      Chỗ này {slot.busyReason}, không chỉnh được ngày.
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-auto"
                      onClick={() => {
                        setDate(slot.availableFrom && slot.availableFrom >= today() ? slot.availableFrom : today())
                        setEditing(slot)
                      }}
                    >
                      <CalendarClock size={16} />
                      Chỉnh ngày cho thuê
                    </Button>
                  )}
                </Panel>
              ))}
            </div>
          </>
        )}
      </QueryState>
      <Modal
        open={!!editing}
        onOpenChange={(open) => !open && close()}
        title={editing ? `Ngày cho thuê chỗ ${editing.slotCode}` : 'Ngày cho thuê'}
        description="Khách chỉ đặt được chỗ này từ ngày bạn chọn."
      >
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Cho thuê từ ngày</span>
            <input type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <InlineError error={save.error} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={save.isPending} onClick={close}>
              Huỷ
            </Button>
            <Button loading={save.isPending} disabled={!date || date < today()} onClick={() => save.mutate()}>
              Lưu
            </Button>
          </div>
        </div>
      </Modal>
    </ManagerPage>
  )
}
