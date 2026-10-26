import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { appointmentService, bookingService, catalogService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { provider } from '@/services/config'
import {
  addDays,
  appointmentInputSchema,
  bookingInputSchema,
  dateRangeSchema,
  uuid,
} from '@/lib/validation'
import { formatVnd } from '@/lib/format'
import type { BranchPolicy, Room } from '@/interfaces/domain'

export function CreateAppointmentPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [validation, setValidation] = useState<Record<string, string>>({})
  const room = useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => catalogService.room(roomId),
    enabled: uuid(roomId),
  })
  const policy = useQuery({
    queryKey: ['policy', room.data?.branchId],
    queryFn: () => catalogService.policy(room.data!.branchId),
    enabled: !!room.data,
  })
  const create = useMutation({
    mutationFn: appointmentService.create,
    onSuccess: async (record) => {
      await invalidateActivity()
      navigate(`/user/appointments/${record.id}`, { replace: true })
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const day = String(form.get('day'))
    const startAt = `${day}T${form.get('startTime')}:00+07:00`
    const endAt = `${day}T${form.get('endTime')}:00+07:00`
    const input = appointmentInputSchema.safeParse({
      roomId,
      startAt,
      endAt,
      note: form.get('note') || '',
    })
    if (!input.success) {
      setValidation(
        Object.fromEntries(input.error.issues.map((i) => [String(i.path[0]), i.message])),
      )
      return
    }
    setValidation({})
    create.mutate(input.data)
  }
  if (!uuid(roomId))
    return (
      <Page title="Liên kết phòng không hợp lệ" back="/rooms">
        <Notice>Hãy chọn phòng từ danh sách.</Notice>
      </Page>
    )
  return (
    <Page
      title="Hẹn một buổi xem phòng."
      eyebrow="BƯỚC ĐẦU ĐỂ HIỂU KHÔNG GIAN"
      back={`/rooms/${roomId}`}
      narrow
      description="Chọn khoảng giờ thuận tiện. Chi nhánh sẽ kiểm tra và phản hồi lịch hẹn của bạn."
    >
      <QueryState
        pending={room.isPending || policy.isPending}
        error={room.error || policy.error}
        retry={() => {
          void room.refetch()
          void policy.refetch()
        }}
      >
        {room.data && policy.data && (
          <Panel>
            <div className="mb-6 border-b border-border pb-5">
              <p className="font-bold">{room.data.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {room.data.branchName} · {room.data.address}
              </p>
            </div>
            <Notice>
              Giờ tiếp khách: {policy.data.appointmentPolicy.openingHour}:00–
              {policy.data.appointmentPolicy.closingHour}:00 (giờ Việt Nam). Tối đa{' '}
              {policy.data.appointmentPolicy.maxDurationMinutes} phút/lượt. Có thể hủy trước ít nhất{' '}
              {policy.data.appointmentPolicy.cancellationHours} giờ. Khoảng giờ được kiểm tra khi
              gửi yêu cầu.
            </Notice>
            <form className="mt-6 grid gap-5" onSubmit={submit} noValidate>
              <Field id="appointment-day" label="Ngày xem phòng" error={validation.startAt}>
                <input
                  id="appointment-day"
                  name="day"
                  type="date"
                  className="input"
                  defaultValue={addDays(1)}
                  min={addDays(0)}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field id="appointment-start" label="Giờ bắt đầu (VN)" error={validation.startAt}>
                  <input
                    id="appointment-start"
                    name="startTime"
                    type="time"
                    className="input"
                    defaultValue="09:00"
                    required
                  />
                </Field>
                <Field id="appointment-end" label="Giờ kết thúc (VN)" error={validation.endAt}>
                  <input
                    id="appointment-end"
                    name="endTime"
                    type="time"
                    className="input"
                    defaultValue="09:30"
                    required
                  />
                </Field>
              </div>
              <Field
                id="appointment-note"
                label="Lời nhắn (không bắt buộc)"
                error={validation.note}
              >
                <textarea
                  id="appointment-note"
                  name="note"
                  className="input min-h-28 resize-y"
                  maxLength={1000}
                  placeholder="Bạn muốn tìm hiểu thêm điều gì khi đến xem?"
                />
              </Field>
              <InlineError error={create.error} />
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  loading={create.isPending}
                  disabled={room.data.operationalStatus !== 'ACTIVE'}
                >
                  <CalendarDays />
                  Gửi lịch hẹn
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/rooms/${roomId}`}>Quay lại phòng</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Lịch hẹn mới sẽ ở trạng thái chờ xác nhận. Đặt lịch xem không giữ phòng.
              </p>
            </form>
          </Panel>
        )}
      </QueryState>
    </Page>
  )
}
function BookingForm({ room, policy }: { room: Room; policy: BranchPolicy }) {
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
export function CreateBookingPage() {
  const { roomId = '' } = useParams()
  const room = useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => catalogService.room(roomId),
    enabled: uuid(roomId),
  })
  const policy = useQuery({
    queryKey: ['policy', room.data?.branchId],
    queryFn: () => catalogService.policy(room.data!.branchId),
    enabled: !!room.data,
  })
  if (!uuid(roomId))
    return (
      <Page title="Liên kết phòng không hợp lệ" back="/rooms">
        <Notice>Chọn lại phòng trước khi giữ chỗ.</Notice>
      </Page>
    )
  return (
    <Page
      title="Giữ chỗ cho kế hoạch mới."
      eyebrow="YÊU CẦU GIỮ CHỖ"
      back={`/rooms/${roomId}`}
      description="Kiểm tra ngày thuê và chính sách chi nhánh. Bạn không cần có lịch xem phòng trước đó."
    >
      <QueryState
        pending={room.isPending || policy.isPending}
        error={room.error || policy.error}
        retry={() => {
          void room.refetch()
          void policy.refetch()
        }}
      >
        {room.data && policy.data && (
          <BookingForm
            key={policy.data.id + policy.data.version}
            room={room.data}
            policy={policy.data}
          />
        )}
      </QueryState>
    </Page>
  )
}
