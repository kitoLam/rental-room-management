import { ChartBar } from '@/components/common/chart-bar'
import { Field, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManager, useManagerQuery } from './context'
import { PeriodChart } from './dashboard-shared'
export function ManagerDashboard({ report = false }: { report?: boolean }) {
  const { branch } = useManager(),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    query = useManagerQuery('summary', (b) => managerApi.summary(b, month), [month], true)
  return (
    <ManagerPage
      title={report ? 'Báo cáo chi nhánh' : 'Một ngày vận hành rõ ràng.'}
      description={branch.name}
      actions={
        <Button variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw size={16} />
          Cập nhật
        </Button>
      }
    >
      <Field label="Kỳ báo cáo" id="manager-report-month">
        <input
          id="manager-report-month"
          type="month"
          className="input max-w-xs"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value)
          }}
        />
      </Field>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['Phòng đang vận hành', `${query.data.rooms.total} phòng`],
                ['Người thuê đang hiệu lực', `${query.data.activeTenancies} quan hệ`],
                ['Hóa đơn phát hành trong kỳ', formatVnd(query.data.billed)],
                ['Thu thực tế đã xác minh', formatVnd(query.data.receipts)],
                ['Công nợ của kỳ', formatVnd(query.data.debt)],
                [
                  'Quá hạn',
                  `${formatVnd(query.data.overdue)} · ${query.data.overdueCount} hóa đơn`,
                ],
              ].map(([label, value]) => (
                <Panel key={label} className="sm:p-5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
                </Panel>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <h2 className="mb-5 font-bold">Việc cần xử lý</h2>
                {query.data.pending.map((p) => (
                  <div
                    key={p.route}
                    className="flex items-center justify-between gap-3 border-t border-border py-3"
                  >
                    <ManagerLink to={p.route}>{p.label}</ManagerLink>
                    <span className="text-sm font-bold tabular-nums">{p.count}</span>
                  </div>
                ))}
              </Panel>
              <Panel>
                <PeriodChart data={query.data.series} />
              </Panel>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <h2 className="mb-4 font-bold">Tình trạng phòng</h2>
                <p className="mb-4 text-xs leading-6 text-muted-foreground">
                  Đếm theo phòng vật lý. Chỗ thuê SLOT được theo dõi riêng bên dưới.
                </p>
                {[
                  ['AVAILABLE', query.data.rooms.available],
                  ['OCCUPIED', query.data.rooms.occupied],
                  ['HELD', query.data.rooms.held],
                  ['MAINTENANCE', query.data.rooms.maintenance],
                ].map(([status, count]) => (
                  <div key={status} className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <ManagerStatus value={String(status)} />
                      <span>{count} phòng</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-background">
                      <ChartBar
                        className="bg-primary/70"
                        value={Number(count)}
                        max={query.data!.rooms.total}
                      />
                    </div>
                  </div>
                ))}
                <p className="mt-5 text-sm leading-7">
                  SLOT: {query.data.slots.total} chỗ hoạt động · {query.data.slots.occupied} đang ở
                  · {query.data.slots.held} giữ · {query.data.slots.available} còn trống.
                </p>
                <ManagerLink to="/manager/rooms">Chi tiết phòng</ManagerLink>
              </Panel>
              <Panel>
                <h2 className="mb-5 font-bold">Đọc đúng số liệu tài chính</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Số phát hành là nghĩa vụ theo hóa đơn. Thu thực tế là tiền đã xác minh, gồm khoản
                  thuê trả trước; không phải doanh thu đã ghi nhận. Tiền giữ phòng được theo dõi
                  riêng.
                </p>
                <p className="mt-4 text-sm font-bold">
                  Thu sandbox trong kỳ: {formatVnd(query.data.sandboxReceipts)}
                </p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Không cộng sandbox vào thu thực tế. Áp dụng trả trước không tạo thêm lần thu tiền.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-6">
                  <ManagerLink to="/manager/invoices" params={{ month }}>
                    Hóa đơn nguồn
                  </ManagerLink>
                  <ManagerLink to="/manager/payments" params={{ month }}>
                    Thanh toán nguồn
                  </ManagerLink>
                  <ManagerLink to="/manager/debts" params={{ month }}>
                    Công nợ
                  </ManagerLink>
                </div>
              </Panel>
            </div>
            {report && (
              <div className="grid gap-6 sm:grid-cols-2">
                <Panel>
                  <h2 className="mb-5 font-bold">Giữ phòng theo trạng thái</h2>
                  {query.data.bookingCounts.map((v) => (
                    <div
                      key={v.status}
                      className="flex items-center justify-between border-t border-border py-3"
                    >
                      <ManagerStatus value={v.status} />
                      <strong>{v.count}</strong>
                    </div>
                  ))}
                  <ManagerLink to="/manager/bookings">Mở danh sách</ManagerLink>
                </Panel>
                <Panel>
                  <h2 className="mb-5 font-bold">Sửa chữa theo trạng thái</h2>
                  {query.data.maintenanceCounts.map((v) => (
                    <div
                      key={v.status}
                      className="flex items-center justify-between border-t border-border py-3"
                    >
                      <ManagerStatus value={v.status} />
                      <strong>{v.count}</strong>
                    </div>
                  ))}
                  <p className="mt-4 text-sm">Hợp đồng hiệu lực: {query.data.activeContracts}</p>
                  <ManagerLink to="/manager/maintenance">Mở hàng đợi</ManagerLink>
                </Panel>
              </div>
            )}
            <Notice>
              Số liệu hiện tại thuộc chi nhánh đang chọn. Trong chế độ demo, các biên nhận và biểu
              đồ đều là dữ liệu mô phỏng.
            </Notice>
          </>
        )}
      </QueryState>
    </ManagerPage>
  )
}
