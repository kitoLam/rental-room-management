import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { addMonths, dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantOverviewService } from '@/services/tenant-overview'
import { TenantPage, TenantStatus } from './components'
import { useTenantWorkspace } from './context'

const displayDate = (value: string | null) => (value ? dateOnly(value) : 'Chưa cập nhật')
const displayMoney = (value: number | null) => (value === null ? 'Chưa cập nhật' : formatVnd(value))

export function TenantDashboard() {
  const userId = useSession((s) => s.user?.id)
  const { tenancy: selection } = useTenantWorkspace()
  const [params] = useSearchParams()
  const tenancyId = selection?.id || params.get('tenancyId') || undefined
  const query = useQuery({
    queryKey: ['tenant-overview', userId, tenancyId || ''],
    queryFn: () => tenantOverviewService.overview(tenancyId),
    enabled: !!userId,
    retry: false,
    staleTime: 15000,
    refetchInterval: 30000,
  })
  const data = query.data
  const lease = data?.tenancy
  const slotNames = lease?.slotCodes
    .map((code) =>
      code.startsWith(lease.roomNumber + '-') ? code.slice(lease.roomNumber.length + 1) : code,
    )
    .join(', ')
  const link = (path: string) =>
    lease && path.startsWith('/tenant/')
      ? `${path}?${new URLSearchParams({ tenancyId: lease.id })}`
      : path
  const daysRemaining =
    lease?.endDate && data
      ? Math.round(
          (Date.parse(lease.endDate + 'T00:00:00Z') - Date.parse(data.asOfDate + 'T00:00:00Z')) /
            86400000,
        )
      : null
  const expiring =
    lease?.status === 'ACTIVE' &&
    !!lease.endDate &&
    !!data &&
    addMonths(lease.endDate, -1) <= data.asOfDate &&
    lease.endDate >= data.asOfDate
  const tasks: { title: string; note: string; to: string }[] = []
  if (data && lease) {
    if (data.nextDueDate)
      tasks.push({
        title:
          data.nextDueDate < data.asOfDate
            ? 'Hóa đơn đã qua hạn thanh toán'
            : 'Hóa đơn cần thanh toán',
        note: `Hạn ${displayDate(data.nextDueDate)} · Còn lại ${displayMoney(data.nextDueAmount)}`,
        to: '/tenant/invoices',
      })
    if (data.needsResponseCount > 0)
      tasks.push({
        title: `${data.needsResponseCount} yêu cầu hỗ trợ cần phản hồi`,
        note: 'Bổ sung thông tin hoặc xem kết quả xử lý.',
        to: '/tenant/maintenance',
      })
    if (expiring)
      tasks.push({
        title: 'Hợp đồng sắp hết hạn',
        note: `Kết thúc ${displayDate(lease.endDate)}. Chủ động liên hệ quản lý nếu muốn tiếp tục thuê.`,
        to: '/tenant/contracts',
      })
  }
  return (
    <TenantPage
      title="Tổng quan không gian thuê"
      description="Chỗ ở, những việc cần chú ý và cập nhật dành cho bạn."
      actions={
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          Cập nhật
        </Button>
      }
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {data && (
          <>
            {!lease ? (
              <Notice>
                Bạn chưa có quan hệ thuê. Hãy dùng mục{' '}
                <Link className="font-semibold underline" to="/tenant/appointments">
                  Lịch xem
                </Link>{' '}
                hoặc{' '}
                <Link className="font-semibold underline" to="/tenant/bookings">
                  Giữ phòng
                </Link>{' '}
                để theo dõi yêu cầu của mình. Giữ phòng được xác nhận chưa đồng nghĩa đã nhận phòng.
              </Notice>
            ) : (
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold">
                      {lease.roomNumber}
                      {slotNames ? ` · ${slotNames}` : ''}
                    </p>
                    <p className="mt-2 text-sm">{lease.branchName}</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {lease.address || 'Địa chỉ chưa cập nhật'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
                  <span>
                    Tiền thuê của bạn: <strong>{displayMoney(lease.rentAmount)}</strong> / tháng
                  </span>
                  <span>
                    Liên hệ:{' '}
                    {lease.branchPhone ? (
                      <a
                        className="font-semibold text-primary hover:underline"
                        href={`tel:${lease.branchPhone}`}
                      >
                        {lease.branchPhone}
                      </a>
                    ) : (
                      'Chưa cập nhật'
                    )}
                  </span>
                </div>
                {lease.status !== 'ACTIVE' && (
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    Đang xem hồ sơ thuê đã kết thúc hoặc chưa hiệu lực.
                  </p>
                )}
              </Panel>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  'Hóa đơn cần thanh toán',
                  !lease
                    ? '—'
                    : data.unpaidInvoiceCount === null
                      ? 'Chưa đủ dữ liệu'
                      : String(data.unpaidInvoiceCount),
                  'Chỉ tính hóa đơn đã phát hành',
                ],
                [
                  'Hạn thanh toán gần nhất',
                  data.nextDueDate ? displayDate(data.nextDueDate) : '—',
                  data.nextDueDate
                    ? displayMoney(data.nextDueAmount)
                    : 'Chưa có hạn thanh toán được ghi nhận',
                ],
                [
                  'Thời hạn hợp đồng',
                  lease?.endDate ? displayDate(lease.endDate) : '—',
                  lease?.status === 'ACTIVE' && daysRemaining !== null
                    ? `Còn ${daysRemaining} ngày`
                    : lease
                      ? 'Xem trạng thái trong Hợp đồng'
                      : 'Chưa có hợp đồng thuê',
                ],
                [
                  'Việc cần bạn phản hồi',
                  lease ? String(data.needsResponseCount) : '—',
                  'Yêu cầu hỗ trợ chờ thông tin / xem kết quả',
                ],
              ].map(([label, value, note]) => (
                <Panel key={label} className="sm:p-5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
                </Panel>
              ))}
            </div>
            {lease && (
              <>
                <Panel>
                  <h2 className="font-bold">Việc cần bạn xử lý</h2>
                  {tasks.length > 0 ? (
                    <ul className="mt-3 divide-y divide-border/70">
                      {tasks.slice(0, 3).map((task) => (
                        <li key={task.to} className="py-3">
                          <Link
                            to={link(task.to)}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            {task.title} →
                          </Link>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            {task.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Chưa có việc cần phản hồi được ghi nhận.
                    </p>
                  )}
                  {data.incompleteBalances && (
                    <p className="mt-3 text-xs leading-6 text-muted-foreground">
                      Một số hóa đơn chưa có số dư đầy đủ; chưa thể kết luận số hóa đơn còn phải
                      thanh toán.
                    </p>
                  )}
                </Panel>
                <div className="grid gap-6 xl:grid-cols-2">
                  <Panel>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-bold">Hóa đơn cần chú ý</h2>
                      <Link
                        to={link('/tenant/invoices')}
                        className="text-xs text-primary hover:underline"
                      >
                        Xem tất cả
                      </Link>
                    </div>
                    {data.recentInvoices.length === 0 ? (
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        Chưa có hóa đơn đã phát hành cho quan hệ thuê này.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-border/70">
                        {data.recentInvoices.slice(0, 3).map((invoice) => (
                          <li
                            key={invoice.id}
                            className="flex flex-wrap justify-between gap-2 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {invoice.invoiceNumber || invoice.period || 'Hóa đơn'}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Hạn {displayDate(invoice.dueDate)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold tabular-nums">
                                {displayMoney(invoice.remainingAmount)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">Còn lại</p>
                              {invoice.status && <TenantStatus value={invoice.status} />}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-4 text-xs leading-6 text-muted-foreground">
                      Chỉ hiển thị các hóa đơn đã được ghi nhận cho quan hệ thuê đang chọn.
                    </p>
                  </Panel>
                  <Panel>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-bold">Yêu cầu hỗ trợ</h2>
                      <Link
                        to={link('/tenant/maintenance')}
                        className="text-xs text-primary hover:underline"
                      >
                        Xem tất cả
                      </Link>
                    </div>
                    <p className="mt-3 text-sm">{data.openSupportCount} yêu cầu đang theo dõi</p>
                    {data.recentSupport.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Chưa có yêu cầu cho hợp đồng này.
                      </p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border/70">
                        {data.recentSupport.slice(0, 3).map((item) => (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-3"
                          >
                            <Link
                              to={link(`/tenant/maintenance/${item.id}`)}
                              className="text-sm font-semibold hover:text-primary"
                            >
                              {item.title || 'Yêu cầu hỗ trợ'}
                            </Link>
                            {item.status && <TenantStatus value={item.status} />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>
                <Panel>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold">Dịch vụ và thanh toán</h2>
                      <p className="mt-3 text-sm leading-7">
                        {data.activeSubscriptions === null
                          ? 'Dịch vụ hiện tại: xem tại mục Dịch vụ.'
                          : `${data.activeSubscriptions} đăng ký dịch vụ đang dùng.`}{' '}
                        {data.pendingServiceRequests} yêu cầu dịch vụ đang mở.
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {data.latestPayment
                          ? `Thanh toán hóa đơn thành công gần nhất: ${displayMoney(data.latestPayment.amount)} · ${dateTime(data.latestPayment.paidAt)}`
                          : 'Chưa ghi nhận thanh toán hóa đơn thành công.'}
                      </p>
                    </div>
                    <div className="flex gap-5 text-sm font-semibold text-primary">
                      <Link to={link('/tenant/services')} className="hover:underline">
                        Dịch vụ →
                      </Link>
                      <Link to={link('/tenant/payments')} className="hover:underline">
                        Thanh toán →
                      </Link>
                    </div>
                  </div>
                </Panel>
              </>
            )}
            <Panel>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">Cập nhật mới</h2>
                <Link to="/tenant/appointments" className="text-xs text-primary hover:underline">
                  Xem tất cả
                </Link>
              </div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                Cập nhật lịch xem và dịch vụ dành cho tài khoản của bạn.
              </p>
              {data.notifications.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Chưa có cập nhật mới.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border/70">
                  {data.notifications.slice(0, 3).map((item) => (
                    <li key={item.id} className="py-3">
                      <Link
                        to={item.detailPath || '/notifications'}
                        className="text-sm font-semibold hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateTime(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <p className="text-xs leading-6 text-muted-foreground">
              Thông tin điện nước sẽ xuất hiện khi được cập nhật. Cập nhật{' '}
              {dateTime(data.generatedAt)}.
            </p>
          </>
        )}
      </QueryState>
    </TenantPage>
  )
}
