import { bookingStatuses } from '@/interfaces/domain'
import { dateOnly } from '@/lib/activity'
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

export function ManagerBookings() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({}),
    query = useManagerList('bookings', { q, status, ...scope, page: String(page - 1) }, true)
  return (
    <ManagerPage
      title="Giữ phòng"
      description="Theo dõi khoản giữ đã xác minh và thời hạn của từng yêu cầu."
    >
      <ScopeFilters
        value={scope}
        onChange={(v) => {
          setScope(v)
          setPage(1)
        }}
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
          aria-label="Trạng thái giữ phòng"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {bookingStatuses.map((s) => (
            <option key={s} value={s}>
              {
                {
                  REQUESTED: 'Đã yêu cầu',
                  AWAITING_PAYMENT: 'Chờ thanh toán',
                  CONFIRMED: 'Đã xác nhận',
                  CONVERTED: 'Đã chuyển hợp đồng',
                  EXPIRED: 'Hết hạn',
                  CANCELLED: 'Đã hủy',
                  REJECTED: 'Từ chối',
                }[s]
              }
            </option>
          ))}
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Giữ phòng',
            render: (b) => (
              <>
                <ManagerLink to={`/manager/bookings/${b.id}`}>{b.roomTitle}</ManagerLink>
                <p className="text-xs text-muted-foreground">{b.slotLabel || 'Nguyên phòng'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.requesterName} · {b.requesterPhone || b.requesterEmail}
                </p>
              </>
            ),
          },
          {
            label: 'Thời hạn thuê',
            render: (b) => (
              <>
                {dateOnly(b.startDate)} – {dateOnly(b.endDate)}
              </>
            ),
          },
          {
            label: 'Khoản giữ',
            render: (b) => (
              <>
                <strong>{formatVnd(b.holdAmount)}</strong>
                <p className="text-xs text-muted-foreground">
                  {b.paymentEnvironment === 'SANDBOX' ? 'Mô phỏng' : 'Nhà cung cấp'}
                </p>
              </>
            ),
          },
          { label: 'Trạng thái', render: (b) => <ManagerStatus value={b.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
