import { Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { AdminFilters, AdminLink, AdminPage } from './components'
import { useAdminFilters, useAdminQuery } from './context'
import { eventNames } from './labels'

export function AdminActivity() {
  const state = useAdminFilters({ type: '', from: '', to: '' }),
    query = useAdminQuery('activity', () => adminApi.list('activity', state.filters), [
      state.filters,
    ])
  return (
    <AdminPage
      title="Nhật ký hoạt động"
      description="Sự kiện quản trị được phép, chỉ đọc và không chứa bí mật xác thực."
    >
      <AdminFilters state={state} dates>
        <select
          aria-label="Loại sự kiện"
          className="input w-auto max-w-full"
          value={state.filters.type}
          onChange={(e) => state.change('type', e.target.value)}
        >
          <option value="">Mọi sự kiện</option>
          {Object.entries(eventNames).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </AdminFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có sự kiện phù hợp."
        columns={[
          {
            label: 'Sự kiện',
            render: (a) => (
              <AdminLink to={`/admin/activity/${a.id}`}>
                {eventNames[a.action] || a.summary}
              </AdminLink>
            ),
          },
          { label: 'Người thực hiện', render: (a) => a.actorName },
          { label: 'Nội dung', render: (a) => a.summary },
          { label: 'Thời gian', render: (a) => dateTime(a.occurredAt) },
        ]}
      />
    </AdminPage>
  )
}
