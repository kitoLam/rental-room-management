import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { useState } from 'react'
import { useParams } from 'react-router'
import { AdminLink, AdminPage } from './components'
import { useAdminQuery } from './context'
import { eventNames, statusNames } from './labels'

export function AdminAuditDetail() {
  const { eventId = '' } = useParams(),
    query = useAdminQuery('audit', () => adminApi.event(eventId), [eventId]),
    [copy, setCopy] = useState(false)
  return (
    <AdminPage
      title="Chi tiết sự kiện"
      actions={<AdminLink to="/admin/activity">Về nhật ký</AdminLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <Panel>
            <Facts
              items={[
                ['Mã audit', <span className="break-all">{query.data.id}</span>],
                ['Người thực hiện', query.data.actorName],
                [
                  'Mã người thực hiện',
                  <span className="break-all">{query.data.actorUserId || 'Hệ thống'}</span>,
                ],
                [
                  'Tài nguyên',
                  query.data.tableName === 'users'
                    ? 'Tài khoản'
                    : query.data.tableName === 'branches'
                      ? 'Chi nhánh'
                      : 'Quan hệ quản lý',
                ],
                ['Mã tài nguyên', <span className="break-all">{query.data.entityId}</span>],
                ['Hành động', eventNames[query.data.action] || query.data.summary],
                ['Nội dung', query.data.summary],
                ['Lý do', query.data.reason || 'Không có ghi chú'],
                ['Thời gian', dateTime(query.data.occurredAt)],
                [
                  'Mã yêu cầu',
                  <span className="break-all">
                    {query.data.requestKey || 'Không được cung cấp'}
                  </span>,
                ],
                ...Object.entries(query.data.detail).map(([key, value]): [string, string] => [
                  {
                    previousStatus: 'Trạng thái trước',
                    status: 'Trạng thái sau',
                    verificationStatus: 'Kết quả xác minh',
                    provisionedOwner: 'Cấp quyền qua danh tính',
                    branchName: 'Chi nhánh',
                  }[key] || 'Thông tin',
                  typeof value === 'boolean'
                    ? value
                      ? 'Có'
                      : 'Không'
                    : statusNames[String(value)] || String(value),
                ]),
              ]}
            />
            <div className="mt-5 flex flex-wrap gap-4">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(eventId)
                    setCopy(true)
                  } catch {
                    setCopy(false)
                  }
                }}
              >
                {copy ? 'Đã sao chép' : 'Sao chép mã audit'}
              </Button>
              <AdminLink
                to={
                  query.data.tableName === 'users'
                    ? `/admin/users/${query.data.entityId}`
                    : '/admin/branches'
                }
              >
                Mở tài nguyên liên quan
              </AdminLink>
            </div>
          </Panel>
        )}
      </QueryState>
    </AdminPage>
  )
}
