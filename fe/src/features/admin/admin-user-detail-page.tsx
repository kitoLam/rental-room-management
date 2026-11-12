import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminQuery } from './context'
import { eventNames, roleNames } from './labels'
import { StatusAction } from './user-shared'
export function AdminUserDetail() {
  const { userId = '' } = useParams(),
    query = useAdminQuery('user', () => adminApi.user(userId), [userId]),
    activity = useAdminQuery(
      'user-activity',
      () => adminApi.list('activity', { userId, size: '5' }),
      [userId],
    ),
    [copied, setCopied] = useState(false)
  return (
    <AdminPage
      title={query.data?.fullName || 'Thông tin người dùng'}
      actions={<AdminLink to="/admin/users">Danh sách người dùng</AdminLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Mã người dùng', <span className="break-all">{query.data.id}</span>],
                  ['Email', query.data.email || 'Chưa có'],
                  ['Điện thoại', query.data.phone || 'Chưa có'],
                  ['Trạng thái', <AdminStatus value={query.data.status} />],
                  ['Ngày tạo', dateTime(query.data.createdAt)],
                  [
                    'Vai trò',
                    query.data.roles?.map((r) => roleNames[r]).join(', ') || 'API chưa cung cấp',
                  ],
                  [
                    'Xác minh chủ trọ',
                    query.data.ownerVerificationStatus ? (
                      <AdminStatus value={query.data.ownerVerificationStatus} />
                    ) : (
                      'API chưa cung cấp'
                    ),
                  ],
                  [
                    'Xác minh liên hệ',
                    query.data.contactVerified === undefined
                      ? 'API chưa cung cấp'
                      : query.data.contactVerified
                        ? 'Đã xác minh'
                        : 'Chưa xác minh',
                  ],
                ]}
              />
              <Button
                variant="ghost"
                className="mt-3"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(userId)
                    setCopied(true)
                  } catch {
                    setCopied(false)
                  }
                }}
              >
                <Copy size={16} />
                {copied ? 'Đã sao chép' : 'Sao chép mã người dùng'}
              </Button>
              <StatusAction
                key={`${userId}:${query.data.version}:${query.data.status}`}
                target={query.data}
              />
            </Panel>
            {query.data.scope && (
              <Panel>
                <h2 className="mb-4 font-bold">Phạm vi quan hệ</h2>
                <Facts
                  items={[
                    ['Chi nhánh sở hữu', String(query.data.scope.ownedBranches)],
                    ['Chi nhánh quản lý', String(query.data.scope.assignedBranches)],
                    ['Quan hệ thuê', String(query.data.scope.tenancies)],
                  ]}
                />
                <AdminLink to={`/admin/owner-verifications/${userId}`}>
                  Xem hồ sơ xác minh chủ trọ
                </AdminLink>
                <AdminLink to={`/admin/branches?ownerId=${userId}`}>
                  Danh bạ chi nhánh của tài khoản
                </AdminLink>
              </Panel>
            )}
            <Panel>
              <h2 className="mb-4 font-bold">Hoạt động quản trị liên quan</h2>
              <QueryState
                pending={activity.isPending}
                error={activity.error}
                retry={activity.refetch}
                empty={activity.data?.content.length === 0}
                emptyMessage="Chưa có sự kiện quản trị."
                emptyAction={null}
              >
                {activity.data?.content.map((a) => (
                  <div className="border-t border-border py-3" key={a.id}>
                    <AdminLink to={`/admin/activity/${a.id}`}>
                      {eventNames[a.action] || a.summary}
                    </AdminLink>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(a.occurredAt)} · {a.actorName}
                    </p>
                  </div>
                ))}
              </QueryState>
            </Panel>
          </>
        )}
      </QueryState>
    </AdminPage>
  )
}
