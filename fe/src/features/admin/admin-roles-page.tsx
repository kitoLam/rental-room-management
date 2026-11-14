import { Notice, QueryState } from '@/components/common/page'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { AdminPage } from './components'
import { useAdminQuery } from './context'
import { RoleChangePanel } from './role-change-panel'

export function AdminRoles() {
  const query = useAdminQuery('roles', adminApi.roles),
    [filter, setFilter] = useState('')
  return (
    <AdminPage
      title="Vai trò & quyền truy cập"
      description="Chọn một vai trò để xem phạm vi và lọc danh sách người dùng bên dưới."
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {query.data?.map((r) => {
            const active = filter === r.id
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(active ? '' : r.id)}
                className={cn(
                  'rounded-xl border bg-surface p-4 text-left shadow-sm transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary bg-primary-soft' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold">{r.name}</h2>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                    {r.userCount}
                  </span>
                </div>
                <p className="my-2 text-sm leading-6 text-muted-foreground">{r.description}</p>
                <dl className="grid gap-1 text-xs">
                  <div>
                    <dt className="inline font-bold">Phạm vi: </dt>
                    <dd className="inline text-muted-foreground">{r.scope}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Điều kiện: </dt>
                    <dd className="inline text-muted-foreground">{r.requirement}</dd>
                  </div>
                </dl>
              </button>
            )
          })}
        </div>
      </QueryState>
      {provider('adminUsers') === 'real' ? (
        <RoleChangePanel role={filter} onRole={setFilter} />
      ) : (
        <Notice>Đổi vai trò người dùng cần chế độ API thật (provider adminUsers = real).</Notice>
      )}
    </AdminPage>
  )
}
