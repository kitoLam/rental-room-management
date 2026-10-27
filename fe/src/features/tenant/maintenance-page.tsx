import { Pagination, Panel, QueryState } from '@/components/common/page'
import { dateTime } from '@/lib/activity'
import { tenantApi } from '@/services/tenant'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { TenantLink, TenantPage, TenantStatus } from './components'
import { isActive, tenantLink, useTenant, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'

export function MaintenancePage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('maintenance', tenantApi.reports, [], true),
    [state, setState] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1)
  const rows = (query.data || []).filter(
      (r) => (!state || r.status === state) && (!category || r.category === category),
    ),
    pages = Math.ceil(rows.length / 6),
    current = Math.min(page, Math.max(1, pages))
  return (
    <TenantPage
      title="Bảo trì & sửa chữa"
      description="Gửi báo hỏng, theo dõi lịch xử lý và kết quả sửa chữa."
      actions={
        isActive(t) ? (
          <TenantLink to="/tenant/maintenance/new" button>
            <Plus size={17} />
            Báo hỏng
          </TenantLink>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Lọc trạng thái bảo trì"
          className="input w-auto"
          value={state}
          onChange={(e) => {
            setState(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {tenantStatusLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Loại báo hỏng"
          className="input w-auto"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="FURNITURE">Nội thất</option>
          <option value="SERVICE">Dịch vụ</option>
        </select>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có yêu cầu bảo trì phù hợp."
        emptyAction={
          isActive(t) ? (
            <TenantLink to="/tenant/maintenance/new" button>
              Tạo yêu cầu
            </TenantLink>
          ) : null
        }
      >
        <Panel>
          {rows.slice((current - 1) * 6, current * 6).map((r) => (
            <Link
              key={r.id}
              to={tenantLink(`/tenant/maintenance/${r.id}`, t)}
              className="flex flex-wrap items-start justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <h2 className="break-words text-sm font-bold text-primary">{r.title}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.assetName} · {dateTime(r.createdAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ưu tiên {tenantStatusLabel(r.priority).toLowerCase()}
                </p>
              </div>
              <TenantStatus value={r.status} />
            </Link>
          ))}
        </Panel>
        <Pagination page={current} totalPages={pages} onPage={setPage} />
      </QueryState>
    </TenantPage>
  )
}
