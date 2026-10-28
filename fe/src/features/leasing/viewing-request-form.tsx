import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Field, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/http'
import {
  viewingDependenciesService,
  viewingAppointmentInputSchema,
  type ViewingAppointmentInput,
  type ViewingAvailability,
  type ViewingContext,
} from '@/services/viewing-dependencies'

type Attempt = { key: string; request: ViewingAppointmentInput }

function loadAttempt(key: string, roomId: string): Attempt | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null') as {
      key?: unknown
      request?: unknown
    } | null
    const parsed = viewingAppointmentInputSchema.safeParse(stored?.request)
    return parsed.success &&
      parsed.data.roomId === roomId &&
      typeof stored?.key === 'string' &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(stored.key)
      ? { key: stored.key, request: parsed.data }
      : null
  } catch {
    return null
  }
}

const errors: Record<string, string> = {
  SHIFT_VERSION_CONFLICT: 'Giờ ca vừa thay đổi. Hãy kiểm tra lại và chọn lại ca.',
  ROOM_SHIFT_TAKEN: 'Ca vừa được người khác đặt. Hãy chọn một ca còn trống.',
  TENANT_ROOM_DAY: 'Bạn đã có lịch của phòng này trong ngày đã chọn.',
  TENANT_SCHEDULE_CONFLICT: 'Bạn đã có lịch cùng loại ca hoặc trùng giờ tại phòng khác.',
  ROOM_UNAVAILABLE: 'Phòng không còn nhận lịch xem. Hãy kiểm tra lại hoặc chọn phòng khác.',
  APPOINTMENT_BUSY:
    'Yêu cầu đang được xử lý. Thử lại để kiểm tra kết quả, thông tin gửi sẽ được giữ nguyên.',
}

export function ViewingRequestForm({
  account,
  roomId,
  date,
  period,
  version,
}: {
  account: ViewingContext
  roomId: string
  date: string
  period: ViewingAvailability['periods'][number] | undefined
  version: number
}) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const storageKey = `viewing-create:${account.accountId}:${roomId}`
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(storageKey, roomId))
  const attemptRef = useRef(attempt)
  const [name, setName] = useState(attempt?.request.contactName ?? account.fullName ?? '')
  const [phone, setPhone] = useState(attempt?.request.contactPhone ?? account.phone ?? '')
  const [validation, setValidation] = useState('')
  function remember(next: Attempt | null) {
    attemptRef.current = next
    setAttempt(next)
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next))
      else sessionStorage.removeItem(storageKey)
    } catch {
      /* In-memory retry still retains the same key. */
    }
  }
  const create = useMutation({
    mutationFn: (value: Attempt) =>
      viewingDependenciesService.createAppointment(value.request, value.key),
    onSuccess: async (record) => {
      remember(null)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['viewing-appointments'] }),
        client.invalidateQueries({ queryKey: ['viewing-availability', roomId] }),
        client.invalidateQueries({ queryKey: ['viewing-configuration', roomId] }),
      ])
      navigate(`/user/appointments/${record.id}`, { replace: true })
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.errorCode !== 'APPOINTMENT_BUSY'
      ) {
        remember(null)
        void client.invalidateQueries({ queryKey: ['viewing-availability', roomId] })
      }
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (attemptRef.current || create.isPending || !period) return
    const input = viewingAppointmentInputSchema.safeParse({
      roomId,
      shiftId: period.id,
      appointmentDate: date,
      configurationVersion: version,
      contactName: name,
      contactPhone: phone,
    })
    if (!input.success) {
      setValidation(input.error.issues[0].message)
      return
    }
    setValidation('')
    const next = { key: crypto.randomUUID(), request: input.data }
    remember(next)
    create.mutate(next)
  }
  const message =
    create.error instanceof ApiError
      ? (errors[create.error.errorCode ?? ''] ?? create.error.message)
      : create.error?.message
  return (
    <Panel className="mt-6">
      <h2 className="font-bold">Thông tin liên hệ cho buổi xem</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Thông tin này được lưu cho yêu cầu hiện tại, không thay đổi hồ sơ tài khoản.
      </p>
      {attempt && (
        <div className="mt-4">
          <Notice tone="warning">
            Lượt gửi ngày {attempt.request.appointmentDate.split('-').reverse().join('/')} chưa được
            xác nhận kết quả. Thử lại với cùng thông tin để kiểm tra, tránh tạo yêu cầu trùng.
          </Notice>
        </div>
      )}
      <form onSubmit={submit} className="mt-5 grid gap-5">
        <fieldset disabled={create.isPending || !!attempt} className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Họ tên và số điện thoại</legend>
          <Field id="viewing-contact-name" label="Họ và tên">
            <input
              id="viewing-contact-name"
              className="input"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field id="viewing-contact-phone" label="Số điện thoại liên hệ">
            <input
              id="viewing-contact-phone"
              type="tel"
              className="input"
              autoComplete="tel"
              maxLength={32}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </Field>
        </fieldset>
        {(validation || message) && (
          <p role="alert" className="text-sm text-danger">
            {validation || message}
          </p>
        )}
        <div>
          {attempt ? (
            <Button
              type="button"
              loading={create.isPending}
              onClick={() => {
                if (attemptRef.current && !create.isPending) create.mutate(attemptRef.current)
              }}
            >
              Thử lại lượt gửi trước
            </Button>
          ) : (
            <Button type="submit" disabled={!period} loading={create.isPending}>
              Gửi yêu cầu xem phòng
            </Button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Yêu cầu thành công sẽ giữ ca và chờ phía quản lý duyệt. Đặt lịch xem không giữ chỗ thuê
          phòng.
        </p>
      </form>
    </Panel>
  )
}
