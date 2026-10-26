import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Images,
  KeyRound,
  MapPin,
  Ruler,
  Users,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Field,
  InlineError,
  Modal,
  Notice,
  Page,
  Panel,
  QueryState,
} from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { catalogService } from '@/services/guest-user'
import { provider } from '@/services/config'
import { addDays, dateRangeSchema, uuid } from '@/lib/validation'
import { formatVnd } from '@/lib/format'
import { getPriceUnit, getRoomBadge } from './lib/room-display'
import { heroMedia } from '@/features/home/data/hero-media'

export default function RoomDetailPage() {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const [gallery, setGallery] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [startDate, setStart] = useState(params.get('startDate') || addDays(1))
  const [endDate, setEnd] = useState(params.get('endDate') || addDays(31))
  const [slot, setSlot] = useState(params.get('slot') || '')
  const room = useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => catalogService.room(roomId),
    enabled: uuid(roomId),
  })
  const range = dateRangeSchema.safeParse({ startDate, endDate })
  const available = useQuery({
    queryKey: ['availability', roomId, startDate, endDate],
    queryFn: () => catalogService.availability(roomId, startDate, endDate),
    enabled: uuid(roomId) && range.success && provider('catalog') === 'mock',
  })
  if (!uuid(roomId))
    return (
      <Page title="Không tìm thấy phòng" back="/rooms">
        <Notice>Liên kết phòng không hợp lệ. Hãy chọn lại từ danh sách.</Notice>
      </Page>
    )
  const r = room.data
  const badge = r ? getRoomBadge(r) : null
  const bookable =
    r &&
    range.success &&
    available.data?.available &&
    (r.rentalMode === 'ROOM' || available.data.slots.some((s) => s.id === slot && s.available))
  const bookingUrl = `/rooms/${roomId}/bookings/new?${new URLSearchParams({ startDate, endDate, ...(slot ? { slot } : {}) })}`
  return (
    <Page
      title={r?.title || 'Thông tin phòng'}
      eyebrow={r?.branchName}
      back="/rooms"
      description={r?.address}
    >
      <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
        {r && (
          <>
            <div className="relative mb-9 grid aspect-[4/3] gap-3 overflow-hidden rounded-2xl sm:aspect-[2.3/1] sm:grid-cols-[2fr_1fr]">
              <button
                aria-label="Mở thư viện ảnh"
                onClick={() => {
                  setActiveImage(0)
                  setGallery(true)
                }}
                className="min-h-0 overflow-hidden"
              >
                <img
                  src={r.images[0] || heroMedia.poster}
                  onError={(e) => {
                    e.currentTarget.src = heroMedia.poster
                  }}
                  alt={r.imageAlt}
                  className="size-full object-cover"
                />
              </button>
              <div className="hidden min-h-0 grid-rows-2 gap-3 sm:grid">
                {r.images.slice(1, 3).map((src, i) => (
                  <button
                    key={src}
                    aria-label={`Xem ảnh ${i + 2}`}
                    className="overflow-hidden"
                    onClick={() => {
                      setActiveImage(i + 1)
                      setGallery(true)
                    }}
                  >
                    <img
                      src={src}
                      onError={(e) => {
                        e.currentTarget.src = heroMedia.poster
                      }}
                      alt={`${r.title}, góc nhìn ${i + 2}`}
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
              <Button
                variant="inverse"
                className="absolute right-4 bottom-4"
                onClick={() => setGallery(true)}
              >
                <Images />
                {r.images.length ? `${r.images.length} ảnh` : 'Ảnh minh họa'}
              </Button>
            </div>
            <div className="grid items-start gap-9 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
              <div className="min-w-0 space-y-8">
                <div className="flex flex-wrap gap-3">
                  <StatusBadge tone={badge!.tone}>{badge!.label}</StatusBadge>
                  <StatusBadge tone="neutral">
                    {r.rentalMode === 'ROOM' ? 'Nguyên phòng' : 'Theo chỗ / ở ghép'}
                  </StatusBadge>
                </div>
                <dl className="grid grid-cols-2 gap-5 border-y border-border py-6 sm:grid-cols-4">
                  {[
                    [Ruler, 'Diện tích', r.sizeM2 === null ? 'Chưa cập nhật' : `${r.sizeM2} m²`],
                    [Users, 'Sức chứa', `${r.capacity} người`],
                    [Building2, 'Tầng', r.floor === null ? 'Chưa cập nhật' : String(r.floor)],
                    [KeyRound, 'Loại phòng', r.roomTypeName],
                  ].map(([Icon, label, value]) => {
                    const I = Icon as typeof Ruler
                    return (
                      <div key={String(label)}>
                        <dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <I size={16} />
                          {String(label)}
                        </dt>
                        <dd className="text-sm font-bold">{String(value)}</dd>
                      </div>
                    )
                  })}
                </dl>
                <section>
                  <h2 className="mb-3 text-xl font-bold">Một chút về không gian</h2>
                  <p className="max-w-prose whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {r.description || 'Chi nhánh chưa cập nhật mô tả phòng.'}
                  </p>
                </section>
                <section>
                  <h2 className="mb-4 text-xl font-bold">Tiện nghi</h2>
                  {r.amenities.length ? (
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {r.amenities.map((item) => (
                        <li key={item} className="flex items-center gap-3 text-sm">
                          <Check className="size-4 text-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Thông tin tiện nghi đang được cập nhật.
                    </p>
                  )}
                </section>
                <section>
                  <h2 className="mb-4 text-xl font-bold">Dịch vụ tham khảo</h2>
                  {r.services.length ? (
                    <dl className="divide-y divide-border">
                      {r.services.map((s) => (
                        <div
                          key={s.name}
                          className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                        >
                          <dt>{s.name}</dt>
                          <dd>
                            {formatVnd(s.price)} / {s.unit}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Liên hệ chi nhánh để được cung cấp giá dịch vụ.
                    </p>
                  )}
                </section>
                <Panel>
                  <p className="mb-2 text-xs text-muted-foreground">CHI NHÁNH</p>
                  <h2 className="font-bold">{r.branchName}</h2>
                  <p className="my-3 flex gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" />
                    {r.address}
                  </p>
                  <Button asChild variant="link" className="px-0">
                    <Link to={`/branches/${r.branchId}`}>
                      Khám phá chi nhánh
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </Panel>
              </div>
              <aside className="space-y-5 lg:sticky lg:top-24">
                <Panel>
                  <p className="text-xs text-muted-foreground">GIÁ THAM KHẢO</p>
                  <p className="mt-2 text-xl font-bold text-primary">
                    {formatVnd(r.price)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {getPriceUnit(r)}
                    </span>
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Giá thuê chính thức được thỏa thuận khi lập hợp đồng. Khoản giữ chỗ được thông
                    báo riêng.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Field id="detail-start" label="Ngày bắt đầu">
                      <input
                        className="input"
                        id="detail-start"
                        type="date"
                        min={addDays(0)}
                        value={startDate}
                        onChange={(e) => {
                          setStart(e.target.value)
                          setSlot('')
                        }}
                      />
                    </Field>
                    <Field id="detail-end" label="Ngày kết thúc">
                      <input
                        className="input"
                        id="detail-end"
                        type="date"
                        min={startDate}
                        value={endDate}
                        onChange={(e) => {
                          setEnd(e.target.value)
                          setSlot('')
                        }}
                      />
                    </Field>
                  </div>
                  {!range.success && (
                    <div className="mt-3">
                      <InlineError error={new Error(range.error.issues[0].message)} />
                    </div>
                  )}
                  {r.rentalMode === 'SLOT' && available.data && (
                    <fieldset className="mt-5">
                      <legend className="mb-3 text-sm font-bold">Chọn chỗ ở</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {available.data.slots.map((s) => (
                          <label
                            key={s.id}
                            className={`flex min-h-12 items-center gap-2 rounded-lg border p-3 text-sm ${slot === s.id ? 'border-primary bg-primary-soft' : 'border-border'} ${!s.available ? 'text-muted-foreground' : ''}`}
                          >
                            <input
                              type="radio"
                              name="detail-slot"
                              className="accent-primary"
                              value={s.id}
                              checked={slot === s.id}
                              disabled={!s.available}
                              onChange={() => setSlot(s.id)}
                            />
                            {s.label}
                            {!s.available && ' · Đã kín'}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <div className="my-4 text-xs text-muted-foreground" role="status">
                    {provider('catalog') === 'real'
                      ? 'API chưa cung cấp lịch trống theo ngày. Chưa thể tạo yêu cầu giữ chỗ từ dữ liệu này.'
                      : available.isFetching
                        ? 'Đang kiểm tra lịch trống…'
                        : available.error
                          ? available.error.message
                          : available.data?.reason || 'Lịch trống phù hợp với khoảng ngày đã chọn.'}
                  </div>
                  <div className="grid gap-3">
                    {bookable && !available.isFetching ? (
                      <Button asChild>
                        <Link to={bookingUrl}>
                          <KeyRound />
                          Yêu cầu giữ chỗ
                        </Link>
                      </Button>
                    ) : (
                      <Button disabled>
                        <KeyRound />
                        Yêu cầu giữ chỗ
                      </Button>
                    )}
                    {r.operationalStatus === 'ACTIVE' ? (
                      <Button asChild variant="outline">
                        <Link to={`/rooms/${r.id}/appointments/new`}>
                          <CalendarDays />
                          Đặt lịch xem phòng
                        </Link>
                      </Button>
                    ) : (
                      <Button disabled variant="outline">
                        <CalendarDays />
                        Tạm ngừng nhận lịch xem
                      </Button>
                    )}
                  </div>
                  {!bookable && r.rentalMode === 'SLOT' && available.data?.available && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Chọn một chỗ còn trống để tiếp tục.
                    </p>
                  )}
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Bạn có thể giữ chỗ trực tiếp, không bắt buộc đặt lịch xem trước.
                  </p>
                </Panel>
              </aside>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-surface p-3 shadow-sm lg:hidden">
              <div>
                <p className="text-sm font-bold">{formatVnd(r.price)}</p>
                <p className="text-xs text-muted-foreground">Giá tham khảo{getPriceUnit(r)}</p>
              </div>
              {bookable && !available.isFetching ? (
                <Button asChild>
                  <Link to={bookingUrl}>Giữ chỗ</Link>
                </Button>
              ) : (
                <Button disabled>Giữ chỗ</Button>
              )}
              {r.operationalStatus === 'ACTIVE' ? (
                <Button asChild variant="outline" className="px-3">
                  <Link to={`/rooms/${r.id}/appointments/new`} aria-label="Đặt lịch xem phòng">
                    <CalendarDays />
                  </Link>
                </Button>
              ) : (
                <Button
                  disabled
                  variant="outline"
                  size="icon"
                  aria-label="Phòng tạm ngừng nhận lịch xem"
                >
                  <CalendarDays />
                </Button>
              )}
            </div>
            <Modal
              title="Khám phá không gian"
              description={r.title}
              open={gallery}
              onOpenChange={setGallery}
            >
              <img
                className="aspect-[4/3] w-full rounded-lg object-cover"
                src={r.images[activeImage] || heroMedia.poster}
                onError={(e) => {
                  e.currentTarget.src = heroMedia.poster
                }}
                alt={`${r.title}, ảnh ${activeImage + 1}`}
              />
              <div className="mt-4 flex gap-3 overflow-x-auto">
                {r.images.map((src, i) => (
                  <button
                    key={src}
                    aria-label={`Ảnh ${i + 1}`}
                    aria-pressed={activeImage === i}
                    className={`shrink-0 rounded-lg p-1 ${activeImage === i ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <img
                      src={src}
                      onError={(e) => {
                        e.currentTarget.src = heroMedia.poster
                      }}
                      className="h-16 w-24 rounded object-cover"
                      alt=""
                    />
                  </button>
                ))}
              </div>
            </Modal>
          </>
        )}
      </QueryState>
    </Page>
  )
}
