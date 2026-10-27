import { Field, InlineError, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import type { BranchPolicy, Room } from '@/interfaces/domain'
import { formatVnd } from '@/lib/format'
import { addDays, bookingInputSchema, dateRangeSchema } from '@/lib/validation'
import { provider } from '@/services/config'
import { bookingService, catalogService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

export function BookingForm({ room, policy }: { room: Room; policy: BranchPolicy }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [startDate, setStart] = useState(params.get('startDate') || addDays(1))
  const [endDate, setEnd] = useState(params.get('endDate') || addDays(31))
  const [slot, setSlot] = useState(params.get('slot') || '')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const range = dateRangeSchema.safeParse({ startDate, endDate })
  const available = useQuery({
    queryKey: ['availability', room.id, startDate, endDate],
    queryFn: () => catalogService.availability(room.id, startDate, endDate),
    enabled: range.success,
  })
  const create = useMutation({
    mutationFn: bookingService.create,
    onSuccess: async (record) => {
      await invalidateActivity()
      navigate(`/user/bookings/${record.id}`, { replace: true })
    },
    onError: () => {
      void invalidateActivity()
    },
  })
  const validSlot =
    room.rentalMode === 'ROOM' || available.data?.slots.some((s) => s.id === slot && s.available)
  function submit(event: FormEvent) {
    event.preventDefault()
    const input = bookingInputSchema.safeParse({
      roomId: room.id,
      rentalMode: room.rentalMode,
      roomSlotId: room.rentalMode === 'SLOT' && slot ? slot : undefined,
      startDate,
      endDate,
      policyId: policy.id,
      policyVersion: policy.version,
      acknowledged: agreed,
    })
    if (!input.success) {
      setErrors(Object.fromEntries(input.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    if (available.data?.available && validSlot && !available.isFetching) create.mutate(input.data)
  }
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel>
        <h2 className="font-bold">Thông tin giữ chỗ</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {room.title} · {room.branchName}
        </p>
        <form className="mt-6 grid gap-6" onSubmit={submit} noValidate>
          <div className="rounded-lg bg-background p-4 text-sm">
            <span className="text-muted-foreground">Hình thức thuê: </span>
            <strong>{room.rentalMode === 'ROOM' ? 'Nguyên phòng' : 'Theo chỗ / ở ghép'}</strong>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="booking-start" label="Ngày bắt đầu" error={errors.startDate}>
              <input
                id="booking-start"
                type="date"
                className="input"
                min={addDays(0)}
                value={startDate}
                onChange={(e) => {
                  setStart(e.target.value)
                  setSlot('')
                }}
              />
            </Field>
            <Field id="booking-end" label="Ngày kết thúc" error={errors.endDate}>
              <input
                id="booking-end"
                type="date"
                className="input"
                min={startDate}
                value={endDate}
                onChange={(e) => {
                  setEnd(e.target.value)
                  setSlot('')
                }}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Có thể bắt đầu vào bất kỳ ngày nào trong tháng. Ngày kết thúc không tính vào thời gian
            thuê.
          </p>
          {!range.success && <InlineError error={new Error(range.error.issues[0].message)} />}
          {room.rentalMode === 'SLOT' && (
            <Field id="booking-slot" label="Chỗ ở" error={errors.roomSlotId}>
              <select
                id="booking-slot"
                className="input"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                disabled={available.isFetching}
              >
                <option value="">Chọn một chỗ còn trống</option>
                {available.data?.slots.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.available}>
                    {s.label}
                    {s.available ? ' · Còn trống' : ' · Không khả dụng'}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div role="status">
            {available.isFetching ? (
              <Notice>Đang kiểm tra phòng/slot theo khoảng ngày đã chọn…</Notice>
            ) : available.error ? (
              <InlineError error={available.error} />
            ) : (
              available.data && (
                <Notice tone={available.data.available ? 'success' : 'warning'}>
                  {available.data.available
                    ? 'Phòng có lịch trống trong khoảng thời gian đã chọn. Hệ thống sẽ kiểm tra lại khi gửi yêu cầu.'
                    : available.data.reason}
                </Notice>
              )
            )}
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm leading-6">
            <input
              className="mt-1 size-5 shrink-0 accent-primary"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-describedby={errors.acknowledged ? 'booking-ack-error' : undefined}
            />
            Tôi đã đọc khoản giữ chỗ, thời hạn thanh toán và điều kiện hủy của chi nhánh.
          </label>
          {errors.acknowledged && (
            <p id="booking-ack-error" role="alert" className="text-xs text-danger">
              {errors.acknowledged}
            </p>
          )}
          <InlineError error={create.error} />
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              loading={create.isPending}
              disabled={
                !available.data?.available || !validSlot || available.isFetching || !range.success
              }
            >
              <KeyRound />
              Gửi yêu cầu giữ chỗ
            </Button>
            <Button asChild variant="outline">
              <Link to={`/rooms/${room.id}`}>Quay lại</Link>
            </Button>
          </div>
        </form>
      </Panel>
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Panel>
          <p className="text-xs text-muted-foreground">CHÍNH SÁCH CHI NHÁNH · V{policy.version}</p>
          <h2 className="mt-3 font-bold">Khoản giữ chỗ</h2>
          <p className="mt-3 text-page-title font-bold text-primary">
            {formatVnd(policy.bookingHoldAmount)}
          </p>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Giá thuê tham khảo</dt>
              <dd className="mt-1 font-bold">
                {formatVnd(room.price)} / {room.rentalMode === 'SLOT' ? 'chỗ/' : ''}tháng
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Thời hạn thanh toán</dt>
              <dd className="mt-1">{policy.paymentWindowMinutes} phút từ khi tạo yêu cầu</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Giữ tạm tài nguyên</dt>
              <dd className="mt-1">Tối đa {policy.temporaryHoldMinutes} phút</dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
            {policy.cancellationTerms}
          </p>
        </Panel>
        <Notice>
          Khoản giữ chỗ khác tiền thuê trả trước và tiền đặt cọc bảo đảm. Yêu cầu chỉ được xác nhận
          sau khi thanh toán được xác minh trong hạn.
        </Notice>
        {provider('leasing') === 'mock' && (
          <p className="text-xs text-muted-foreground">
            Đây là yêu cầu demo, không phát sinh giao dịch tiền thật.
          </p>
        )}
      </aside>
    </div>
  )
}
