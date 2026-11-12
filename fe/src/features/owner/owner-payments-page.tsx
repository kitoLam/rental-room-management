import { Notice } from '@/components/common/page'
import { ManagerStatus, Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { Link } from 'react-router'
import { OwnerFilters, OwnerPage } from './components'
import { operationsLink, useOwnerFilters, useOwnerList } from './context'

export function OwnerPayments() {
  const state = useOwnerFilters({ month: '', environment: '', targetType: '' }),
    query = useOwnerList('payments', state.filters)
  return (
    <OwnerPage
      title="Giao dịch & đối soát"
      description="Tiền nhận, tiền phân bổ và môi trường thanh toán được theo dõi riêng."
    >
      <OwnerFilters
        state={state}
        period
        statuses={[
          { value: 'PENDING', label: 'Chờ xác minh' },
          { value: 'VERIFIED', label: 'Đã xác minh' },
          { value: 'REVIEW', label: 'Cần đối soát' },
          { value: 'FAILED', label: 'Thất bại' },
        ]}
      >
        <select
          aria-label="Môi trường giao dịch"
          className="input w-auto"
          value={state.filters.environment}
          onChange={(e) => state.change('environment', e.target.value)}
        >
          <option value="">Mọi môi trường</option>
          <option value="SANDBOX">Sandbox</option>
          <option value="LIVE">Thực tế (LIVE)</option>
          <option value="PRODUCTION">Thực tế (PRODUCTION)</option>
        </select>
        <select
          aria-label="Loại nghĩa vụ"
          className="input w-auto"
          value={state.filters.targetType}
          onChange={(e) => state.change('targetType', e.target.value)}
        >
          <option value="">Mọi nghĩa vụ</option>
          <option value="INVOICE">Hóa đơn</option>
          <option value="PREPAID_RENT">Trả trước</option>
          <option value="BOOKING_HOLD">Giữ phòng</option>
        </select>
      </OwnerFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        columns={[
          {
            label: 'Tham chiếu / chi nhánh',
            render: (p) => (
              <Link
                to={operationsLink(p.branchId, `payments/${p.id}`)}
                className="font-bold text-primary"
              >
                {p.reference}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {p.branchName} · {p.payerName}
                </span>
              </Link>
            ),
          },
          {
            label: 'Nghĩa vụ',
            render: (p) =>
              p.targetType === 'INVOICE'
                ? 'Hóa đơn'
                : p.targetType === 'PREPAID_RENT'
                  ? 'Trả trước'
                  : 'Giữ phòng',
          },
          {
            label: 'Nhận / phân bổ',
            render: (p) => (
              <>
                {formatVnd(p.amountReceived)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Phân bổ: {formatVnd(p.allocatedAmount)}
                </span>
              </>
            ),
          },
          {
            label: 'Trạng thái',
            render: (p) => (
              <>
                <ManagerStatus value={p.status} />
                <p className="mt-2 text-xs">
                  {p.method} · {p.environment === 'SANDBOX' ? 'Sandbox' : 'Thực tế'}
                </p>
              </>
            ),
          },
          {
            label: 'Ghi nhận',
            render: (p) => (
              <span className="text-xs">
                {dateTime(p.createdAt)}
                {p.note && <span className="mt-1 block text-muted-foreground">{p.note}</span>}
              </span>
            ),
          },
        ]}
      />
      <Notice>
        Mở giao dịch để xem chứng cứ, lịch sử và xác minh QR đủ điều kiện trong công cụ đối soát
        dùng chung. Hoàn tiền và kết nối ngân hàng thật chưa được triển khai.
      </Notice>
    </OwnerPage>
  )
}
