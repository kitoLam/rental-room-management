import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import { ManagerLink, ManagerPage, ManagerStatus, Records, SearchBox } from './components'
import { useManagerList } from './context'

export function ManagerUtilities() {
  const [q, setQ] = useState(''),
    [month, setMonth] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('utility-charges', { q, month, status, page: String(page - 1) })
  return (
    <ManagerPage
      title="Điện nước & chi phí"
      description="Mỗi khoản phí có các đoạn chỉ số, giá và phân bổ riêng."
      actions={
        <ManagerLink to="/manager/utility-charges/new" button>
          Tạo khoản phí
        </ManagerLink>
      }
    >
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <input
          aria-label="Tháng tính phí"
          type="month"
          className="input w-auto"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái khoản phí"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả</option>
          <option value="DRAFT">Nháp</option>
          <option value="FINALIZED">Đã chốt</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Khoản phí',
            render: (c) => (
              <>
                <ManagerLink to={`/manager/utility-charges/${c.id}`}>
                  {c.name} · {c.billingMonth.slice(0, 7)}
                </ManagerLink>
                <p className="text-xs text-muted-foreground">{c.roomName}</p>
              </>
            ),
          },
          {
            label: 'Giai đoạn',
            render: (c) => (
              <>
                {dateOnly(c.startDate)} – {dateOnly(c.endDate)}
                <p className="text-xs text-muted-foreground">{c.segments.length} đoạn</p>
              </>
            ),
          },
          { label: 'Tổng phí phòng', render: (c) => <strong>{formatVnd(c.totalAmount)}</strong> },
          { label: 'Trạng thái', render: (c) => <ManagerStatus value={c.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
