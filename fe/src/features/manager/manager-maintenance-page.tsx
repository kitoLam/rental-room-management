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
    <ManagerPage title="Sửa chữa & bảo trì">
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái sửa chữa"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mới gửi</option>
          <option value="ACCEPTED">Đã tiếp nhận</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="COMPLETED">Hoàn tất</option>
          <option value="REJECTED">Từ chối</option>
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
