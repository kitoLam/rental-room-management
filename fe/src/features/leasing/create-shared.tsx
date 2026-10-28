import { Field, InlineError, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import type { Room } from '@/interfaces/domain'
import { addDays, bookingRequestSchema, dateRangeSchema } from '@/lib/validation'
import { provider } from '@/services/config'
import { bookingService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

export function BookingForm({ room }: { room: Room }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [startDate, setStart] = useState(params.get('startDate') || addDays(1))
  const [endDate, setEnd] = useState(params.get('endDate') || addDays(31))
  const [slot, setSlot] = useState(params.get('slot') || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const range = dateRangeSchema.safeParse({ startDate, endDate })
  const available = useQuery({
    queryKey: ['availability', room.id, startDate, endDate],
    queryFn: () => bookingService.availabilityForRoom(room.id, startDate, endDate),
    enabled: range.success,
  })
  const selectedSlotAvailable = available.data?.slots.find((item) => item.id === slot)?.available === true
  const create = useMutation({
    mutationFn: bookingService.create,
    onSuccess: async (record) => {
      await invalidateActivity()
      navigate(`/user/bookings/${record.id}`, { replace: true })
    },
    onError: () => void invalidateActivity(),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    const input = bookingRequestSchema.safeParse({ roomSlotId: slot, startDate, endDate })
    if (!input.success) {
      setErrors(Object.fromEntries(input.error.issues.map((i) => [i.path[0] === 'roomSlotId' ? 'slot' : String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    if (selectedSlotAvailable && !available.isFetching)
      create.mutate({ ...input.data, roomId: room.id, rentalMode: 'SLOT' })
  }
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel>
        <h2 className="font-bold">Thông tin yêu cầu</h2>
        <p className="mt-2 text-sm text-muted-foreground">{room.title} · {room.branchName}</p>
        <form className="mt-6 grid gap-6" onSubmit={submit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="booking-start" label="Ngày bắt đầu" error={errors.startDate}>
              <input id="booking-start" type="date" className="input" min={addDays(0)} value={startDate}
                onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field id="booking-end" label="Ngày kết thúc" error={errors.endDate}>
              <input id="booking-end" type="date" className="input" min={startDate} value={endDate}
                onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <>
            <Field id="booking-slot" label="Chỗ/giường" error={errors.slot}>
              <select id="booking-slot" className="input" value={slot} onChange={(event) => setSlot(event.target.value)}>
                <option value="">Chọn slot</option>
                {available.data?.slots.map((item) => <option key={item.id} value={item.id}>{item.label}{!item.available ? ' · Đã kín' : ''}</option>)}
              </select>
            </Field>
          </>
          <p className="text-xs text-muted-foreground">
            Ngày kết thúc không tính vào khoảng thuê. Hệ thống kiểm tra slot trên toàn khoảng ngày đã chọn.
          </p>
          {!range.success && <InlineError error={new Error(range.error.issues[0].message)} />}
          <div role="status">
            {available.isFetching ? <Notice>Đang kiểm tra slot theo khoảng ngày đã chọn…</Notice>
              : available.error ? <InlineError error={available.error} />
                : available.data && <Notice tone={selectedSlotAvailable ? 'success' : 'warning'}>
                    {slot
                      ? selectedSlotAvailable ? 'Slot còn trống trong khoảng đã chọn.' : 'Slot đã có lượt ở hoặc không trống trong khoảng này.'
                      : available.data.reason || 'Chọn một slot để kiểm tra khả dụng.'}
                  </Notice>}
          </div>
          <Notice>Owner/Manager sẽ duyệt yêu cầu và xác nhận khoản cọc, thời hạn giữ chỗ cùng điều kiện hủy trước khi bạn thanh toán.</Notice>
          <InlineError error={create.error} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={create.isPending} disabled={!selectedSlotAvailable || available.isFetching || !range.success || !slot}>
              <KeyRound /> Gửi yêu cầu đặt phòng
            </Button>
            <Button asChild variant="outline"><Link to={`/rooms/${room.id}`}>Quay lại</Link></Button>
          </div>
        </form>
      </Panel>
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Panel>
          <h2 className="font-bold">Thông tin phòng</h2>
          <p className="mt-4 text-sm text-muted-foreground">Giá thuê tham khảo</p>
          <p className="mt-1 font-bold">{room.price.toLocaleString('vi-VN')} ₫ / tháng</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Khoản cọc, hạn thanh toán và chính sách hủy sẽ được gửi sau khi yêu cầu được duyệt.
          </p>
        </Panel>
        {provider('leasing') === 'mock' && <p className="text-xs text-muted-foreground">Đây là yêu cầu demo, không phát sinh giao dịch tiền thật.</p>}
      </aside>
    </div>
  )
}
