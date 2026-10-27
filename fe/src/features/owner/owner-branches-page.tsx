import { InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ManagerStatus, Records } from '@/features/manager/components'
import { Link } from 'react-router'
import { OwnerFilters, OwnerPage } from './components'
import { operationsLink, useOwnerFilters, useOwnerList } from './context'

export function OwnerBranches() {
  const state = useOwnerFilters({ managerId: '' }),
    query = useOwnerList('branches', state.filters),
    managers = useOwnerList('managers', { size: '100' })
  return (
    <OwnerPage
      title="Chi nhánh"
      description="Thông tin tài sản và trạng thái vận hành."
      actions={
        <Button asChild>
          <Link to="/owner/branches/new">Tạo chi nhánh</Link>
        </Button>
      }
    >
      <OwnerFilters
        state={state}
        statuses={[
          { value: 'DRAFT', label: 'Nháp' },
          { value: 'ACTIVE', label: 'Hoạt động' },
          { value: 'INACTIVE', label: 'Ngừng hoạt động' },
        ]}
      >
        <select
          aria-label="Lọc quản lý"
          className="input w-auto max-w-full"
          value={state.filters.managerId}
          onChange={(e) => state.change('managerId', e.target.value)}
        >
          <option value="">Tất cả quản lý</option>
          {managers.data?.content.map((m) => (
            <option value={m.id} key={m.id}>
              {m.user.fullName}
            </option>
          ))}
        </select>
      </OwnerFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chi nhánh phù hợp."
        columns={[
          {
            label: 'Chi nhánh',
            render: (b) => (
              <Link className="font-bold text-primary" to={`/owner/branches/${b.id}`}>
                {b.name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {b.code} · {b.address}
                </span>
              </Link>
            ),
          },
          { label: 'Trạng thái', render: (b) => <ManagerStatus value={b.status} /> },
          { label: 'Quản lý', render: (b) => b.managerName || 'Chưa phân công' },
          {
            label: 'Phòng / công khai',
            render: (b) => `${b.roomCount} phòng · ${b.isPublic ? 'Công khai' : 'Riêng tư'}`,
          },
          {
            label: 'Vận hành',
            render: (b) => (
              <Link className="font-bold text-primary" to={operationsLink(b.id)}>
                Mở vận hành
              </Link>
            ),
          },
        ]}
      />
      <InlineError error={managers.error} />
    </OwnerPage>
  )
}
