import { dateTime, vnDateKey } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import {
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  SearchBox,
} from './components'
import { useManagerList } from './context'

export function ManagerPayments() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [date, setDate] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList(
      'payments',
      {
        q,
        status,
        date,
        page: String(page - 1),
      },
      true,
    )

  const filteredContent = query.data
    ? query.data.content.filter((p) => {
        if (date) {
          const created = vnDateKey(p.createdAt)
          const verified = vnDateKey(p.verifiedAt)
          if (created !== date && verified !== date) return false
        }
        return true
      })
    : undefined

  const filteredQuery = {
    ...query,
    data:
      query.data && filteredContent
        ? {
            ...query.data,
            content: filteredContent,
            totalElements: date ? filteredContent.length : query.data.totalElements,
            totalPages: date
              ? Math.max(1, Math.ceil(filteredContent.length / (query.data.size || 8)))
              : query.data.totalPages,
          }
        : undefined,
  }

  return (
    <ManagerPage
      title="Thanh toán & đối soát"
      description="Tách tiền giữ phòng, trả trước, tiền hóa đơn và giao dịch mô phỏng."
    >
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
          placeholder="Tìm theo mã hoặc tên..."
        />
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
        <input
          aria-label="Lọc theo ngày"
          className="input w-auto"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPage(1)
          }}
        />
        {date && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => {
              setDate('')
              setPage(1)
            }}
          >
            Xóa lọc ngày
          </button>
        )}
      </div>
      <Records
        query={filteredQuery}
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
