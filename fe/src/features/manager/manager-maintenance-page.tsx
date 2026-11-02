import { dateTime } from '@/lib/activity'
import { useState } from 'react'
import { ManagerLink, ManagerPage, ManagerStatus, Records, SearchBox } from './components'
import { useManagerList } from './context'

export function ManagerMaintenance() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('maintenance', { q, status, page: String(page - 1) }, true)
  return (
    <ManagerPage title="Quản lý yêu cầu hỗ trợ & Bảo trì">
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái yêu cầu"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ xử lý / Mới gửi</option>
          <option value="WAITING_INFO">Chờ bổ sung</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="RESOLVED">Đã giải quyết</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="REJECTED">Từ chối</option>
          <option value="ESCALATED_ADMIN">Chuyển Admin</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Yêu cầu',
            render: (r) => (
              <>
                <ManagerLink to={`/manager/maintenance/${r.id}`}>{r.title}</ManagerLink>
                <p className="text-xs text-muted-foreground">
                  {r.assetName} · {r.roomName}
                </p>
              </>
            ),
          },
          {
            label: 'Người gửi',
            render: (r) => (
              <>
                <p>{r.tenantName}</p>
                <p className="text-xs text-muted-foreground">{dateTime(r.createdAt)}</p>
              </>
            ),
          },
          { label: 'Mức độ', render: (r) => <ManagerStatus value={r.priority} /> },
          {
            label: 'Xử lý',
            render: (r) => (
              <>
                <ManagerStatus value={r.status} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.assignedTo || 'Chưa phân công'}
                </p>
              </>
            ),
          },
        ]}
      />
    </ManagerPage>
  )
}
