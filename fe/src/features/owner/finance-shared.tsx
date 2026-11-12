import { ChartBar } from '@/components/common/chart-bar'
import { Panel, QueryState } from '@/components/common/page'
import { ManagerStatus } from '@/features/manager/components'
import type { OwnerSummary } from '@/interfaces/owner'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { Link } from 'react-router'
import { operationsLink, useOwnerList } from './context'

export function BranchComparison({ data }: { data: OwnerSummary }) {
  const max = Math.max(1, ...data.rows.flatMap((r) => [r.billed, r.receipts]))
  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Hóa đơn & thực thu</h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            <i className="mr-1 inline-block size-2 bg-primary" />
            Đã phát hành
          </span>
          <span>
            <i className="mr-1 inline-block size-2 bg-slate-400" />
            Thực thu
          </span>
        </div>
      </div>
      {data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có chi nhánh trong phạm vi.</p>
      ) : (
        <div className="grid gap-6">
          {data.rows.map((r) => (
            <div key={r.id}>
              <Link className="text-sm font-bold text-primary" to={`/owner/branches/${r.id}`}>
                {r.name}
              </Link>
              <div className="mt-3 grid gap-2">
                {[
                  ['Đã phát hành', r.billed, 'bg-primary'],
                  ['Thực thu', r.receipts, 'bg-slate-400'],
                ].map(([label, amount, color]) => (
                  <div
                    key={String(label)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <div className="h-2 overflow-hidden rounded-sm bg-background">
                      <ChartBar className={String(color)} value={Number(amount)} max={max} />
                    </div>
                    <span className="text-xs tabular-nums">
                      <span className="sr-only">{label}: </span>
                      {formatVnd(Number(amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Kỳ {data.period}. Thực thu theo ngày xác minh, gồm tiền thuê trả trước thực nhận; không gồm
        tiền giữ phòng hoặc sandbox.
      </p>
    </Panel>
  )
}
export function Utilization({ data }: { data: OwnerSummary }) {
  return (
    <Panel>
      <h2 className="mb-5 font-bold">Tài nguyên & vận hành</h2>
      <div className="divide-y divide-border">
        {data.rows.map((r) => (
          <div key={r.id} className="py-4 first:pt-0">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="text-sm font-bold">{r.name}</h3>
              <ManagerStatus value={r.status} />
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Phòng nguyên căn (ROOM)</dt>
                <dd className="mt-1 font-bold">
                  {r.rooms.occupied} đang ở · {r.rooms.held} giữ · {r.rooms.available} trống /{' '}
                  {r.rooms.total} phòng
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chỗ ở (SLOT đang hoạt động)</dt>
                <dd className="mt-1 font-bold">
                  {r.slots.occupied} đang ở · {r.slots.held} giữ · {r.slots.available} trống ·{' '}
                  {r.slots.unavailable} không phục vụ / {r.slots.total} chỗ
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hợp đồng / sửa chữa mở</dt>
                <dd className="mt-1 font-bold">
                  {r.activeContracts} / {r.maintenanceCount}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quản lý chính</dt>
                <dd className="mt-1 font-bold">{r.managerName || 'Cần phân công'}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-primary">
              <Link to={operationsLink(r.id, 'rooms')}>Phòng và chỗ ở</Link>
              <Link to={operationsLink(r.id, 'bookings')}>Giữ phòng ({r.bookingCount})</Link>
              <Link to={operationsLink(r.id, 'debts')}>Công nợ</Link>
              <Link to={operationsLink(r.id, 'maintenance')}>Sửa chữa</Link>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Tài nguyên là trạng thái hiện tại. Hợp đồng đang hoạt động; giữ phòng theo tháng tạo yêu
        cầu.
      </p>
    </Panel>
  )
}
export function RecentOwnerActivity() {
  const query = useOwnerList('activity', { size: '4' })
  return (
    <Panel>
      <div className="mb-4 flex justify-between gap-3">
        <h2 className="font-bold">Sự kiện gần đây</h2>
        <Link className="text-sm font-bold text-primary" to="/owner/activity">
          Xem tất cả
        </Link>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.content.length === 0}
        emptyMessage="Chưa có sự kiện mới."
        emptyAction={null}
      >
        <div className="divide-y divide-border">
          {query.data?.content.map((a) => (
            <div className="py-3" key={a.id}>
              <p className="text-sm">{a.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateTime(a.at)} · {a.actorName}
              </p>
            </div>
          ))}
        </div>
      </QueryState>
    </Panel>
  )
}
