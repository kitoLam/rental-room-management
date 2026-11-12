import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { formatVnd } from '@/lib/format'
import { dashboardService } from '@/services/dashboard'
import {
  MonthlyReceiptsChart,
  RoomRankingChart,
  ReceiptShareChart,
} from './management-report-charts'

type PeriodMode = 'year' | 'month' | 'last12'
function currentMonth() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}
function monthLabel(month: string) {
  return `${month.slice(5)}/${month.slice(0, 4)}`
}
function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm leading-6 text-muted-foreground">{children}</p>
}
function Slots({ count, unknown }: { count: number; unknown: number }) {
  return (
    <span>
      {count.toLocaleString('vi-VN')}
      {unknown > 0 && <span className="text-muted-foreground"> + chưa rõ</span>}
    </span>
  )
}
export function ManagementReports({
  role,
  branchId,
}: {
  role: 'manager' | 'owner'
  branchId?: string
}) {
  const userId = useSession((s) => s.user?.id)
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<PeriodMode>('year')
  const [year, setYear] = useState(() => currentMonth().slice(0, 4))
  const [month, setMonth] = useState(currentMonth)
  const [roomSelection, setRoomSelection] = useState({ branchId, roomId: '' })
  const roomId = roomSelection.branchId === branchId ? roomSelection.roomId : ''
  const [sort, setSort] = useState<'receipts' | 'leases' | 'roomNumber'>('receipts')
  const [showMonths, setShowMonths] = useState(false)
  const fromMonth =
    mode === 'year' ? `${year}-01` : mode === 'last12' ? shiftMonth(month, -11) : month
  const toMonth = mode === 'year' ? `${year}-12` : month
  const validPeriod =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(fromMonth) &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(toMonth) &&
    Number(fromMonth.slice(0, 4)) >= 1901 &&
    Number(toMonth.slice(0, 4)) <= 9998
  const filterKey = JSON.stringify([branchId, roomId, fromMonth, toMonth, sort])
  const [pageSelection, setPageSelection] = useState({ key: '', page: 0 })
  const page = pageSelection.key === filterKey ? pageSelection.page : 0
  const query = useQuery({
    queryKey: ['management-reports', userId, role, filterKey, page],
    queryFn: () =>
      dashboardService.reports(role, {
        branchId,
        roomId: roomId || undefined,
        fromMonth,
        toMonth,
        sort,
        page,
      }),
    enabled: !!userId && validPeriod,
    retry: false,
    staleTime: 30_000,
  })
  const data = query.data
  function changeBranch(id: string) {
    const next = new URLSearchParams(params)
    next.set('branchId', id)
    setParams(next)
    setRoomSelection({ branchId: id || undefined, roomId: '' })
  }
  const difference = data ? data.metrics.receipts - data.metrics.previousReceipts : 0
  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Báo cáo cho thuê
          </p>
          <h1 className="text-page-title font-bold tracking-tight">Tiền thu và lượt thuê</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Theo dõi kết quả theo thời gian, phòng và chi nhánh trong phạm vi quản lý.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching || !validPeriod}
          onClick={() => void query.refetch()}
        >
          Cập nhật số liệu
        </Button>
      </header>
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold">
            Kỳ báo cáo
            <select
              className="input w-full"
              value={mode}
              onChange={(e) => setMode(e.target.value as PeriodMode)}
            >
              <option value="year">Theo năm</option>
              <option value="month">Theo tháng</option>
              <option value="last12">12 tháng liên tiếp</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            {mode === 'year' ? 'Năm' : mode === 'last12' ? 'Tháng kết thúc' : 'Tháng'}
            {mode === 'year' ? (
              <input
                className="input w-full"
                type="number"
                min="1901"
                max="9998"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            ) : (
              <input
                className="input w-full"
                type="month"
                min={mode === 'last12' ? '1901-12' : '1901-01'}
                max="9998-12"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            )}
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Chi nhánh
            <select
              className="input w-full"
              value={branchId || ''}
              onChange={(e) => changeBranch(e.target.value)}
              disabled={!data}
            >
              {role === 'owner' && <option value="">Tất cả chi nhánh sở hữu</option>}
              {data?.branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Phòng
            <select
              className="input w-full"
              value={roomId}
              disabled={!data}
              onChange={(e) => setRoomSelection({ branchId, roomId: e.target.value })}
            >
              <option value="">Tất cả phòng</option>
              {data?.roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} · {data.branchOptions.find((b) => b.id === r.branchId)?.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {validPeriod ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Từ {monthLabel(fromMonth)} đến {monthLabel(toMonth)} · Theo giờ Việt Nam.
          </p>
        ) : (
          <p role="alert" className="mt-4 text-sm text-danger">
            Chọn tháng/năm hợp lệ từ 1901 đến 9998.
          </p>
        )}
      </Panel>
      {validPeriod && (
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {data && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Tiền đã thu trong kỳ',
                    value: formatVnd(data.metrics.receipts),
                    note: 'Thanh toán hóa đơn thành công',
                  },
                  {
                    label: 'Phòng thu cao nhất',
                    value: data.topReceipts[0]?.roomNumber || '—',
                    note: data.topReceipts[0]
                      ? `${formatVnd(data.topReceipts[0].receipts)} · ${data.topReceipts[0].branchName}`
                      : 'Chưa có khoản thu trong kỳ',
                  },
                  {
                    label: 'Lượt hợp đồng bắt đầu thuê',
                    value: String(data.metrics.newLeases),
                    note: 'Đã có hiệu lực, ngày bắt đầu thuộc kỳ',
                  },
                  {
                    label: 'Phòng nhiều lượt thuê nhất',
                    value: data.topRentals[0]?.roomNumber || '—',
                    note: data.topRentals[0]
                      ? `${data.topRentals[0].newLeases} lượt · ${data.topRentals[0].branchName}`
                      : 'Chưa có lượt thuê mới trong kỳ',
                  },
                ].map((item) => (
                  <Panel key={item.label} className="sm:p-5">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-4 text-2xl font-bold tabular-nums">{item.value}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.note}</p>
                  </Panel>
                ))}
              </div>
              <Notice>
                Tiền thu theo ngày thanh toán, chỉ tính giao dịch hiện có trạng thái thành công /
                trả trễ thành công. Không cộng cọc giữ chỗ; hóa đơn chứa khoản cọc cũng chưa đưa vào
                tổng do chưa phân bổ được tiền thu riêng từng loại phí. Dữ liệu sandbox, nếu có, vẫn
                có thể nằm trong số liệu này.
              </Notice>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Tiền đã thu theo tháng</h2>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      Đơn vị: đồng. Tháng chưa có khoản thu hiển thị bằng 0.
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold tabular-nums">
                      {difference > 0 ? '+' : ''}
                      {formatVnd(difference)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      So với {data.months.length} tháng liền trước
                      {data.metrics.previousReceipts > 0
                        ? ` (${((difference / data.metrics.previousReceipts) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)`
                        : ''}
                    </p>
                  </div>
                </div>
                <MonthlyReceiptsChart months={data.months} />
                <p className="text-xs leading-6 text-muted-foreground">
                  Kỳ đang diễn ra chỉ có dữ liệu đến thời điểm cập nhật. Số so sánh lấy toàn bộ kỳ
                  liền trước.
                </p>
              </Panel>
              <div className="grid gap-6 xl:grid-cols-2">
                <RoomRankingChart
                  title="Phòng có tiền thu cao nhất"
                  rows={data.topReceipts}
                  kind="receipts"
                />
                <RoomRankingChart
                  title="Phòng có nhiều lượt thuê mới nhất"
                  rows={data.topRentals}
                  kind="leases"
                />
              </div>
              <ReceiptShareChart rooms={data.topReceipts} total={data.metrics.receipts} />
              <Panel>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Chi tiết theo phòng</h2>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {data.rooms.totalElements} phòng · Mỗi trang tối đa 10 phòng.
                    </p>
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    Sắp xếp
                    <select
                      className="input w-auto"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as typeof sort)}
                    >
                      <option value="receipts">Tiền thu cao nhất</option>
                      <option value="leases">Lượt thuê nhiều nhất</option>
                      <option value="roomNumber">Tên phòng</option>
                    </select>
                  </label>
                </div>
                <label className="mb-4 inline-flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showMonths}
                    onChange={(e) => setShowMonths(e.target.checked)}
                  />
                  Hiển thị tiền thu từng tháng
                </label>
                {data.rooms.totalElements === 0 ? (
                  <Empty>Chưa có phòng trong phạm vi đã chọn.</Empty>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[660px] text-left text-sm">
                        <caption className="sr-only">
                          Tiền thu và lượt thuê của từng phòng trong kỳ báo cáo
                        </caption>
                        <thead className="border-b border-border text-muted-foreground">
                          <tr>
                            {[
                              'Phòng / Chi nhánh',
                              'Tiền đã thu',
                              'Tỷ trọng',
                              'Lượt hợp đồng',
                              'Lượt slot thuê',
                              ...(showMonths ? data.months.map((m) => monthLabel(m.month)) : []),
                            ].map((label) => (
                              <th key={label} className="whitespace-nowrap px-2 py-3 font-medium">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                          {data.rooms.content.map((room) => (
                            <tr key={room.id}>
                              <td className="px-2 py-4">
                                <p className="font-semibold">{room.roomNumber}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {room.branchName}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-2 py-4 font-semibold tabular-nums">
                                {formatVnd(room.receipts)}
                              </td>
                              <td className="px-2 py-4 tabular-nums">
                                {room.receiptShare.toLocaleString('vi-VN')}%
                              </td>
                              <td className="px-2 py-4 tabular-nums">{room.newLeases}</td>
                              <td className="px-2 py-4 tabular-nums">
                                <Slots
                                  count={room.leasedSlots}
                                  unknown={room.unknownSlotContracts}
                                />
                              </td>
                              {showMonths &&
                                room.monthlyReceipts.map((amount, index) => (
                                  <td
                                    key={data.months[index].month}
                                    className="whitespace-nowrap px-2 py-4 tabular-nums"
                                  >
                                    {formatVnd(amount)}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <nav
                      aria-label="Phân trang chi tiết phòng"
                      className="mt-5 flex flex-wrap items-center justify-end gap-3"
                    >
                      <Button
                        variant="outline"
                        disabled={page === 0 || query.isFetching}
                        onClick={() => setPageSelection({ key: filterKey, page: page - 1 })}
                      >
                        Trang trước
                      </Button>
                      <span className="text-sm tabular-nums">
                        Trang {data.rooms.number} / {Math.max(data.rooms.totalPages, 1)}
                      </span>
                      <Button
                        variant="outline"
                        disabled={data.rooms.number >= data.rooms.totalPages || query.isFetching}
                        onClick={() => setPageSelection({ key: filterKey, page: page + 1 })}
                      >
                        Trang sau
                      </Button>
                    </nav>
                  </>
                )}
                <p className="mt-5 text-xs leading-6 text-muted-foreground">
                  Một hợp đồng thuê nhiều slot chỉ tính 1 lượt hợp đồng. Lượt slot thuê là tổng số
                  slot trong các hợp đồng bắt đầu trong kỳ; cùng một slot có thể được thuê nhiều lần
                  qua các hợp đồng khác nhau.
                </p>
                {data.metrics.unknownSlotContracts > 0 && (
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    Có {data.metrics.unknownSlotContracts} hợp đồng cũ chưa lưu slot. Lượt hợp đồng
                    vẫn được tính; số lượt slot tương ứng chưa xác định.
                  </p>
                )}
              </Panel>
              {role === 'owner' && (
                <Panel>
                  <h2 className="text-lg font-bold">So sánh chi nhánh</h2>
                  <p className="mb-4 mt-1 text-xs leading-6 text-muted-foreground">
                    Áp dụng cùng kỳ và bộ lọc phía trên. Chọn tất cả chi nhánh để so sánh toàn bộ
                    phạm vi sở hữu.
                  </p>
                  {data.branches.length === 0 ? (
                    <Empty>Chưa có chi nhánh để so sánh.</Empty>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] text-left text-sm">
                        <caption className="sr-only">
                          So sánh tiền thu và lượt thuê giữa các chi nhánh
                        </caption>
                        <thead className="border-b border-border text-muted-foreground">
                          <tr>
                            {[
                              'Chi nhánh',
                              'Số phòng',
                              'Tiền đã thu',
                              'Lượt hợp đồng',
                              'Lượt slot thuê',
                            ].map((label) => (
                              <th key={label} className="px-2 py-3 font-medium">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                          {data.branches.map((b) => (
                            <tr key={b.id}>
                              <td className="px-2 py-4 font-semibold">{b.name}</td>
                              <td className="px-2 py-4 tabular-nums">{b.roomCount}</td>
                              <td className="whitespace-nowrap px-2 py-4 font-semibold tabular-nums">
                                {formatVnd(b.receipts)}
                              </td>
                              <td className="px-2 py-4 tabular-nums">{b.newLeases}</td>
                              <td className="px-2 py-4 tabular-nums">
                                <Slots count={b.leasedSlots} unknown={b.unknownSlotContracts} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}
              <p className="text-xs text-muted-foreground">
                Cập nhật lúc{' '}
                {new Intl.DateTimeFormat('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(data.generatedAt))}{' '}
                (giờ Việt Nam).
              </p>
            </>
          )}
        </QueryState>
      )}
      <Panel>
        <h2 className="text-lg font-bold">Các báo cáo sẽ bổ sung</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          {[
            [
              'Tỷ lệ lấp đầy theo thời gian',
              'Chờ hoàn thiện lịch sử cư trú thực tế và thời gian slot tạm ngừng hoạt động.',
            ],
            [
              'Tiền thu theo từng loại phí',
              'Chờ dữ liệu phân bổ thanh toán theo tiền thuê, điện, nước và dịch vụ.',
            ],
            ['Lợi nhuận', 'Chờ dữ liệu chi phí vận hành để tính kết quả thu trừ chi.'],
          ].map(([title, description]) => (
            <div key={title} className="border-t border-border pt-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Chưa có dữ liệu</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
