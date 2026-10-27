import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ActionDialog, ManagerStatus } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { ownerApi } from '@/services/owner'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { OwnerPage } from './components'
import { useOwnerMutation, useOwnerQuery } from './context'

export function OwnerManagerDetail() {
  const { managerId = '' } = useParams(),
    query = useOwnerQuery('manager', () => ownerApi.manager(managerId), [managerId]),
    [remove, setRemove] = useState(false),
    navigate = useNavigate(),
    mutation = useOwnerMutation(() => navigate('/owner/managers'))
  return (
    <OwnerPage title={query.data?.user.fullName || 'Thông tin quản lý'}>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Email', query.data.user.email],
                  ['Điện thoại', query.data.user.phone || 'Chưa cập nhật'],
                  ['Tài khoản', <ManagerStatus value={query.data.user.status} />],
                  ['Quan hệ', 'Đang thuộc chủ trọ'],
                  ['Ngày liên kết', dateTime(query.data.assignedAt)],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-4">
                <Button asChild>
                  <Link to="/owner/manager-assignments">Phân công / chuyển chi nhánh</Link>
                </Button>
                <Button variant="outline" onClick={() => setRemove(true)}>
                  Kết thúc quan hệ quản lý
                </Button>
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Chi nhánh phụ trách</h2>
              {query.data.branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có phân công.</p>
              ) : (
                <div className="divide-y divide-border">
                  {query.data.branches.map((b) => (
                    <div className="flex flex-wrap justify-between gap-3 py-4" key={b.id}>
                      <Link
                        className="text-sm font-bold text-primary"
                        to={`/owner/branches/${b.id}`}
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.assignedAt ? dateTime(b.assignedAt) : 'Đã phân công'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Notice>
              Kết thúc quan hệ chỉ thu hồi quyền trong phạm vi chủ trọ; không khóa tài khoản dùng
              chung. Xem thay đổi phân công tại{' '}
              <Link className="underline" to="/owner/activity?type=ASSIGNMENT">
                nhật ký hoạt động
              </Link>
              .
            </Notice>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Kết thúc quan hệ quản lý?"
        open={remove}
        onOpenChange={setRemove}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(v) =>
          mutation.mutate({ path: `/managers/${managerId}`, value: v, method: 'DELETE' })
        }
      />
    </OwnerPage>
  )
}
