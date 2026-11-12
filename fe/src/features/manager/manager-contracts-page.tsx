import { dateOnly } from '@/lib/activity'
import { useState } from 'react'
import { ManagerLink, ManagerPage, ManagerStatus, Records, SearchBox, ExpiringSoonBadge } from './components'
import { useManagerList } from './context'

export function ManagerContracts() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('contracts', { q, status, page: String(page - 1) }, true)
  return (
    <ManagerPage title="Hợp đồng thuê">
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái hợp đồng"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="ACTIVE">Hiệu lực</option>
          <option value="ENDED">Kết thúc</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Hợp đồng',
            render: (c) => (
              <>
                <ManagerLink to={`/manager/contracts/${c.id}`}>{c.code}</ManagerLink>
                <p className="text-xs text-muted-foreground">{c.roomName}</p>
              </>
            ),
          },
          {
            label: 'Đại diện / thành viên',
            render: (c) => (
              <>
                {c.representativeName || 'Chưa có đại diện'}
                <p className="text-xs text-muted-foreground">
                  {c.tenantCount} quan hệ thuê ·{' '}
                  {c.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Nguyên phòng'}
                </p>
              </>
            ),
          },
          {
            label: 'Thời hạn',
            render: (c) => (
              <>
                {c.startDate && c.endDate
                  ? `${dateOnly(c.startDate)} – ${dateOnly(c.endDate)}`
                  : 'Chưa duyệt evidence'}
              </>
            ),
          },
          { label: 'Trạng thái', render: (c) => (
            <div className="flex flex-wrap items-center gap-2">
              <ManagerStatus value={c.status} />
              {c.expiringSoon && <ExpiringSoonBadge />}
            </div>
          ) },
        ]}
      />
    </ManagerPage>
  )
}
