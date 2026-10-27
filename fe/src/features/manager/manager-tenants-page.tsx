import { dateOnly } from '@/lib/activity'
import { useState } from 'react'
import { Link } from 'react-router'
import { ManagerLink, ManagerPage, ManagerStatus, Records, SearchBox } from './components'
import { managerLink, useManager, useManagerList } from './context'

export function ManagerTenants() {
  const { branch } = useManager(),
    [params] = useState(() => new URLSearchParams(location.search)),
    [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [roomId, setRoom] = useState(params.get('roomId') || ''),
    [slotId, setSlot] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1),
    rooms = useManagerList('rooms', { size: '100' }),
    slots = useManagerList('slots', { size: '100', roomId }),
    query = useManagerList('tenants', {
      q,
      status,
      roomId,
      roomSlotId: slotId,
      from,
      to,
      page: String(page - 1),
    })
  return (
    <ManagerPage
      title="Người thuê"
      description="Tài khoản là hồ sơ gốc; mỗi quan hệ thuê có nghĩa vụ và lịch sử riêng."
      actions={
        <ManagerLink to="/manager/contracts/new" button>
          Tiếp nhận qua hợp đồng
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
        <select
          aria-label="Phòng"
          className="input w-auto max-w-full"
          value={roomId}
          onChange={(e) => {
            setRoom(e.target.value)
            setSlot('')
            setPage(1)
          }}
        >
          <option value="">Tất cả phòng</option>
          {rooms.data?.content.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </select>
        <select
          aria-label="Chỗ ở"
          className="input w-auto"
          value={slotId}
          onChange={(e) => {
            setSlot(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả chỗ</option>
          {slots.data?.content.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Quan hệ thuê"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang thuê</option>
          <option value="DRAFT">Chưa kích hoạt</option>
          <option value="LEFT">Đã rời đi</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <input
          aria-label="Cư trú từ ngày"
          type="date"
          className="input w-auto"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
        />
        <input
          aria-label="Cư trú đến ngày"
          type="date"
          className="input w-auto"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
        />
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Người thuê',
            render: (t) => (
              <>
                <Link
                  to={managerLink(`/manager/tenancies/${t.id}`, branch.id)}
                  className="min-h-11 font-bold text-primary"
                >
                  {t.userName}
                </Link>
                <p className="break-all text-xs text-muted-foreground">{t.email}</p>
                <p className="text-xs text-muted-foreground">{t.phone}</p>
              </>
            ),
          },
          {
            label: 'Chỗ ở',
            render: (t) => (
              <>
                <p>
                  {t.roomName}
                  {t.slotName && ` · ${t.slotName}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'}
                </p>
              </>
            ),
          },
          {
            label: 'Thời hạn',
            render: (t) => (
              <p>
                {dateOnly(t.startDate)} – {dateOnly(t.endDate)}
              </p>
            ),
          },
          { label: 'Trạng thái', render: (t) => <ManagerStatus value={t.status} /> },
        ]}
        empty="Chưa có quan hệ thuê phù hợp."
      />
    </ManagerPage>
  )
}
