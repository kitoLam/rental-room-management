import { Field, InlineError, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import type { Room } from '@/interfaces/domain'
import type { ServiceSelection } from '@/features/rooms/lib/cost-estimate'
import { provider } from '@/services/config'
import { bookingService, catalogService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { dateOnly } from '@/lib/activity'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

const readJson = <T,>(raw: string | null, fallback: T): T => {
  try { return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}

export function BookingForm({ room }: { room: Room }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [selectedSlots, setSelectedSlots] = useState<string[]>(() => readJson(params.get('slots'), []))
  const serviceSelection = readJson<ServiceSelection>(params.get('services'), {})
  const today = new Date().toISOString().slice(0, 10)
  const roomDetailUrl = `/rooms/${room.id}?${new URLSearchParams({ slots: JSON.stringify(selectedSlots), services: JSON.stringify(serviceSelection) })}`
  const available = useQuery({
    queryKey: ['availability', room.id, today],
    queryFn: () => bookingService.availabilityForRoom(room.id, today, '9999-12-31'),
  })
  const services = useQuery({
    queryKey: ['room-services', room.id],
    queryFn: () => catalogService.services(room),
  })
  const selectedSlotsAvailable = selectedSlots.length > 0 && selectedSlots.every((id) =>
    available.data?.slots.some((slot) => slot.id === id && slot.available),
  )
  // Ngày nhận phòng dự kiến = slot chọn sẵn sàng muộn nhất (khớp cách máy chủ chốt ngày bắt đầu thuê).
  const expectedMoveInDate = (available.data?.slots ?? [])
    .filter((slot) => selectedSlots.includes(slot.id) && slot.available && slot.availableFrom)
    .map((slot) => slot.availableFrom as string)
    .sort()
    .at(-1) ?? null
  const create = useMutation({
    mutationFn: () => bookingService.create({
      roomId: room.id,
      roomSlotIds: selectedSlots,
      selectedServices: Object.entries(serviceSelection)
        .filter(([, quantity]) => quantity > 0)
        .map(([serviceId, quantity]) => ({ serviceId, quantity })),
    }),
    onSuccess: async (record) => {
      await invalidateActivity()
      navigate(`/tenant/bookings/${record.id}`, { replace: true })
    },
    onError: () => void invalidateActivity(),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (selectedSlotsAvailable && !available.isFetching) create.mutate()
  }
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel>
        <h2 className="font-bold">Chọn slot và dịch vụ</h2>
        <p className="mt-2 text-sm text-muted-foreground">{room.title} · {room.branchName}</p>
        <form className="mt-6 grid gap-6" onSubmit={submit} noValidate>
          <Field id="booking-slots" label="Slot muốn thuê">
            <div className="grid gap-2 sm:grid-cols-2">
              {available.data?.slots.map((slot) => (
                <label key={slot.id} className={`flex min-h-12 items-start gap-3 rounded-lg border p-3 text-sm ${selectedSlots.includes(slot.id) ? 'border-primary bg-primary-soft' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedSlots.includes(slot.id)}
                    disabled={!slot.available}
                    onChange={(event) => setSelectedSlots((current) => event.target.checked
                      ? [...current, slot.id]
                      : current.filter((id) => id !== slot.id))}
                  />
                  <span className="grid gap-0.5 leading-snug">
                    <span className="font-medium">{slot.label}</span>
                    {!slot.available ? (
                      slot.availableFrom
                        ? <span className="text-xs text-warning">Đang thuê · nhận phòng từ {dateOnly(slot.availableFrom)}</span>
                        : <span className="text-xs text-muted-foreground">Đã giữ hoặc đang ở</span>
                    ) : slot.availableFrom ? (
                      <span className="text-xs text-muted-foreground">Từ {dateOnly(slot.availableFrom)}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </Field>
          {!available.data && (available.isFetching ? <Notice>Đang tải inventory slot…</Notice> : <InlineError error={available.error} />)}
          {services.data && <section className="grid gap-3">
            <h3 className="font-semibold">Dịch vụ đã chọn</h3>
            {services.data.filter((service) => service.unit.trim().toLocaleLowerCase('vi-VN') !== 'lần'
              && (service.mandatory || (serviceSelection[service.id] ?? 0) > 0)).length ? (
              <ul className="divide-y divide-border">
                {services.data.filter((service) => service.unit.trim().toLocaleLowerCase('vi-VN') !== 'lần'
                  && (service.mandatory || (serviceSelection[service.id] ?? 0) > 0)).map((service) => {
                  const quantity = service.quantityRule === 'METERED' ? null
                    : service.quantityRule === 'PER_SLOT' ? selectedSlots.length
                      : service.quantityRule === 'USER_INPUT' ? serviceSelection[service.id] ?? 0 : 1
                  return <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span>{service.name}{service.mandatory ? ' · Bắt buộc' : ''}</span>
                    <span className="text-right text-muted-foreground">
                      {quantity == null ? 'Tính theo chỉ số thực tế' : `${quantity} ${service.unit}`}
                      {' · '}{service.price.toLocaleString('vi-VN')} ₫ / {service.unit}
                    </span>
                  </li>
                })}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Chưa chọn dịch vụ tùy chọn.</p>}
            <p className="text-xs text-muted-foreground">Các dịch vụ đã chọn chỉ hiển thị ở bước xác nhận. Muốn thay đổi, hãy quay lại trang chi tiết phòng.</p>
          </section>}
          {services.error && <InlineError error={services.error} />}
          <Notice>Giữ chỗ có hiệu lực 24 giờ sau khi xác nhận. Hệ thống tính tiền cọc theo số slot; thanh toán xong sẽ tạo hợp đồng tạm để bạn nộp bằng chứng chữ ký.</Notice>
          <InlineError error={create.error} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={create.isPending} disabled={!selectedSlotsAvailable || available.isFetching}>
              <KeyRound /> Giữ các slot đã chọn
            </Button>
            <Button asChild variant="outline"><Link to={roomDetailUrl}>Quay lại</Link></Button>
          </div>
        </form>
      </Panel>
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Panel>
          <h2 className="font-bold">Thông tin phòng</h2>
          <p className="mt-4 text-sm text-muted-foreground">Giá thuê tham khảo mỗi slot</p>
          <p className="mt-1 font-bold">{room.price.toLocaleString('vi-VN')} ₫ / tháng</p>
          {expectedMoveInDate && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Ngày nhận phòng dự kiến</p>
              <p className="mt-1 font-bold text-primary">{dateOnly(expectedMoveInDate)}</p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">Tiền cọc được tính ở máy chủ từ mức cọc của phòng nhân số slot đã chọn.</p>
        </Panel>
        {provider('leasing') === 'mock' && <p className="text-xs text-muted-foreground">Đây là yêu cầu demo, không phát sinh giao dịch tiền thật.</p>}
      </aside>
    </div>
  )
}
