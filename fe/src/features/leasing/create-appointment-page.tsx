import { Field, InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { addDays, appointmentInputSchema, uuid } from '@/lib/validation'
import { appointmentService, catalogService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

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
