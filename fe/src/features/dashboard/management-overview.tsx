import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ChartBar } from '@/components/common/chart-bar'
import { formatVnd } from '@/lib/format'
import { useSession } from '@/features/auth/session-store'
import { dashboardService } from '@/services/dashboard'
import { viewingDateTime } from '@/features/leasing/viewing-time'

function currentMonth() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`
}
function date(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}
function time(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
function Phone({ value }: { value: string | null }) {
  return value ? (
    <a
      className="inline-flex min-h-9 items-center font-semibold text-primary hover:underline"
      href={`tel:${value}`}
    >
      {value}
    </a>
  ) : (
    <span className="text-sm text-muted-foreground">Chưa có số điện thoại</span>
  )
}
function Empty({ children }: { children: string }) {
  return <p className="py-5 text-sm leading-6 text-muted-foreground">{children}</p>
}

export function ManagementOverview({
  role,
  branchId,
}: {
  role: 'manager' | 'owner'
  branchId?: string
}) {
  const userId = useSession((s) => s.user?.id)
  const [month, setMonth] = useState(currentMonth)
  const [expirySelection, setExpirySelection] = useState({ branchId, page: 0 })
  const expiringPage = expirySelection.branchId === branchId ? expirySelection.page : 0
  const [activitySelection, setActivitySelection] = useState({ branchId, page: 0 })
  const activityPage = activitySelection.branchId === branchId ? activitySelection.page : 0
  const query = useQuery({
    queryKey: [
      'management-overview',
      userId,
      role,
      branchId || '',
      month,
      expiringPage,
      activityPage,
    ],
    queryFn: () => dashboardService.overview(role, month, branchId, expiringPage, activityPage),
    enabled: !!userId,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 15_000,
  })
  const data = query.data
  const operationalBranch =
    branchId || (data?.branchOptions.length === 1 ? data.branchOptions[0].id : undefined)
  function managementLink(path: string, id?: string, status?: string | null) {
    const params = new URLSearchParams()
    if (id) params.set('branchId', id)
    if (role === 'owner') params.set('workspace', 'owner')
    if (status) params.set('status', status)
    const target =
      role === 'owner' && path.startsWith('/manager/') ? path.replace('/manager/', '/owner/') : path
    return `${target}${params.size ? `?${params}` : ''}`
  }
  function page(value: number) {
    setExpirySelection({ branchId, page: value })
  }
  const occupancy = data?.slots.operational
    ? Math.round((data.slots.occupied * 100) / data.slots.operational)
    : 0
  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            {role === 'owner' ? 'KHÔNG GIAN CHỦ TRỌ' : 'VẬN HÀNH CHI NHÁNH'}
          </p>
          <h1 className="text-page-title font-bold tracking-tight">
            Tổng quan {role === 'owner' ? 'chủ trọ' : 'chi nhánh'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tình trạng cho thuê, công việc đang chờ và những mốc cần chú ý.
          </p>
        </div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {query.isFetching ? 'Đang cập nhật…' : 'Cập nhật số liệu'}
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface p-4">
        <label
          className="flex flex-wrap items-center gap-3 text-sm font-semibold"
          htmlFor="overview-month"
        >
          Tháng thu tiền
          <input
            id="overview-month"
            aria-label="Tháng thu tiền"
            className="input w-auto"
            type="month"
            value={month}
            min="1900-01"
            max="9999-12"
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value)
            }}
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          Phòng, người thuê và công việc phản ánh hiện tại
          {data ? ` · Ngày ${date(data.asOfDate)}` : ''}.
        </p>
      </div>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {data && (
          <>
            {data.branchOptions.length === 0 && (
              <Panel>
                <Empty>Bạn chưa được phân công hoặc chưa sở hữu chi nhánh nào.</Empty>
              </Panel>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  'Chỗ đang cho thuê',
                  `${data.metrics.occupiedSlots} chỗ`,
                  `${occupancy}% trên ${data.slots.operational} chỗ đang vận hành`,
                ],
                [
                  'Chỗ còn trống',
                  `${data.metrics.availableSlots} chỗ`,
                  `${data.slots.held} chỗ đang giữ / chờ nhận`,
                ],
                [
                  'Người thuê đang ở',
                  `${data.metrics.activeTenants} người`,
                  'Không đếm trùng một người trong cùng phạm vi',
                ],
                [
                  'Tiền đã thu trong tháng',
                  formatVnd(data.metrics.receipts),
                  `Thanh toán hóa đơn ghi nhận trong tháng ${data.period}`,
                ],
              ].map(([label, value, hint]) => (
                <Panel key={label} className="sm:p-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-3 break-words text-2xl font-bold tabular-nums tracking-tight">
                    {value}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
                </Panel>
              ))}
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              Tiền thu chỉ gồm thanh toán hóa đơn thành công, theo ngày thanh toán; không cộng cọc
              giữ chỗ hoặc giao dịch đã hoàn tiền. Giao dịch sandbox, nếu có trong dữ liệu, vẫn là
              dữ liệu thử nghiệm.
            </p>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <h2 className="text-lg font-bold">Việc cần xử lý</h2>
                <p className="mb-4 mt-1 text-sm leading-6 text-muted-foreground">
                  Chỉ tính những bước cần Owner/Manager thao tác.
                </p>
                {!operationalBranch && (
                  <p className="mb-3 text-xs leading-5 text-muted-foreground">
                    Chọn chi nhánh trong bảng bên dưới để mở đúng danh sách xử lý.
                  </p>
                )}
                <ul className="divide-y divide-border/70">
                  {data.pending.map((item) => (
                    <li key={item.key}>
                      <Link
                        className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm hover:text-primary focus-visible:outline-primary"
                        to={
                          operationalBranch
                            ? managementLink(item.route, operationalBranch, item.status)
                            : '#overview-branches'
                        }
                      >
                        <span>{item.label}</span>
                        <span className="text-lg font-bold tabular-nums">{item.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">Tình trạng khai thác chỗ</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {data.slots.total} chỗ tổng cộng
                  </span>
                </div>
                <div className="space-y-4">
                  {[
                    ['Đang cho thuê', data.slots.occupied],
                    ['Đang giữ / chờ nhận', data.slots.held],
                    ['Còn trống', data.slots.available],
                    ['Bảo trì', data.slots.maintenance],
                    ['Ngừng hoạt động', data.slots.inactive],
                  ].map(([label, count]) => (
                    <div key={label}>
                      <div className="mb-2 flex justify-between gap-3 text-sm">
                        <span>{label}</span>
                        <span className="font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded bg-background">
                        <ChartBar
                          className="bg-primary/70"
                          value={Number(count)}
                          max={data.slots.total}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs leading-6 text-muted-foreground">
                  Tỷ lệ lấp đầy = chỗ đang thuê / chỗ đang vận hành. Chỗ bảo trì, ngừng hoạt động
                  được loại khỏi mẫu số.
                </p>
              </Panel>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">Các hoạt động hôm nay</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {data.todaysActivities.totalElements} hoạt động
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Xử lý lịch xem, giữ chỗ, hợp đồng, dịch vụ và hỗ trợ trong ngày theo giờ Việt Nam.
                </p>
                {data.todaysActivities.totalElements === 0 ? (
                  <Empty>
                    Chưa có hoạt động xử lý nào được ghi nhận hôm nay trong phạm vi của bạn.
                  </Empty>
                ) : (
                  <>
                    <ol className="mt-3 divide-y divide-border/70">
                      {data.todaysActivities.content.map((item) => (
                        <li className="py-4" key={item.id}>
                          <p className="text-sm font-bold">{item.label}</p>
                          <Link
                            className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-primary hover:underline"
                            to={managementLink(item.route, item.branchId)}
                          >
                            {item.roomNumber}
                            {item.subjectName ? ' · ' + item.subjectName : ''}
                          </Link>
                          <p className="text-xs leading-6 text-muted-foreground">
                            {viewingDateTime(item.at)} ·{' '}
                            {item.actorName || 'Lịch sử chưa lưu tên người thực hiện'}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.branchName}</p>
                          {item.note && (
                            <p className="mt-2 whitespace-pre-line break-words text-sm leading-6">
                              {item.note}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                    <nav
                      className="mt-4 flex flex-wrap items-center justify-end gap-3"
                      aria-label="Phân trang hoạt động hôm nay"
                    >
                      <Button
                        variant="outline"
                        disabled={data.todaysActivities.number <= 1 || query.isFetching}
                        onClick={() => setActivitySelection({ branchId, page: activityPage - 1 })}
                      >
                        Trang trước
                      </Button>
                      <span className="text-sm tabular-nums">
                        Trang {data.todaysActivities.number} / {data.todaysActivities.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        disabled={
                          data.todaysActivities.number >= data.todaysActivities.totalPages ||
                          query.isFetching
                        }
                        onClick={() => setActivitySelection({ branchId, page: activityPage + 1 })}
                      >
                        Trang sau
                      </Button>
                    </nav>
                  </>
                )}
              </Panel>
              <Panel>
                <h2 className="text-lg font-bold">Nhận phòng dự kiến trong 7 ngày tới</h2>
                {data.upcomingMoveIns.length === 0 ? (
                  <Empty>Không có booking đã xác nhận dự kiến nhận phòng trong 7 ngày tới.</Empty>
                ) : (
                  <ul className="mt-3 divide-y divide-border/70">
                    {data.upcomingMoveIns.map((item) => (
                      <li className="py-4" key={item.id}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <Link
                            className="font-bold text-primary hover:underline"
                            to={managementLink(`/manager/bookings/${item.id}`, item.branchId)}
                          >
                            {date(item.date)} · {item.roomNumber}
                          </Link>
                          <Phone value={item.phone} />
                        </div>
                        <p className="mt-1 text-sm">
                          {item.tenantName || 'Chưa có tên người thuê'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.branchName}
                          {item.slotCodes ? ` · ${item.slotCodes}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Ngày dự kiến từ booking; không phải xác nhận đã bàn giao.
                </p>
              </Panel>
            </div>
            <Panel>
              <div className="mb-4 flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Hợp đồng sắp hết hạn</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Xuất hiện từ 1 tháng trước ngày kết thúc, để bạn chủ động liên hệ người thuê.
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {data.expiringContracts.totalElements} hợp đồng
                </span>
              </div>
              {data.expiringContracts.totalElements === 0 ? (
                <Empty>Chưa có hợp đồng đang hiệu lực sắp hết hạn trong khoảng này.</Empty>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <caption className="sr-only">
                        Hợp đồng đang hiệu lực từ một tháng trước ngày hết hạn
                      </caption>
                      <thead className="border-b border-border text-muted-foreground">
                        <tr>
                          {[
                            'Hợp đồng / Phòng',
                            'Người thuê',
                            'Liên hệ',
                            'Ngày hết hạn',
                            'Còn lại',
                          ].map((label) => (
                            <th className="px-2 py-3 font-medium" key={label}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {data.expiringContracts.content.map((item) => (
                          <tr key={item.id}>
                            <td className="px-2 py-4">
                              <Link
                                className="font-semibold text-primary hover:underline"
                                to={managementLink(`/manager/contracts/${item.id}`, item.branchId)}
                              >
                                {item.contractNumber || item.id}
                              </Link>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.roomNumber} · {item.branchName}
                              </p>
                            </td>
                            <td className="px-2 py-4">{item.tenantName || 'Chưa có tên'}</td>
                            <td className="px-2 py-4">
                              <Phone value={item.phone} />
                            </td>
                            <td className="px-2 py-4 tabular-nums">{date(item.endDate)}</td>
                            <td className="px-2 py-4 font-semibold tabular-nums">
                              {item.daysRemaining === 0 ? 'Hôm nay' : `${item.daysRemaining} ngày`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <nav
                    className="mt-4 flex flex-wrap items-center justify-end gap-3"
                    aria-label="Phân trang hợp đồng sắp hết hạn"
                  >
                    <Button
                      variant="outline"
                      disabled={data.expiringContracts.number <= 1 || query.isFetching}
                      onClick={() => page(expiringPage - 1)}
                    >
                      Trang trước
                    </Button>
                    <span className="text-sm tabular-nums">
                      Trang {data.expiringContracts.number} / {data.expiringContracts.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={
                        data.expiringContracts.number >= data.expiringContracts.totalPages ||
                        query.isFetching
                      }
                      onClick={() => page(expiringPage + 1)}
                    >
                      Trang sau
                    </Button>
                  </nav>
                </>
              )}
            </Panel>
            {role === 'owner' && (
              <Panel>
                <div id="overview-branches" className="scroll-mt-24">
                  <h2 className="text-lg font-bold">Tổng hợp chi nhánh</h2>
                  <p className="mb-4 mt-1 text-sm leading-6 text-muted-foreground">
                    Mở một chi nhánh để xem số liệu và xử lý công việc trong đúng phạm vi.
                  </p>
                </div>
                {data.branches.length === 0 ? (
                  <Empty>Chưa có chi nhánh để tổng hợp.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <caption className="sr-only">
                        Tình hình các chi nhánh được phép quản lý
                      </caption>
                      <thead className="border-b border-border text-muted-foreground">
                        <tr>
                          {[
                            'Chi nhánh',
                            'Quản lý',
                            'Phòng',
                            'Chỗ đang thuê / Vận hành',
                            'Người thuê',
                            'Đã thu trong tháng',
                            'Việc chờ xử lý',
                          ].map((label) => (
                            <th className="px-2 py-3 font-medium" key={label}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {data.branches.map((item) => (
                          <tr key={item.id}>
                            <td className="px-2 py-4">
                              <Link
                                className="font-semibold text-primary hover:underline"
                                to={`/owner/dashboard?${new URLSearchParams({ branchId: item.id })}`}
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td className="px-2 py-4">{item.managerName || 'Chưa phân công'}</td>
                            <td className="px-2 py-4 tabular-nums">{item.totalRooms}</td>
                            <td className="px-2 py-4 tabular-nums">
                              {item.occupiedSlots} / {item.operationalSlots}
                            </td>
                            <td className="px-2 py-4 tabular-nums">{item.activeTenants}</td>
                            <td className="px-2 py-4 whitespace-nowrap tabular-nums">
                              {formatVnd(item.receipts)}
                            </td>
                            <td className="px-2 py-4 tabular-nums">{item.pendingCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            )}
            <p className="text-xs text-muted-foreground">
              Cập nhật lúc {time(data.generatedAt)} · {date(data.generatedAt)} (giờ Việt Nam).
            </p>
          </>
        )}
      </QueryState>
    </div>
  )
}
