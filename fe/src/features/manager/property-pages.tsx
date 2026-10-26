import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { Plus } from 'lucide-react'
import { Panel, QueryState, Modal, Notice, InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { formatVnd } from '@/lib/format'
import { dateOnly } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import { provider } from '@/services/config'
import { roomInputSchema, slotInputSchema, type ManagerSlot } from '@/interfaces/manager'
import {
  ManagerPage,
  ManagerLink,
  ManagerStatus,
  Records,
  SearchBox,
  ManagerForm,
  ImagePicker,
  ActionDialog,
  type FieldSpec,
} from './components'
import {
  useManager,
  useManagerList,
  useManagerQuery,
  useManagerAction,
  managerLink,
} from './context'

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
        {provider('manager') === 'mock' && <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />}
        {provider('manager') === 'mock' && <select
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
        </select>}
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
        {provider('manager') === 'mock' && <select
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
        </select>}
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
        {provider('manager') === 'mock' && <input
          aria-label="Khả dụng từ ngày"
          type="date"
          className="input w-auto"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
        />}
        {provider('manager') === 'mock' && <input
          aria-label="Khả dụng đến ngày"
          type="date"
          className="input w-auto"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
        />}
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
            {provider('manager') === 'mock' && <p className="text-xs text-muted-foreground">{r.occupiedResources} đang ở · {r.heldResources} giữ</p>}
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
                {provider('manager') === 'mock' && <ManagerStatus value={r.availability || 'UNKNOWN'} />}
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
export function ManagerRoomEditor() {
  const { roomId } = useParams(),
    { branch } = useManager(),
    navigate = useNavigate(),
    types = useManagerList('room-types', { size: '100' }),
    query = useManagerQuery(
      'room-editor',
      (b) => (roomId ? managerApi.get(b, 'rooms', roomId) : Promise.resolve(null)),
      [roomId],
    ),
    [images, setImages] = useState<string[] | null>(null),
    [preview, setPreview] = useState<Record<string, unknown> | null>(null),
    mutation = useManagerAction((result) => {
      setPreview(null)
      navigate(managerLink(`/manager/rooms/${result?.id || roomId}`, branch.id))
    })
  const fields: FieldSpec[] = [
    { name: 'code', label: 'Mã phòng' },
    ...(provider('manager') === 'mock' ? [{ name: 'title', label: 'Tên phòng' }] : []),
    {
      name: 'roomTypeId',
      label: 'Loại phòng',
      kind: 'select',
      options: types.data?.content
        .filter((t) => t.active)
        .map((t) => ({ value: t.id, label: t.name })),
    },
    {
      name: 'rentalMode',
      label: 'Hình thức thuê',
      kind: 'select',
      options: [
        { value: 'ROOM', label: 'Nguyên phòng' },
        { value: 'SLOT', label: 'Thuê chỗ' },
      ],
    },
    { name: 'capacity', label: 'Sức chứa (người)', kind: 'number', min: 1 },
    { name: 'sizeM2', label: 'Diện tích (m²)', kind: 'number', min: 1, step: 0.1, nullable: true },
    { name: 'floor', label: 'Tầng', kind: 'number', min: 0, nullable: true },
    { name: 'price', label: 'Giá tham khảo (VND)', kind: 'number', min: 0 },
    { name: 'description', label: 'Mô tả', kind: 'textarea' },
    { name: 'amenities', label: 'Tiện nghi', kind: 'list', hint: 'Mỗi dòng một tiện nghi.' },
    {
      name: 'operationalStatus',
      label: 'Vận hành',
      kind: 'select',
      options: [
        { value: 'ACTIVE', label: 'Hoạt động' },
        { value: 'MAINTENANCE', label: 'Bảo trì' },
        { value: 'INACTIVE', label: 'Ngừng hoạt động' },
      ],
    },
    { name: 'isPublic', label: 'Công khai trên trang tìm phòng', kind: 'check' },
  ]
  return (
    <ManagerPage
      title={roomId ? 'Chỉnh sửa phòng' : 'Tạo phòng'}
      actions={
        <ManagerLink to={roomId ? `/manager/rooms/${roomId}` : '/manager/rooms'}>
          Quay lại
        </ManagerLink>
      }
    >
      <QueryState
        pending={query.isPending || types.isPending}
        error={query.error || types.error}
        retry={() => {
          void query.refetch()
          void types.refetch()
        }}
      >
        <Panel>
          <ManagerForm
            schema={provider('manager') === 'real' ? roomInputSchema.omit({ images: true, title: true }) : roomInputSchema.omit({ images: true })}
            defaults={
              query.data
                ? { ...query.data }
                : {
                    code: '',
                    title: '',
                    roomTypeId: '',
                    rentalMode: 'ROOM',
                    capacity: 2,
                    sizeM2: 25,
                    floor: 1,
                    price: 3000000,
                    description: '',
                    amenities: [],
                    operationalStatus: 'ACTIVE',
                    isPublic: false,
                  }
            }
            fields={fields}
            onSubmit={(value) =>
              setPreview({
                ...value,
                title: value.title || `${types.data?.content.find((t) => t.id === value.roomTypeId)?.name || 'Phòng'} ${value.code}`,
                images: images || query.data?.images || [],
              })
            }
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xem trước"
          >
            <ImagePicker
              value={images || query.data?.images || []}
              onChange={setImages}
              disabled={mutation.isPending}
            />
          </ManagerForm>
        </Panel>
      </QueryState>
      <Modal
        title="Xem trước thông tin phòng"
        open={!!preview}
        onOpenChange={(v) => {
          if (!mutation.isPending && !v) setPreview(null)
        }}
      >
        {preview && (
          <div className="grid gap-5">
            <h2 className="text-xl font-bold">{String(preview.title)}</h2>
            <Facts
              items={[
                ['Chi nhánh', branch.name],
                ['Mã phòng', String(preview.code)],
                ['Hình thức', preview.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Nguyên phòng'],
                ['Giá tham khảo', formatVnd(Number(preview.price))],
              ]}
            />
            <Notice>Giá tham khảo không thay thế giá thuê đã thỏa thuận trong hợp đồng.</Notice>
            <InlineError error={mutation.error} />
            <Button
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  resource: 'rooms',
                  id: roomId,
                  value: preview,
                  method: roomId ? 'PATCH' : 'POST',
                })
              }
            >
              Lưu phòng
            </Button>
          </div>
        )}
      </Modal>
    </ManagerPage>
  )
}
export function ManagerRoomDetail() {
  const { roomId = '' } = useParams(),
    query = useManagerQuery('room', (b) => managerApi.get(b, 'rooms', roomId), [roomId]),
    [deleting, setDeleting] = useState(false),
    { branch } = useManager(),
    navigate = useNavigate(),
    mutation = useManagerAction(() => navigate(managerLink('/manager/rooms', branch.id)))
  return (
    <ManagerPage
      title="Thông tin phòng"
      actions={<ManagerLink to="/manager/rooms">Danh sách phòng</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {query.data.code} · {query.data.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{query.data.roomTypeName}</p>
                </div>
                {provider('manager') === 'mock' && <ManagerStatus value={query.data.availability || 'UNKNOWN'} />}
              </div>
              <Facts
                items={[
                  ['Hình thức', query.data.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Nguyên phòng'],
                  ['Sức chứa', `${query.data.capacity} người`],
                  ['Diện tích / tầng', `${query.data.sizeM2} m² · Tầng ${query.data.floor}`],
                  ['Giá tham khảo', formatVnd(query.data.price)],
                  ['Vận hành', <ManagerStatus value={query.data.operationalStatus} />],
                  ['Công khai', query.data.isPublic ? 'Có' : 'Không'],
                ]}
              />
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {query.data.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                <ManagerLink to={`/manager/rooms/${roomId}/edit`}>Chỉnh sửa</ManagerLink>
                {query.data.rentalMode === 'SLOT' && (
                  <ManagerLink to={`/manager/rooms/${roomId}/slots`}>Quản lý chỗ</ManagerLink>
                )}
                <ManagerLink to="/manager/tenants" params={{ roomId }}>
                  Người thuê / lịch sử
                </ManagerLink>
                <ManagerLink to="/manager/room-services" params={{ roomId }}>
                  Cấu hình dịch vụ
                </ManagerLink>
                <Button variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
                  Xóa khi đủ điều kiện
                </Button>
              </div>
            </Panel>
            <div className="grid grid-cols-3 gap-3">
              {query.data.images.map((src) => (
                <img
                  key={src}
                  className="aspect-square w-full rounded-lg object-cover"
                  src={src}
                  alt={query.data!.title}
                />
              ))}
            </div>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Xóa phòng chưa có hồ sơ liên quan?"
        open={deleting}
        onOpenChange={setDeleting}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() =>
          mutation.mutate({ resource: 'rooms', id: roomId, value: {}, method: 'DELETE' })
        }
      />
    </ManagerPage>
  )
}
export function ManagerSlots() {
  const { roomId = '' } = useParams(),
    query = useManagerList('slots', { roomId, size: '100' }),
    room = useManagerQuery('room', (b) => managerApi.get(b, 'rooms', roomId), [roomId]),
    [selected, setSelected] = useState<ManagerSlot | null | undefined>(undefined),
    [from, setFrom] = useState(new Date().toISOString().slice(0, 10)),
    [to, setTo] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
    availability = useManagerList('slots', provider('manager') === 'mock' ? { roomId, size: '100', startDate: from, endDate: to } : { roomId, size: '100' }),
    mutation = useManagerAction(() => setSelected(undefined))
  return (
    <ManagerPage
      title="Chỗ ở trong phòng"
      description={room.data?.title}
      actions={<ManagerLink to={`/manager/rooms/${roomId}`}>Về phòng</ManagerLink>}
    >
      <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
        {room.data?.rentalMode === 'ROOM' ? (
          <Notice>Phòng nguyên căn không có danh sách chỗ thuê SLOT.</Notice>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              {provider('manager') === 'mock' && <>
              <div>
                <label className="mb-2 block text-xs" htmlFor="slot-from">
                  Từ ngày
                </label>
                <input
                  id="slot-from"
                  type="date"
                  className="input"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs" htmlFor="slot-to">
                  Đến ngày (không gồm)
                </label>
                <input
                  id="slot-to"
                  type="date"
                  className="input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              </>}
              <Button onClick={() => setSelected(null)}>
                <Plus size={16} />
                Thêm chỗ
              </Button>
            </div>
            <Records
              query={availability}
              page={1}
              onPage={() => undefined}
              columns={[
                {
                  label: 'Chỗ ở',
                  render: (s) => (
                    <button
                      className="min-h-11 text-left font-bold text-primary"
                      onClick={() => setSelected(s)}
                    >
                      {s.code} · {s.name}
                    </button>
                  ),
                },
                ...(provider('manager') === 'real' ? [{ label: 'Trạng thái vận hành', render: (s: ManagerSlot) => <ManagerStatus value={s.operationalStatus} /> }] : []),
                ...(provider('manager') === 'mock' ? [{ label: 'Khả dụng', render: (s: ManagerSlot) => <ManagerStatus value={s.availability || 'UNKNOWN'} /> }] : []),
                ...(provider('manager') === 'mock' ? [{
                  label: 'Cư trú / lịch sử',
                  render: (s: ManagerSlot) => (
                    <div className="grid gap-2">
                      {s.occupancy?.length
                        ? s.occupancy!.map((o) => (
                            <div key={o.id}>
                              <ManagerLink to={`/manager/tenancies/${o.id}`}>{o.name}</ManagerLink>
                              <p className="text-xs text-muted-foreground">
                                {dateOnly(o.startDate)} – {dateOnly(o.endDate)} ·{' '}
                                <ManagerStatus value={o.status} />
                              </p>
                            </div>
                          ))
                        : 'Chưa có cư trú'}
                    </div>
                  ),
                }] : []),
              ]}
              empty="Phòng chưa có chỗ. Thêm chỗ trong giới hạn sức chứa."
            />
          </>
        )}
      </QueryState>
      <Modal
        title={selected ? 'Chỉnh sửa chỗ' : 'Thêm chỗ'}
        open={selected !== undefined}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setSelected(undefined)
        }}
      >
        {selected !== undefined && (
          <ManagerForm
            schema={slotInputSchema}
            defaults={
              selected ? { ...selected } : { code: '', name: '', operationalStatus: 'ACTIVE' }
            }
            fields={[
              { name: 'code', label: 'Mã chỗ' },
              { name: 'name', label: 'Tên chỗ' },
              {
                name: 'operationalStatus',
                label: 'Vận hành',
                kind: 'select',
                options: [
                  { value: 'ACTIVE', label: 'Hoạt động' },
                  { value: 'MAINTENANCE', label: 'Bảo trì' },
                  { value: 'INACTIVE', label: 'Ngừng sử dụng' },
                ],
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'slots',
                id: selected?.id,
                value: { ...value, roomId },
                method: selected ? 'PATCH' : 'POST',
              })
            }
          />
        )}
      </Modal>
      <InlineError error={query.error} />
    </ManagerPage>
  )
}
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
export function ManagerTenancyDetail() {
  const { contractTenantId = '' } = useParams(),
    query = useManagerQuery('tenancy', (b) => managerApi.get(b, 'tenants', contractTenantId), [
      contractTenantId,
    ]),
    invoices = useManagerList('invoices', { contractTenantId, size: '100' }),
    services = useManagerList('service-requests', { contractTenantId, size: '100' })
  return (
    <ManagerPage
      title="Hồ sơ thuê cá nhân"
      actions={<ManagerLink to="/manager/tenants">Danh sách người thuê</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.userName}</h2>
              <Facts
                items={[
                  [
                    'Liên hệ',
                    `${query.data.email} · ${query.data.phone || 'Chưa có số điện thoại'}`,
                  ],
                  [
                    'Chỗ ở',
                    `${query.data.roomName}${query.data.slotName ? ` · ${query.data.slotName}` : ''}`,
                  ],
                  ['Quan hệ thuê', query.data.id],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Vai trò', query.data.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'],
                  ['Cư trú', `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`],
                  [
                    'Ngày rời thực tế',
                    query.data.actualLeaveDate ? dateOnly(query.data.actualLeaveDate) : 'Chưa có',
                  ],
                  ['Giá thỏa thuận / tháng', formatVnd(query.data.monthlyRent)],
                  [
                    'Trả trước kỳ đầu / cuối',
                    `${formatVnd(query.data.prepaidFirstRequired)} / ${formatVnd(query.data.prepaidLastRequired)}`,
                  ],
                ]}
              />
              <p className="mt-5 text-sm leading-7 text-muted-foreground">{query.data.terms}</p>
              <div className="mt-5 flex flex-wrap gap-x-6">
                <ManagerLink to={`/manager/contracts/${query.data.contractId}`}>
                  Hợp đồng
                </ManagerLink>
                <ManagerLink to={`/manager/contracts/${query.data.contractId}/tenants`}>
                  Nghĩa vụ cá nhân
                </ManagerLink>
                <ManagerLink
                  to={`/manager/rooms/${query.data.roomId}${query.data.rentalMode === 'SLOT' ? '/slots' : ''}`}
                >
                  Cư trú / chỗ ở
                </ManagerLink>
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Hóa đơn & dịch vụ</h2>
              <QueryState
                pending={invoices.isPending || services.isPending}
                error={invoices.error || services.error}
                retry={() => {
                  void invoices.refetch()
                  void services.refetch()
                }}
              >
                {invoices.data?.content.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap justify-between gap-3 border-t border-border py-3"
                  >
                    <ManagerLink to={`/manager/invoices/${i.id}`}>{i.code}</ManagerLink>
                    <span className="text-sm">Còn {formatVnd(i.outstanding)}</span>
                  </div>
                ))}
                {services.data?.content.map((s) => (
                  <p key={s.id} className="border-t border-border py-3 text-sm">
                    {s.name} · <ManagerStatus value={s.status || 'DRAFT'} />
                  </p>
                ))}
              </QueryState>
            </Panel>
          </>
        )}
      </QueryState>
    </ManagerPage>
  )
}
