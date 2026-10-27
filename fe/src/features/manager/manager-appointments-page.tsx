import { appointmentStatuses } from '@/interfaces/domain'
import { dateTime } from '@/lib/activity'
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

export function ManagerAppointments() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({}),
    query = useManagerList('appointments', { q, status, ...scope, page: String(page - 1) }, true)
  return (
    <ManagerPage
      title="Lịch xem phòng"
      description="Tiếp nhận lịch từ người tìm phòng và cập nhật kết quả."
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
          aria-label="Trạng thái lịch xem"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {appointmentStatuses.map((s) => (
            <option key={s} value={s}>
              {
                {
                  PENDING: 'Chờ xác nhận',
                  CONFIRMED: 'Đã xác nhận',
                  COMPLETED: 'Hoàn tất',
                  REJECTED: 'Từ chối',
                  CANCELLED: 'Đã hủy',
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
            label: 'Người xem',
            render: (a) => (
              <>
                <strong>{a.requesterName}</strong>
                <p className="break-all text-xs text-muted-foreground">{a.requesterEmail}</p>
                <p className="text-xs text-muted-foreground">{a.requesterPhone}</p>
              </>
            ),
          },
          {
            label: 'Lịch xem',
            render: (a) => (
              <>
                <ManagerLink to={`/manager/appointments/${a.id}`}>{a.roomTitle}</ManagerLink>
                <p className="text-xs text-muted-foreground">{a.note}</p>
              </>
            ),
          },
          {
            label: 'Thời gian',
            render: (a) => (
              <>
                {dateTime(a.startAt)}
                <p className="text-xs text-muted-foreground">Đến {dateTime(a.endAt)}</p>
              </>
            ),
          },
          { label: 'Phụ trách', render: (a) => a.assignedManager || 'Chưa phân công' },
          { label: 'Trạng thái', render: (a) => <ManagerStatus value={a.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
