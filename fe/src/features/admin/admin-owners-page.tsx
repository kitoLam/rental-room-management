import { Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { AdminFilters, AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminFilters, useAdminQuery } from './context'

export function AdminOwners() {
  const state = useAdminFilters({ status: '' }),
    query = useAdminQuery('owners', () => adminApi.list('owners', state.filters), [state.filters])
  return (
    <AdminPage
      title="Danh bạ chủ trọ"
      description="Tài khoản có vai trò OWNER; trạng thái xác minh và tài khoản được theo dõi riêng."
    >
      <AdminFilters state={state} statuses={['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']} />
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chủ trọ phù hợp."
        columns={[
          {
            label: 'Chủ trọ',
            render: (u) => <AdminLink to={`/admin/users/${u.id}`}>{u.fullName}</AdminLink>,
          },
          {
            label: 'Liên hệ',
            render: (u) => <span className="break-all">{u.email || u.phone || 'Chưa có'}</span>,
          },
          { label: 'Tài khoản', render: (u) => <AdminStatus value={u.status} /> },
          {
            label: 'Xác minh',
            render: (u) => (
              <AdminLink to={`/admin/owner-verifications/${u.id}`}>
                <AdminStatus value={u.ownerVerificationStatus || 'NOT_SUBMITTED'} />
              </AdminLink>
            ),
          },
          {
            label: 'Chi nhánh',
            render: (u) => (
              <AdminLink to={`/admin/branches?ownerId=${u.id}`}>
                {u.scope?.ownedBranches || 0} chi nhánh
              </AdminLink>
            ),
          },
          {
            label: 'Ngày xét duyệt',
            render: (u) => (u.ownerReviewedAt ? dateTime(u.ownerReviewedAt) : 'Chưa có'),
          },
        ]}
      />
    </AdminPage>
  )
}
