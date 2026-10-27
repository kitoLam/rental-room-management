import { Modal } from '@/components/common/page'
import { Records } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { useState } from 'react'
import { AdminFilters, AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminFilters, useAdminQuery } from './context'

export function AdminBranches() {
  const state = useAdminFilters({ status: '', province: '', ownerId: '' }),
    query = useAdminQuery('branches', () => adminApi.list('branches', state.filters), [
      state.filters,
    ]),
    [selected, setSelected] = useState<string | null>(null),
    branch = query.data?.content.find((b) => b.id === selected)
  return (
    <AdminPage
      title="Danh bạ chi nhánh"
      description="Thông tin hành chính cơ bản. Cấu hình và nghiệp vụ do chủ trọ/quản lý có quyền thực hiện."
    >
      <AdminFilters state={state} statuses={['DRAFT', 'ACTIVE', 'INACTIVE']}>
        <input
          aria-label="Lọc tỉnh thành"
          className="input w-auto max-w-full"
          placeholder="Tỉnh / thành phố"
          value={state.filters.province}
          onChange={(e) => state.change('province', e.target.value)}
        />
        <input
          aria-label="Mã chủ trọ"
          className="input w-auto max-w-full"
          placeholder="Mã chủ trọ"
          value={state.filters.ownerId}
          onChange={(e) => state.change('ownerId', e.target.value)}
        />
      </AdminFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chi nhánh phù hợp."
        columns={[
          {
            label: 'Chi nhánh',
            render: (b) => (
              <button
                className="min-h-11 text-left text-sm font-bold text-primary"
                onClick={() => setSelected(b.id)}
              >
                {b.name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {b.code}
                </span>
              </button>
            ),
          },
          { label: 'Địa chỉ', render: (b) => b.address },
          { label: 'Trạng thái', render: (b) => <AdminStatus value={b.status} /> },
          {
            label: 'Chủ trọ',
            render: (b) => <AdminLink to={`/admin/users/${b.ownerId}`}>{b.ownerName}</AdminLink>,
          },
          { label: 'Quản lý', render: (b) => b.managerName || 'Chưa phân công' },
        ]}
      />
      <Modal
        title="Thông tin hành chính chi nhánh"
        open={!!branch}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {branch && (
          <>
            <Facts
              items={[
                ['Mã chi nhánh', <span className="break-all">{branch.id}</span>],
                ['Code', branch.code],
                ['Tên', branch.name],
                ['Địa chỉ', branch.address],
                ['Tỉnh / thành phố', branch.province || 'Chưa cung cấp'],
                ['Trạng thái', <AdminStatus value={branch.status} />],
                ['Chủ trọ', branch.ownerName],
                ['Quản lý', branch.managerName || 'Chưa phân công'],
                [
                  'Ngày tạo',
                  branch.createdAt ? dateTime(branch.createdAt) : 'Nguồn dữ liệu chưa cung cấp',
                ],
              ]}
            />
            <AdminLink to={`/admin/users/${branch.ownerId}`}>Xem tài khoản chủ trọ</AdminLink>
          </>
        )}
      </Modal>
    </AdminPage>
  )
}
