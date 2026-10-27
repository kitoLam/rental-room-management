import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { formatVnd } from '@/lib/format'
import { provider } from '@/services/config'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ActionDialog, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { managerLink, useManager, useManagerAction, useManagerQuery } from './context'

export function ManagerRoomDetail() {
  const { roomId = '' } = useParams(),
    query = useManagerQuery('room', (b) => managerApi.get(b, 'rooms', roomId), [roomId]),
    [deleting, setDeleting] = useState(false),
    { branch } = useManager(),
    navigate = useNavigate(),
    mutation = useManagerAction(() => navigate(managerLink('/manager/rooms', branch.id)))
  return (
    <ManagerPage
      title="Thông tin phòng"
      actions={<ManagerLink to="/manager/rooms">Danh sách phòng</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {query.data.code} · {query.data.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{query.data.roomTypeName}</p>
                </div>
                {provider('manager') === 'mock' && (
                  <ManagerStatus value={query.data.availability || 'UNKNOWN'} />
                )}
              </div>
              <Facts
                items={[
                  ['Hình thức', query.data.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Nguyên phòng'],
                  ['Sức chứa', `${query.data.capacity} người`],
                  ['Diện tích / tầng', `${query.data.sizeM2} m² · Tầng ${query.data.floor}`],
                  ['Giá tham khảo', formatVnd(query.data.price)],
                  ['Vận hành', <ManagerStatus value={query.data.operationalStatus} />],
                  ['Công khai', query.data.isPublic ? 'Có' : 'Không'],
                ]}
              />
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {query.data.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                <ManagerLink to={`/manager/rooms/${roomId}/edit`}>Chỉnh sửa</ManagerLink>
                {query.data.rentalMode === 'SLOT' && (
                  <ManagerLink to={`/manager/rooms/${roomId}/slots`}>Quản lý chỗ</ManagerLink>
                )}
                <ManagerLink to="/manager/tenants" params={{ roomId }}>
                  Người thuê / lịch sử
                </ManagerLink>
                <ManagerLink to="/manager/room-services" params={{ roomId }}>
                  Cấu hình dịch vụ
                </ManagerLink>
                <Button variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
                  Xóa khi đủ điều kiện
                </Button>
              </div>
            </Panel>
            <div className="grid grid-cols-3 gap-3">
              {query.data.images.map((src) => (
                <img
                  key={src}
                  className="aspect-square w-full rounded-lg object-cover"
                  src={src}
                  alt={query.data!.title}
                />
              ))}
            </div>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Xóa phòng chưa có hồ sơ liên quan?"
        open={deleting}
        onOpenChange={setDeleting}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() =>
          mutation.mutate({ resource: 'rooms', id: roomId, value: {}, method: 'DELETE' })
        }
      />
    </ManagerPage>
  )
}
