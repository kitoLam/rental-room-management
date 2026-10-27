import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import {
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  ScopeFilters,
  SearchBox,
} from './components'
import { useManagerList } from './context'

export function ManagerPayments() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [type, setType] = useState(''),
    [environment, setEnvironment] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({
      month: new URLSearchParams(location.search).get('month') || '',
    }),
    query = useManagerList(
      'payments',
      { q, status, targetType: type, environment, ...scope, page: String(page - 1) },
      true,
    )
  return (
    <ManagerPage
      title="Thanh toán & đối soát"
      description="Tách tiền giữ phòng, trả trước, tiền hóa đơn và giao dịch mô phỏng."
    >
      <ScopeFilters
        value={scope}
        onChange={(v) => {
          setScope(v)
          setPage(1)
        }}
        tenant
        dates
      />
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Loại thanh toán"
          className="input w-auto"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="BOOKING_HOLD">Giữ phòng</option>
          <option value="PREPAID_RENT">Thuê trả trước</option>
          <option value="INVOICE">Hóa đơn</option>
        </select>
        <select
          aria-label="Môi trường thanh toán"
          className="input w-auto"
          value={environment}
          onChange={(e) => {
            setEnvironment(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả môi trường</option>
          <option value="SANDBOX">Mô phỏng</option>
          <option value="LIVE">Biên nhận ngân hàng</option>
          <option value="PRODUCTION">Nhà cung cấp</option>
        </select>
        <select
          aria-label="Trạng thái thanh toán"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ xác minh</option>
          <option value="VERIFIED">Đã xác minh</option>
          <option value="REVIEW">Cần đối soát</option>
          <option value="FAILED">Thất bại</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Giao dịch',
            render: (p) => (
              <>
                <ManagerLink to={`/manager/payments/${p.id}`}>{p.reference}</ManagerLink>
                <p className="text-xs text-muted-foreground">
                  {p.payerName} · {dateTime(p.createdAt)}
                </p>
              </>
            ),
          },
          {
            label: 'Nghĩa vụ',
            render: (p) => (
              <>
                <p>
                  {p.targetType === 'BOOKING_HOLD'
                    ? 'Giữ phòng'
                    : p.targetType === 'PREPAID_RENT'
                      ? 'Thuê trả trước'
                      : 'Hóa đơn'}
                </p>
                <p className="text-xs text-muted-foreground">{p.tenantName}</p>
              </>
            ),
          },
          {
            label: 'Nhận / phân bổ',
            render: (p) => (
              <>
                {formatVnd(p.amountReceived)}
                <p className="text-xs text-muted-foreground">
                  Phân bổ {formatVnd(p.allocatedAmount)}
                </p>
              </>
            ),
          },
          {
            label: 'Trạng thái',
            render: (p) => (
              <>
                <ManagerStatus value={p.status} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.environment === 'SANDBOX' ? 'Mô phỏng' : 'Biên nhận / nhà cung cấp'}
                </p>
              </>
            ),
          },
        ]}
      />
    </ManagerPage>
  )
}
