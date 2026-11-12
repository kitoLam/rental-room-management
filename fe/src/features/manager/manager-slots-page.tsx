import { InlineError, Modal, Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { slotInputSchema, type ManagerSlot } from '@/interfaces/manager'
import { dateOnly } from '@/lib/activity'
import { provider } from '@/services/config'
import { managerApi } from '@/services/manager'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ManagerForm, ManagerLink, ManagerPage, ManagerStatus, Records } from './components'
import { useManagerAction, useManagerList, useManagerQuery } from './context'

export function ManagerSlots() {
  const { roomId = '' } = useParams(),
    query = useManagerList('slots', { roomId, size: '100' }),
    room = useManagerQuery('room', (b) => managerApi.get(b, 'rooms', roomId), [roomId]),
    [selected, setSelected] = useState<ManagerSlot | null | undefined>(undefined),
    [from, setFrom] = useState(new Date().toISOString().slice(0, 10)),
    [to, setTo] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
    availability = useManagerList(
      'slots',
      provider('manager') === 'mock'
        ? { roomId, size: '100', startDate: from, endDate: to }
        : { roomId, size: '100' },
    ),
    mutation = useManagerAction(() => setSelected(undefined))
  return (
    <ManagerPage
      title="Chỗ ở trong phòng"
      description={room.data?.title}
      actions={<ManagerLink to={`/manager/rooms/${roomId}`}>Về phòng</ManagerLink>}
    >
      <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
        {room.data?.rentalMode === 'ROOM' ? (
          <Notice>Phòng nguyên căn không có danh sách chỗ thuê SLOT.</Notice>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              {provider('manager') === 'mock' && (
                <>
                  <div>
                    <label className="mb-2 block text-xs" htmlFor="slot-from">
                      Từ ngày
                    </label>
                    <input
                      id="slot-from"
                      type="date"
                      className="input"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs" htmlFor="slot-to">
                      Đến ngày (không gồm)
                    </label>
                    <input
                      id="slot-to"
                      type="date"
                      className="input"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Button onClick={() => setSelected(null)}>
                <Plus size={16} />
                Thêm chỗ
              </Button>
            </div>
            <Records
              query={availability}
              page={1}
              onPage={() => undefined}
              columns={[
                {
                  label: 'Chỗ ở',
                  render: (s) => (
                    <button
                      className="min-h-11 text-left font-bold text-primary"
                      onClick={() => setSelected(s)}
                    >
                      {s.code} · {s.name}
                    </button>
                  ),
                },
                ...(provider('manager') === 'real'
                  ? [
                      {
                        label: 'Trạng thái vận hành',
                        render: (s: ManagerSlot) => <ManagerStatus value={s.operationalStatus} />,
                      },
                    ]
                  : []),
                ...(provider('manager') === 'mock'
                  ? [
                      {
                        label: 'Khả dụng',
                        render: (s: ManagerSlot) => (
                          <ManagerStatus value={s.availability || 'UNKNOWN'} />
                        ),
                      },
                    ]
                  : []),
                ...(provider('manager') === 'mock'
                  ? [
                      {
                        label: 'Cư trú / lịch sử',
                        render: (s: ManagerSlot) => (
                          <div className="grid gap-2">
                            {s.occupancy?.length
                              ? s.occupancy!.map((o) => (
                                  <div key={o.id}>
                                    <ManagerLink to={`/manager/tenancies/${o.id}`}>
                                      {o.name}
                                    </ManagerLink>
                                    <p className="text-xs text-muted-foreground">
                                      {dateOnly(o.startDate)} – {dateOnly(o.endDate)} ·{' '}
                                      <ManagerStatus value={o.status} />
                                    </p>
                                  </div>
                                ))
                              : 'Chưa có cư trú'}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              empty="Phòng chưa có chỗ. Thêm chỗ trong giới hạn sức chứa."
            />
          </>
        )}
      </QueryState>
      <Modal
        title={selected ? 'Chỉnh sửa chỗ' : 'Thêm chỗ'}
        open={selected !== undefined}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setSelected(undefined)
        }}
      >
        {selected !== undefined && (
          <ManagerForm
            schema={slotInputSchema}
            defaults={
              selected ? { ...selected } : { code: '', name: '', operationalStatus: 'ACTIVE' }
            }
            fields={[
              { name: 'code', label: 'Mã chỗ' },
              { name: 'name', label: 'Tên chỗ' },
              {
                name: 'operationalStatus',
                label: 'Vận hành',
                kind: 'select',
                options: [
                  { value: 'ACTIVE', label: 'Hoạt động' },
                  { value: 'MAINTENANCE', label: 'Bảo trì' },
                  { value: 'INACTIVE', label: 'Ngừng sử dụng' },
                ],
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'slots',
                id: selected?.id,
                value: { ...value, roomId },
                method: selected ? 'PATCH' : 'POST',
              })
            }
          />
        )}
      </Modal>
      <InlineError error={query.error} />
    </ManagerPage>
  )
}
