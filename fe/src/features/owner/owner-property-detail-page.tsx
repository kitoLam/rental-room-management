import { useProperty } from './hooks/use-property'
import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { databaseIdSchema } from '@/interfaces/domain'
import { formatVnd } from '@/lib/format'
import { ownerProperties, propertyTypes } from '@/services/owner-properties'
import { useQuery } from '@tanstack/react-query'
import { DoorOpen, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { OwnerPage } from './components'
import { BackToBranches } from './property-shared'
export function OwnerPropertyDetail() {
  const { branchId = '' } = useParams(),
    userId = useSession((s) => s.user?.id)
  const query = useProperty(branchId)
  const rooms = useQuery({
    queryKey: ['owner-property-rooms', userId, branchId],
    queryFn: () => ownerProperties.rooms(branchId),
    enabled: !!query.data,
    retry: false,
  })
  const branch = query.data
  const registered = !!branch?.propertyType && !!branch?.declaredRoomCount
  const full =
    !!branch && branch.declaredRoomCount !== null && branch.roomCount >= branch.declaredRoomCount
  return (
    <OwnerPage
      title={branch?.name || 'Chi nhánh'}
      description={branch?.address}
      actions={<BackToBranches />}
    >
      {!databaseIdSchema.safeParse(branchId).success && (
        <Notice>Liên kết chi nhánh không hợp lệ.</Notice>
      )}
      <QueryState
        pending={query.isPending && databaseIdSchema.safeParse(branchId).success}
        error={query.error}
        retry={query.refetch}
      >
        {branch && (
          <>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {branch.propertyType
                      ? propertyTypes[branch.propertyType]
                      : 'Chưa khai báo loại hình'}
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {branch.roomCount} / {branch.declaredRoomCount ?? '—'} phòng đã đăng ký
                  </p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {branch.description}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to={`/owner/branches/${branchId}/edit`}>Sửa thông tin chi nhánh</Link>
                </Button>
              </div>
            </Panel>
            {!registered && (
              <Notice>
                Hoàn tất loại hình và tổng số phòng trong thông tin chi nhánh trước khi thêm phòng.
              </Notice>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Các phòng trong chi nhánh</h2>
              {registered && !full ? (
                <Button asChild>
                  <Link to={`/owner/branches/${branchId}/rooms/new`}>
                    <Plus />
                    Đăng ký phòng
                  </Link>
                </Button>
              ) : (
                <Button disabled>
                  <Plus />
                  Đăng ký phòng
                </Button>
              )}
            </div>
            {full && (
              <Notice>
                Đã đăng ký đủ số phòng khai báo. Nếu chi nhánh có thêm phòng, hãy cập nhật tổng số
                phòng trước.
              </Notice>
            )}
            <QueryState
              pending={rooms.isPending}
              error={rooms.error}
              retry={rooms.refetch}
              empty={rooms.data?.length === 0}
              emptyMessage="Chi nhánh chưa có phòng. Đăng ký phòng đầu tiên để bắt đầu."
            >
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {rooms.data?.map((r) => (
                  <Panel key={r.id} className="flex flex-col">
                    <div className="mb-4 flex items-center justify-between">
                      <DoorOpen className="text-primary" />
                      <span className="rounded-lg bg-primary-soft px-3 py-1 text-xs text-primary">
                        {r.isPublic ? 'Công khai' : 'Chưa công khai'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold">Phòng {r.code}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {r.rentalMode === 'ROOM' ? 'Nguyên phòng' : 'Theo chỗ'} · {r.capacity} người
                      {r.areaSqm !== null ? ` · ${r.areaSqm} m²` : ''}
                    </p>
                    <p className="mt-4 text-lg font-bold text-primary">
                      {formatVnd(r.referencePrice)}
                      <span className="text-xs font-normal">
                        {' '}
                        / {r.rentalMode === 'SLOT' ? 'chỗ / ' : ''}tháng
                      </span>
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {r.operationalStatus === 'MAINTENANCE'
                        ? 'Đang bảo trì'
                        : r.operationalStatus === 'INACTIVE'
                          ? 'Ngừng hoạt động'
                          : 'Đang hoạt động'}
                    </p>
                    {r.isPublic && (
                      <Link to={`/rooms/${r.id}`} className="mt-5 text-sm font-bold text-primary">
                        Xem trang phòng ↗
                      </Link>
                    )}
                  </Panel>
                ))}
              </div>
            </QueryState>
          </>
        )}
      </QueryState>
    </OwnerPage>
  )
}
