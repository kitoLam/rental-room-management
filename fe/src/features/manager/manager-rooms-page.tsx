import { formatVnd } from '@/lib/format'
import { provider } from '@/services/config'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ManagerLink, ManagerPage, ManagerStatus, Records, SearchBox } from './components'
import { useManagerList } from './context'

export function ManagerRooms() {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [mode, setMode] = useState(''),
    [status, setStatus] = useState(''),
    [availability, setAvailability] = useState(''),
    [type, setType] = useState(''),
    [price, setPrice] = useState(''),
    [minPrice, setMinPrice] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [capacity, setCapacity] = useState(''),
    types = useManagerList('room-types', { size: '100' }),
    query = useManagerList('rooms', {
      q,
      page: String(page - 1),
      rentalMode: mode,
      operationalStatus: status,
      availability,
      roomTypeId: type,
      maxPrice: price,
      minPrice,
      startDate: from,
      endDate: to,
      capacity,
    })
  return (
    <ManagerPage
      title="Phòng & chỗ ở"
      description="Tách trạng thái vận hành, công khai và khả dụng thực tế."
      actions={
        <ManagerLink to="/manager/rooms/new" button>
          <Plus size={16} />
          Tạo phòng
        </ManagerLink>
      }
    >
      <div className="flex flex-wrap gap-3">
        {provider('manager') === 'mock' && (
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
          />
        )}
        {provider('manager') === 'mock' && (
          <select
            aria-label="Hình thức thuê"
            className="input w-auto"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả hình thức</option>
            <option value="ROOM">Nguyên phòng</option>
            <option value="SLOT">Thuê chỗ</option>
          </select>
        )}
        <select
          aria-label="Loại phòng"
          className="input w-auto max-w-full"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả loại phòng</option>
          {types.data?.content.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Trạng thái vận hành"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả vận hành</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="MAINTENANCE">Bảo trì</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
        {provider('manager') === 'mock' && (
          <select
            aria-label="Khả dụng"
            className="input w-auto"
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả khả dụng</option>
            <option value="AVAILABLE">Có thể thuê</option>
            <option value="OCCUPIED">Kín chỗ / đang thuê</option>
            <option value="HELD">Đang giữ</option>
          </select>
        )}
        <input
          aria-label="Giá tham khảo tối đa"
          className="input max-w-48"
          type="number"
          min="0"
          placeholder="Giá tối đa (VND)"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value)
            setPage(1)
          }}
        />
        <input
          aria-label="Giá tham khảo tối thiểu"
          className="input max-w-48"
          type="number"
          min="0"
          placeholder="Giá tối thiểu (VND)"
          value={minPrice}
          onChange={(e) => {
            setMinPrice(e.target.value)
            setPage(1)
          }}
        />
        {provider('manager') === 'mock' && (
          <input
            aria-label="Khả dụng từ ngày"
            type="date"
            className="input w-auto"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        )}
        {provider('manager') === 'mock' && (
          <input
            aria-label="Khả dụng đến ngày"
            type="date"
            className="input w-auto"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        )}
        <input
          aria-label="Sức chứa tối thiểu"
          className="input max-w-48"
          type="number"
          min="1"
          placeholder="Sức chứa tối thiểu"
          value={capacity}
          onChange={(e) => {
            setCapacity(e.target.value)
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
            label: 'Phòng',
            render: (r) => (
              <div className="flex min-w-0 gap-3">
                <img
                  src={r.imageUrl}
                  alt={r.imageAlt}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <ManagerLink to={`/manager/rooms/${r.id}`}>{r.code}</ManagerLink>
                  <p className="break-words text-xs text-muted-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.roomTypeName} · Tầng {r.floor} · {r.sizeM2} m²
                  </p>
                </div>
              </div>
            ),
          },
          {
            label: 'Hình thức / sức chứa',
            render: (r) => (
              <>
                <p>
                  {r.rentalMode === 'ROOM' ? 'Nguyên phòng' : 'Thuê chỗ'} · {r.capacity} người
                </p>
                {provider('manager') === 'mock' && (
                  <p className="text-xs text-muted-foreground">
                    {r.occupiedResources} đang ở · {r.heldResources} giữ
                  </p>
                )}
              </>
            ),
          },
          {
            label: 'Giá tham khảo',
            render: (r) => <strong className="tabular-nums">{formatVnd(r.price)}</strong>,
          },
          {
            label: 'Trạng thái',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <ManagerStatus value={r.operationalStatus} />
                {provider('manager') === 'mock' && (
                  <ManagerStatus value={r.availability || 'UNKNOWN'} />
                )}
                <span className="text-xs text-muted-foreground">
                  {r.isPublic ? 'Công khai' : 'Nội bộ'}
                </span>
              </div>
            ),
          },
        ]}
      />
    </ManagerPage>
  )
}
