import { Notice, Panel, QueryState } from '@/components/common/page'
import { Facts } from '@/features/tenant/components'
import { ownerApi } from '@/services/owner'
import { Link } from 'react-router'
import { MoneyStats, OwnerPage } from './components'
import { useOwner, useOwnerFilters, useOwnerQuery } from './context'
import { BranchComparison, RecentOwnerActivity, Utilization } from './finance-shared'
export function OwnerOverview({
  kind = 'dashboard',
}: {
  kind?: 'dashboard' | 'finance' | 'reports'
}) {
  const { scope, branches } = useOwner(),
    state = useOwnerFilters({ month: new Date().toISOString().slice(0, 7) }),
    query = useOwnerQuery(
      'summary',
      () => ownerApi.summary({ month: state.filters.month, ...(scope ? { branchId: scope } : {}) }),
      [state.filters.month],
    ),
    title =
      kind === 'finance'
        ? 'Tài chính'
        : kind === 'reports'
          ? 'Báo cáo chi nhánh'
          : 'Tổng quan chủ trọ'
  return (
    <OwnerPage title={title} description="Theo dõi chi nhánh, dòng tiền và các việc cần xử lý.">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 text-sm">
          Kỳ báo cáo
          <input
            className="input w-auto max-w-full"
            aria-label="Kỳ báo cáo"
            type="month"
            value={state.filters.month}
            onChange={(e) => state.change('month', e.target.value)}
          />
        </label>
        {kind === 'dashboard' && (
          <Link className="text-sm font-bold text-primary" to="/owner/branches/new">
            Tạo chi nhánh
          </Link>
        )}
      </div>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            {kind === 'dashboard' && (
              <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-5 text-sm">
                <span>
                  <strong className="mr-2 text-2xl">{query.data.rows.length}</strong>chi nhánh
                </span>
                {['ACTIVE', 'DRAFT', 'INACTIVE'].map((status, i) => (
                  <span key={status}>
                    {query.data!.rows.filter((r) => r.status === status).length}{' '}
                    {['hoạt động', 'nháp', 'ngừng hoạt động'][i]}
                  </span>
                ))}
                <span>{query.data.rows.filter((r) => !r.managerName).length} cần phân công</span>
                <span>{query.data.rows.reduce((n, r) => n + r.roomCount, 0)} phòng tổng cộng</span>
                <span>
                  {query.data.rows.reduce((n, r) => n + r.slots.total, 0)} chỗ SLOT hoạt động
                </span>
              </div>
            )}
            <MoneyStats
              items={[
                ['Hóa đơn đã phát hành trong kỳ', query.data.totals.billed],
                ['Thực thu xác minh trong kỳ', query.data.totals.receipts],
                ['Dư nợ hóa đơn kỳ báo cáo', query.data.totals.debt],
                ['Nợ quá hạn của kỳ báo cáo', query.data.totals.overdue],
                ['Thu sandbox trong kỳ (tách riêng)', query.data.totals.sandboxReceipts],
                ['Tiền chưa phân bổ (lũy kế thực)', query.data.totals.unmatched],
              ]}
            />
            <div className="flex flex-wrap gap-5 text-sm font-bold text-primary">
              <Link to={`/owner/approvals/invoices${scope ? `?branchId=${scope}` : ''}`}>
                {query.data.pendingApprovals} yêu cầu chờ duyệt
              </Link>
              <Link to={`/owner/payments?status=REVIEW${scope ? `&branchId=${scope}` : ''}`}>
                {query.data.totals.exceptions} giao dịch cần đối soát
              </Link>
              <Link to={`/owner/payments${scope ? `?branchId=${scope}` : ''}`}>Xem giao dịch</Link>
              <Link to={`/owner/manager-assignments${scope ? `?branchId=${scope}` : ''}`}>
                Kiểm tra phân công
              </Link>
            </div>
            <BranchComparison data={query.data} />
            {kind === 'finance' ? (
              <>
                <h2 className="font-bold">Số dư lũy kế thực nhận</h2>
                <MoneyStats
                  items={[
                    ['Tiền thuê trả trước đã nhận', query.data.totals.prepaidReceived],
                    ['Trả trước đã áp dụng', query.data.totals.prepaidApplied],
                    ['Trả trước chưa sử dụng', query.data.totals.prepaidUnused],
                    ['Tiền giữ phòng thực nhận', query.data.totals.holdReceived],
                    ['Tiền giữ sandbox (tách riêng)', query.data.totals.holdSandbox],
                  ]}
                />
                <Notice>
                  Áp dụng trả trước không tạo dòng tiền mới. Chưa định nghĩa doanh thu kế toán hoặc
                  triển khai hoàn tiền. Dư nợ theo kỳ báo cáo; mở công nợ từng chi nhánh để xem mọi
                  kỳ.
                </Notice>
              </>
            ) : null}
            <Utilization data={query.data} />
            {kind === 'reports' && (
              <Panel>
                <Facts
                  items={[
                    ['Hóa đơn đã phát hành trong kỳ', String(query.data.totals.invoiceCount)],
                    ['Hóa đơn quá hạn trong kỳ', String(query.data.totals.overdueCount)],
                    ['Hợp đồng đang hoạt động', String(query.data.totals.activeContracts)],
                    ['Quan hệ thuê đang hoạt động', String(query.data.totals.activeTenancies)],
                    ['Giữ phòng tạo trong kỳ', String(query.data.totals.bookingCount)],
                    ['Sửa chữa chưa hoàn tất', String(query.data.totals.maintenanceCount)],
                    [
                      'Phân công quản lý',
                      `${query.data.rows.filter((r) => r.managerName).length}/${query.data.rows.length} chi nhánh`,
                    ],
                  ]}
                />
              </Panel>
            )}
            {kind === 'dashboard' && <RecentOwnerActivity />}
          </>
        )}
      </QueryState>
      {branches.length === 0 && <Notice>Bắt đầu bằng việc tạo một chi nhánh nháp.</Notice>}
    </OwnerPage>
  )
}
