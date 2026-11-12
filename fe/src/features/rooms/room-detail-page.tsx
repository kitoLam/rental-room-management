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
import { Modal, InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { bookingService, catalogService } from '@/services/guest-user'
import { provider } from '@/services/config'
import { viewingDependenciesService } from '@/services/viewing-dependencies'
import { databaseIdSchema } from '@/interfaces/domain'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { getPriceUnit, getRoomBadge } from './lib/room-display'
import { heroMedia } from '@/features/home/data/hero-media'
import { RoomCostEstimator } from './components/room-cost-estimator'
import { RoomServicePicker } from './components/room-service-picker'
import { selectedServiceCosts, type ServiceSelection } from './lib/cost-estimate'
import { useSession } from '@/features/auth/session-store'
import { managerApi } from '@/services/manager'

const readJson = <T,>(raw: string | null, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export default function RoomDetailPage() {
  const { roomId = '' } = useParams()
  const user = useSession((state) => state.user)
  const branches = useQuery({
    queryKey: ['manager-branches', user?.id],
    queryFn: managerApi.branches,
    enabled: !!user?.roles.some((role) => role === 'OWNER' || role === 'MANAGER'),
    retry: false,
  })
  const validRoomId = databaseIdSchema.safeParse(roomId).success
  const [params] = useSearchParams()
  const [gallery, setGallery] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [selectedSlots, setSelectedSlots] = useState<string[]>(() =>
    readJson(params.get('slots'), []),
  )
  const room = useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => catalogService.room(roomId),
    enabled: validRoomId,
  })
  const [serviceSelection, setServiceSelection] = useState<ServiceSelection>(() =>
    readJson(params.get('services'), {}),
  )
  const roomServices = useQuery({
    queryKey: ['room-services', roomId],
    queryFn: () => catalogService.services(room.data!),
    enabled: !!room.data,
  })
  const bookingAvailabilityEnabled =
    provider('catalog') === 'mock' || provider('leasing') === 'real'
  const available = useQuery({
    queryKey: ['availability', roomId],
    queryFn: () => {
      const today = new Date().toISOString().slice(0, 10)
      return provider('catalog') === 'mock'
        ? catalogService.availability(roomId, today, '9999-12-31')
        : bookingService.availabilityForRoom(roomId, today, '9999-12-31')
    },
    enabled: validRoomId && bookingAvailabilityEnabled,
  })
  const viewing = useQuery({
    queryKey: ['viewing-eligibility', roomId],
    queryFn: () => viewingDependenciesService.eligibility(roomId),
    enabled: validRoomId && provider('viewing') === 'real',
    retry: false,
    refetchInterval: 30000,
  })
  if (!validRoomId)
    return (
      <Page title="Không tìm thấy phòng" back="/rooms">
        <Notice>Liên kết phòng không hợp lệ. Hãy chọn lại từ danh sách.</Notice>
      </Page>
    )
  const r = room.data
  const badge = r ? getRoomBadge(r) : null
  const bookable =
    r &&
    available.data?.available &&
    selectedSlots.length > 0 &&
    selectedSlots.every((id) => available.data.slots.some((s) => s.id === id && s.available))
  const bookingUrl = `/rooms/${roomId}/bookings/new?${new URLSearchParams({ slots: JSON.stringify(selectedSlots), services: JSON.stringify(serviceSelection) })}`
  const viewingUrl = `/rooms/${roomId}/appointments/new?${new URLSearchParams({ slots: JSON.stringify(selectedSlots) })}`
  const canView =
    !!viewing.data?.canReceiveRequest &&
    selectedSlots.length > 0 &&
    selectedSlots.every((id) =>
      viewing.data.slots.some((slot) => slot.id === id && slot.selectable),
    )
  const earliestAvailableFrom =
    (available.data?.slots ?? [])
      .flatMap((s) =>
        (s.available || s.availableFrom) && s.availableFrom ? [s.availableFrom] : [],
      )
      .sort()[0] ?? null
  return (
    <Page
      wide
      title={r?.title || 'Thông tin phòng'}
      eyebrow={r?.branchName}
      back="/rooms"
      description={r?.address}
    >
      <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
        {r && (
          <>
            <div
              className={`relative mb-8 grid h-[300px] gap-3 overflow-hidden rounded-2xl bg-primary-soft sm:h-[420px] xl:h-[520px] ${r.images.length > 1 ? 'sm:grid-cols-[2fr_1fr]' : ''}`}
            >
              <button
                aria-label="Mở thư viện ảnh"
                onClick={() => {
                  setActiveImage(0)
                  setGallery(true)
                }}
                className="group min-h-0 min-w-0 overflow-hidden focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-primary"
              >
                <img
                  src={r.images[0] || heroMedia.poster}
                  onError={(e) => {
                    e.currentTarget.src = heroMedia.poster
                  }}
                  alt={
                    r.images.length
                      ? r.imageAlt
                      : 'Ảnh minh họa không gian sống, không phải ảnh thực tế của phòng'
                  }
                  className="size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]"
                />
              </button>
              {r.images.length > 1 && (
                <div
                  className={`hidden min-h-0 gap-3 sm:grid ${r.images.length > 2 ? 'grid-rows-2' : 'grid-rows-1'}`}
                >
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
              )}
              <Button
                variant="inverse"
                className="absolute right-5 bottom-5 shadow-lg"
                onClick={() => setGallery(true)}
              >
                <Images />
                {r.images.length ? `${r.images.length} ảnh` : 'Ảnh minh họa'}
              </Button>
            </div>
            <div className="mb-8 flex flex-wrap gap-3">
              <StatusBadge tone={badge!.tone}>{badge!.label}</StatusBadge>
            </div>
            <div className="grid items-start gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0 xl:gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 space-y-8">
                <dl className="grid grid-cols-2 gap-5 rounded-2xl border border-border/70 bg-surface p-6 sm:grid-cols-4 sm:p-8">
                  {[
                    [Ruler, 'Diện tích', r.sizeM2 === null ? 'Chưa cập nhật' : `${r.sizeM2} m²`],
                    [Users, 'Số slot', String(r.capacity)],
                    [Building2, 'Tầng', r.floor === null ? 'Chưa cập nhật' : String(r.floor)],
                    [KeyRound, 'Loại phòng', r.roomTypeName],
                  ].map(([Icon, label, value]) => {
                    const I = Icon as typeof Ruler
                    return (
                      <div key={String(label)}>
                        <dt className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                          <I size={18} className="shrink-0 text-primary" />
                          {String(label)}
                        </dt>
                        <dd className="break-words text-base font-bold">{String(value)}</dd>
                      </div>
                    )
                  })}
                </dl>
                <section className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-8">
                  <h2 className="mb-3 text-xl font-bold">Một chút về không gian</h2>
                  <p className="max-w-prose whitespace-pre-line text-base leading-8 text-muted-foreground">
                    {r.description || 'Chi nhánh chưa cập nhật mô tả phòng.'}
                  </p>
                </section>
                <section className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-8">
                  <h2 className="mb-4 text-xl font-bold">Tiện nghi</h2>
                  {r.amenities.length ? (
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {r.amenities.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-3 rounded-xl bg-background p-4 text-sm"
                        >
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
                <section className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-8">
                  <h2 className="mb-4 text-xl font-bold">Dịch vụ tham khảo</h2>
                  {roomServices.isPending ? (
                    <p className="text-sm text-muted-foreground">Đang tải danh sách dịch vụ…</p>
                  ) : roomServices.error ? (
                    <InlineError error={roomServices.error} />
                  ) : roomServices.data?.length ? (
                    <>
                      <p className="mb-2 text-sm text-muted-foreground">
                        Dịch vụ bắt buộc luôn được áp dụng. Tích chọn dịch vụ tùy chọn để cộng vào
                        dự tính chi phí bên dưới; lựa chọn chỉ để tham khảo.
                      </p>
                      <RoomServicePicker
                        services={roomServices.data}
                        selection={serviceSelection}
                        slotCount={selectedSlots.length}
                        onChange={setServiceSelection}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Liên hệ chi nhánh để được cung cấp giá dịch vụ.
                    </p>
                  )}
                </section>
                <RoomCostEstimator
                  key={r.id}
                  room={r}
                  slotCount={selectedSlots.length}
                  extras={selectedServiceCosts(
                    roomServices.data ?? [],
                    serviceSelection,
                    selectedSlots.length,
                  )}
                />
                {branches.data?.some((branch) => branch.id === r.branchId) && (
                  <Button asChild variant="outline" className="mt-4">
                    <Link to={`/rooms/${r.id}/utility-rates`}>
                      Cấu hình đơn giá điện, nước và gửi xe
                    </Link>
                  </Button>
                )}
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
                <Panel className="rounded-2xl border-t-4 border-primary shadow-lg shadow-primary/5 ring-border/70 sm:p-8">
                  <p className="text-xs font-bold tracking-wider text-muted-foreground">
                    GIÁ THAM KHẢO
                  </p>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-1 text-[2rem] leading-tight font-bold tracking-tight text-primary">
                    {formatVnd(r.price)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {getPriceUnit(r)}
                    </span>
                  </p>
                  {earliestAvailableFrom && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                      <CalendarDays size={14} className="shrink-0" />
                      Có thể nhận phòng từ {dateOnly(earliestAvailableFrom)}
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Giá thuê chính thức được thỏa thuận khi lập hợp đồng. Khoản giữ chỗ được thông
                    báo riêng.
                  </p>
                  {available.data && (
                    <fieldset className="mt-5">
                      <legend className="mb-3 text-sm font-bold">
                        Chọn các slot muốn thuê / xem phòng
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {available.data.slots.map((s) => (
                          <label
                            key={s.id}
                            className={`flex min-h-12 items-start gap-2 rounded-lg border p-3 text-sm ${selectedSlots.includes(s.id) ? 'border-primary bg-primary-soft' : 'border-border'} ${!s.available ? 'text-muted-foreground' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-primary"
                              value={s.id}
                              checked={selectedSlots.includes(s.id)}
                              disabled={
                                !s.available &&
                                !viewing.data?.slots.some(
                                  (slot) => slot.id === s.id && slot.selectable,
                                )
                              }
                              onChange={(event) =>
                                setSelectedSlots((current) =>
                                  event.target.checked
                                    ? [...current, s.id]
                                    : current.filter((id) => id !== s.id),
                                )
                              }
                            />
                            <span className="grid gap-0.5 leading-snug">
                              <span className="font-medium">{s.label}</span>
                              {!s.available ? (
                                s.availableFrom ? (
                                  <span className="text-xs text-warning">
                                    Đang thuê · nhận phòng từ {dateOnly(s.availableFrom)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Đã kín</span>
                                )
                              ) : s.availableFrom ? (
                                <span className="text-xs text-muted-foreground">
                                  Từ {dateOnly(s.availableFrom)}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <div className="my-4 text-xs text-muted-foreground" role="status">
                    {!bookingAvailabilityEnabled
                      ? 'Tính năng kiểm tra lịch trống chưa được bật trong cấu hình API này.'
                      : available.isFetching
                        ? 'Đang kiểm tra lịch trống…'
                        : available.error
                          ? available.error.message
                          : available.data?.available
                            ? 'Chọn slot còn trống để giữ trong 24 giờ.'
                            : available.data?.reason ||
                              'Không có lịch trống phù hợp với khoảng ngày đã chọn.'}
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
                    {r.operationalStatus === 'ACTIVE' && canView ? (
                      <Button asChild variant="outline">
                        <Link to={viewingUrl}>
                          <CalendarDays />
                          Đặt lịch xem phòng
                        </Link>
                      </Button>
                    ) : (
                      <Button disabled variant="outline">
                        <CalendarDays />
                        Đặt lịch xem phòng
                      </Button>
                    )}
                  </div>
                  {!selectedSlots.length && viewing.data?.canReceiveRequest && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Chọn ít nhất một slot để đặt lịch xem phòng, kể cả phòng chỉ có một slot.
                    </p>
                  )}
                  {viewing.data?.reason === 'VIEWING_DISABLED' && (
                    <p role="status" className="mt-3 text-sm text-warning">
                      Owner/Manager đang tắt tính năng đặt lịch xem phòng.
                    </p>
                  )}
                  {selectedSlots.length > 0 && viewing.data?.canReceiveRequest && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Slot đang thuê vẫn chọn được để xem trong tương lai. Ngày và ca xem sẽ được
                      kiểm tra ở bước tiếp theo.
                    </p>
                  )}
                  {!bookable && available.data?.available && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Để giữ chỗ, chỉ chọn các slot được phép giữ chỗ. Điều kiện ngày xem phòng được
                      kiểm tra riêng ở bước tiếp theo.
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
              {r.operationalStatus === 'ACTIVE' && canView ? (
                <Button asChild variant="outline" className="px-3">
                  <Link to={viewingUrl} aria-label="Đặt lịch xem phòng">
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
