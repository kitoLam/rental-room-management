import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { dateTime } from '@/lib/activity'
import { adminOverviewService } from '@/services/admin-overview'
import { provider } from '@/services/config'
import { AdminLink, AdminPage } from './components'
import { AccountRoleChart, RegistrationChart, StatusBreakdown } from './admin-overview-charts'
import { roleNames as adminRoleNames } from './labels'

const accountNames = {
  ACTIVE: 'Đã kích hoạt và xác minh',
  UNVERIFIED: 'Chưa xác minh email',
  INACTIVE: 'Đã xác minh, chưa kích hoạt',
}
const branchNames = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động' }
const stockNames = {
  AVAILABLE: 'Còn trống',
  RESERVED: 'Đang giữ chỗ',
  OCCUPIED: 'Đang cho thuê',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng hoạt động',
}
const number = (value: number) => value.toLocaleString('vi-VN')

export function AdminDashboard() {
  const user = useSession((s) => s.user!)
  const [params, setParams] = useSearchParams()
  const currentYear = Number(
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(),
    ),
  )
  const rawYear = Number(params.get('year') || currentYear)
  const year =
    Number.isInteger(rawYear) && rawYear >= 1900 && rawYear <= 9998 ? rawYear : currentYear
  const years = [
    ...new Set([year, ...Array.from({ length: 6 }, (_, index) => currentYear - index)]),
  ].sort((a, b) => b - a)
  const query = useQuery({
    queryKey: ['admin', user.id, 'overview', year],
    queryFn: () => adminOverviewService.read(year),
    enabled: user.roles.includes('ADMIN'),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const data = query.data
  return (
    <AdminPage
      title="Tổng quan quản trị"
      description="Tài khoản, chi nhánh và quy mô phòng trên toàn hệ thống."
      actions={
        <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          Cập nhật số liệu
        </Button>
      }
    >
      {provider('admin') === 'mock' && <Notice>Đang xem dữ liệu demo.</Notice>}
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Tổng tài khoản', data.metrics.totalAccounts, 'Tất cả vai trò trong hệ thống'],
                [
                  'Tài khoản đã kích hoạt',
                  data.metrics.activeAccounts,
                  'Đã xác minh email và được kích hoạt',
                ],
                [
                  'Chi nhánh đang hoạt động',
                  data.metrics.activeBranches,
                  `Trên ${number(data.metrics.totalBranches)} chi nhánh`,
                ],
                [
                  'Tổng phòng',
                  data.metrics.totalRooms,
                  `${number(data.metrics.totalSlots)} slot trong hệ thống`,
                ],
              ].map(([label, value, hint]) => (
                <Panel key={String(label)}>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{number(Number(value))}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
                </Panel>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-x-4">
                  <h2 className="font-bold">Tài khoản theo vai trò</h2>
                  <AdminLink to="/admin/users">Xem người dùng</AdminLink>
                </div>
                <AccountRoleChart roles={data.roles} />
              </Panel>
              <Panel>
                <h2 className="font-bold">Tình trạng tài khoản</h2>
                <StatusBreakdown items={data.accounts} names={accountNames} />
              </Panel>
            </div>
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold">Tài khoản mới theo tháng</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Theo ngày tạo tài khoản, giờ Việt Nam. Bộ lọc năm áp dụng cho biểu đồ này.
                  </p>
                </div>
                <label className="flex items-center gap-3 text-sm font-semibold">
                  Năm
                  <select
                    className="input w-auto"
                    value={year}
                    onChange={(event) =>
                      setParams((previous) => {
                        previous.set('year', event.target.value)
                        return previous
                      })
                    }
                  >
                    {years.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <RegistrationChart months={data.registrations} year={year} />
            </Panel>
            <div className="grid gap-6 xl:grid-cols-3">
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <h2 className="font-bold">Chi nhánh</h2>
                  <AdminLink to="/admin/branches">Xem tất cả</AdminLink>
                </div>
                <StatusBreakdown items={data.branches} names={branchNames} />
              </Panel>
              <Panel>
                <h2 className="font-bold">Trạng thái phòng</h2>
                <StatusBreakdown items={data.rooms} names={stockNames} />
              </Panel>
              <Panel>
                <h2 className="font-bold">Trạng thái slot</h2>
                <StatusBreakdown items={data.slots} names={stockNames} />
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Trạng thái đang được ghi nhận của từng slot.
                </p>
              </Panel>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <h2 className="font-bold">Tài khoản mới tham gia</h2>
                  <AdminLink to="/admin/users">Xem tất cả</AdminLink>
                </div>
                {data.recentAccounts.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Chưa có tài khoản.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentAccounts.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold">{item.fullName || 'Chưa cập nhật tên'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {adminRoleNames[item.role] || item.role}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.createdAt ? dateTime(item.createdAt) : 'Chưa có ngày tạo'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <h2 className="font-bold">Chi nhánh mới tham gia</h2>
                  <AdminLink to="/admin/branches">Xem tất cả</AdminLink>
                </div>
                {data.recentBranches.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Chưa có chi nhánh.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentBranches.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold">{item.name || 'Chưa cập nhật tên'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {branchNames[item.status as keyof typeof branchNames] ||
                              'Chưa xác định'}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.createdAt ? dateTime(item.createdAt) : 'Chưa có ngày tạo'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
            <details className="rounded-lg border border-border px-5 py-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                Thống kê đăng nhập — chưa có dữ liệu
              </summary>
              <p className="mt-3 text-muted-foreground">
                Người đang online và lượt đăng nhập trong ngày sẽ hiển thị khi có dữ liệu.
              </p>
            </details>
            <p className="text-xs leading-6 text-muted-foreground">
              Số liệu hiện tại không gồm bản ghi đã xóa. Cập nhật {dateTime(data.updatedAt)}.
            </p>
          </>
        )}
      </QueryState>
    </AdminPage>
  )
}
