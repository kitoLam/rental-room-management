import { Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { Link } from 'react-router'
import { AdminFilters, AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminFilters, useAdminQuery } from './context'
import { roleNames } from './labels'

export function AdminUsers() {
  const state = useAdminFilters({ status: '', role: '', from: '', to: '' }),
    real = provider('adminUsers') === 'real',
    query = useAdminQuery('users', () => adminApi.users(state.filters), [state.filters])
  return (
    <AdminPage
      title="Người dùng"
      description="Quản lý danh tính và trạng thái tài khoản."
      actions={
        <Button asChild>
          <Link to="/admin/users/new">Mời người dùng</Link>
        </Button>
      }
    >
      {real && (
        <Notice>
          API hiện hỗ trợ phân trang. Tìm kiếm, lọc vai trò và ngày trên toàn bộ dữ liệu chưa được
          Backend cung cấp.
        </Notice>
      )}
      <AdminFilters
        state={state}
        search={!real}
        statuses={real ? [] : ['INVITED', 'PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED']}
        dates={!real}
      >
        {!real && (
          <select
            className="input w-auto"
            aria-label="Lọc vai trò"
            value={state.filters.role}
            onChange={(e) => state.change('role', e.target.value)}
          >
            <option value="">Mọi vai trò</option>
            {['USER', 'TENANT', 'MANAGER', 'OWNER', 'ADMIN'].map((r) => (
              <option value={r} key={r}>
                {roleNames[r]}
              </option>
            ))}
          </select>
        )}
      </AdminFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có người dùng phù hợp."
        columns={[
          {
            label: 'Người dùng',
            render: (u) => <AdminLink to={`/admin/users/${u.id}`}>{u.fullName}</AdminLink>,
          },
          {
            label: 'Liên hệ',
            render: (u) => (
              <>
                <p className="break-all">{u.email || 'Chưa có email'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.phone || 'Chưa có điện thoại'}
                </p>
              </>
            ),
          },
          { label: 'Trạng thái', render: (u) => <AdminStatus value={u.status} /> },
          {
            label: 'Vai trò',
            render: (u) => u.roles?.map((r) => roleNames[r]).join(', ') || 'Chưa được API cung cấp',
          },
          { label: 'Ngày tạo', render: (u) => dateTime(u.createdAt) },
        ]}
      />
    </AdminPage>
  )
}
