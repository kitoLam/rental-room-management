import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Field, Notice, Page, Panel, QueryState, InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { shiftLabels } from '@/features/leasing/viewing-time'
import { ApiError } from '@/services/http'
import {
  applyViewingBranchHours,
  viewingDependenciesService,
  viewingBulkHoursSchema,
  viewingShiftTypes,
  type ViewingBulkHours,
  type ViewingBulkInput,
} from '@/services/viewing-dependencies'

type Selection = Map<string, { version: number; roomNumber: string }>

export function BranchViewingSettingsPage() {
  const { branchId = '' } = useParams()
  return <BranchEditor key={branchId.toLowerCase()} branchId={branchId.toLowerCase()} />
}

function BranchEditor({ branchId }: { branchId: string }) {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Selection>(() => new Map())
  const [submittedNames, setSubmittedNames] = useState<Map<string, string>>(() => new Map())
  const [hours, setHours] = useState<ViewingBulkHours>({
    type: 'MORNING',
    startTime: '08:00',
    endTime: '10:00',
  })
  const [formError, setFormError] = useState('')
  const [selectionMessage, setSelectionMessage] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [progress, setProgress] = useState(0)
  const valid = /^[0-9a-fA-F]{24}$/.test(branchId)
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    enabled: valid,
    retry: false,
  })
  const canManage = !!context.data?.manageableBranchIds.includes(branchId)
  const query = useQuery({
    queryKey: ['viewing-branch', branchId, page],
    queryFn: () => viewingDependenciesService.branchConfigurations(branchId, page),
    enabled: canManage,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const mutation = useMutation({
    mutationFn: (input: { hours: ViewingBulkHours; rooms: ViewingBulkInput['rooms'] }) =>
      applyViewingBranchHours(branchId, input.hours, input.rooms, setProgress),
    onSuccess: async () => {
      setSelected(new Map())
      setSelectionMessage('')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['viewing-branch', branchId] }),
        client.invalidateQueries({ queryKey: ['viewing-configuration'] }),
        client.invalidateQueries({ queryKey: ['viewing-availability'] }),
      ])
    },
  })
  const busy = selecting || mutation.isPending
  const rows = query.data?.content ?? []
  const selectable = rows.filter((room) => room.version !== null && !room.errorCode)
  const pageSelected =
    selectable.length > 0 && selectable.every((room) => selected.has(room.roomId))

  async function selectBranch() {
    setSelecting(true)
    setSelectionMessage('')
    try {
      const next: Selection = new Map()
      let skipped = 0
      for (let current = 1; ; current++) {
        const data = await viewingDependenciesService.branchConfigurations(branchId, current, 100)
        if (data.number !== current)
          throw new ApiError('Danh sách phòng trả về không đúng trang.', 502)
        for (const room of data.content) {
          if (room.version !== null && !room.errorCode)
            next.set(room.roomId, { version: room.version, roomNumber: room.roomNumber })
          else skipped++
        }
        if (!data.hasNext) break
      }
      setSelected(next)
      setSelectionMessage(
        skipped
          ? `Đã chọn ${next.size} phòng. ${skipped} phòng lỗi cấu hình chưa được chọn.`
          : `Đã chọn toàn bộ ${next.size} phòng của chi nhánh.`,
      )
    } catch (error) {
      setSelectionMessage(
        error instanceof Error ? error.message : 'Không tải được danh sách phòng.',
      )
    } finally {
      setSelecting(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = viewingBulkHoursSchema.safeParse(hours)
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message)
      return
    }
    if (selected.size === 0) {
      setFormError('Chọn ít nhất một phòng cần áp dụng.')
      return
    }
    setFormError('')
    setProgress(0)
    setSubmittedNames(new Map([...selected].map(([id, value]) => [id, value.roomNumber])))
    mutation.mutate({
      hours: parsed.data,
      rooms: [...selected].map(([roomId, value]) => ({ roomId, version: value.version })),
    })
  }

  return (
    <Page
      title="Cập nhật ca theo chi nhánh"
      eyebrow="QUẢN LÝ LỊCH XEM"
      description={
        rows[0]?.branchName ??
        'Chọn phòng và đổi giờ một ca. Mỗi phòng được kiểm tra và cập nhật độc lập.'
      }
    >
      {!valid ? (
        <Notice>Liên kết chi nhánh không hợp lệ.</Notice>
      ) : (
        <QueryState pending={context.isPending} error={context.error} retry={context.refetch}>
          {context.data &&
            (!canManage ? (
              <Notice tone="warning">Bạn không có quyền quản lý lịch xem của chi nhánh này.</Notice>
            ) : (
              <>
                <Notice>
                  Chỉ đổi giờ của ca đã chọn; trạng thái bật/tắt và hai ca còn lại của từng phòng
                  được giữ nguyên. Lịch đã đặt không đổi giờ.
                </Notice>
                <Panel className="mt-5">
                  <form onSubmit={submit} className="grid gap-5">
                    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
                      <legend className="sr-only">Giờ ca áp dụng cho các phòng được chọn</legend>
                      <Field id="branch-period-type" label="Ca cần thay đổi">
                        <select
                          id="branch-period-type"
                          className="input"
                          value={hours.type}
                          onChange={(event) =>
                            setHours({
                              ...hours,
                              type: event.target.value as ViewingBulkHours['type'],
                            })
                          }
                        >
                          {viewingShiftTypes.map((type) => (
                            <option key={type} value={type}>
                              {shiftLabels[type]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id="branch-period-start" label="Giờ bắt đầu mới (VN)">
                        <input
                          id="branch-period-start"
                          type="time"
                          step="60"
                          required
                          className="input"
                          value={hours.startTime}
                          onChange={(event) =>
                            setHours({ ...hours, startTime: event.target.value })
                          }
                        />
                      </Field>
                      <Field id="branch-period-end" label="Giờ kết thúc mới (VN)">
                        <input
                          id="branch-period-end"
                          type="time"
                          step="60"
                          required
                          className="input"
                          value={hours.endTime}
                          onChange={(event) => setHours({ ...hours, endTime: event.target.value })}
                        />
                      </Field>
                    </fieldset>
                    {formError && (
                      <p role="alert" className="text-sm text-danger">
                        {formError}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4">
                      <Button
                        type="submit"
                        disabled={selected.size === 0 || selecting}
                        loading={mutation.isPending}
                      >
                        Áp dụng cho {selected.size} phòng
                      </Button>
                      <p
                        className="text-sm text-muted-foreground"
                        role={mutation.isPending ? 'status' : undefined}
                      >
                        {mutation.isPending
                          ? `Đã nhận kết quả ${progress}/${mutation.variables?.rooms.length ?? 0} phòng…`
                          : 'Phòng có giờ chồng lấn hoặc cấu hình đã thay đổi sẽ được báo lỗi riêng.'}
                      </p>
                    </div>
                    <InlineError error={mutation.error} />
                  </form>
                </Panel>
                <section className="mt-8" aria-labelledby="branch-room-list-title">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <h2 id="branch-room-list-title" className="text-xl font-bold">
                      Phòng trong chi nhánh
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void selectBranch()}
                        disabled={busy || !query.data?.totalElements}
                      >
                        Chọn toàn bộ chi nhánh
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          setSelected(new Map())
                          setSelectionMessage('')
                          await query.refetch()
                        }}
                      >
                        Tải lại danh sách
                      </Button>
                    </div>
                  </div>
                  {selectionMessage && (
                    <p className="mb-4 text-sm" role="status">
                      {selectionMessage}
                    </p>
                  )}
                  <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
                    {query.data && (
                      <Panel>
                        {rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Chưa có phòng trong trang này.
                          </p>
                        ) : (
                          <>
                            <label className="mb-4 flex min-h-11 items-center gap-3 text-sm font-bold">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                aria-label="Chọn tất cả phòng trong trang"
                                disabled={busy || !selectable.length}
                                checked={pageSelected}
                                onChange={(event) =>
                                  setSelected((previous) => {
                                    const next = new Map(previous)
                                    for (const room of selectable) {
                                      if (event.target.checked)
                                        next.set(room.roomId, {
                                          version: room.version!,
                                          roomNumber: room.roomNumber,
                                        })
                                      else next.delete(room.roomId)
                                    }
                                    return next
                                  })
                                }
                              />
                              Chọn tất cả phòng trong trang · Đã chọn {selected.size}/
                              {query.data.totalElements}
                            </label>
                            <ul className="divide-y divide-border">
                              {rows.map((room) => (
                                <li
                                  key={room.roomId}
                                  className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-center"
                                >
                                  <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
                                    <input
                                      type="checkbox"
                                      aria-label={`Chọn ${room.roomNumber}`}
                                      className="size-4 accent-primary"
                                      checked={selected.has(room.roomId)}
                                      disabled={busy || room.version === null || !!room.errorCode}
                                      onChange={(event) =>
                                        setSelected((previous) => {
                                          const next = new Map(previous)
                                          if (event.target.checked && room.version !== null)
                                            next.set(room.roomId, {
                                              version: room.version,
                                              roomNumber: room.roomNumber,
                                            })
                                          else next.delete(room.roomId)
                                          return next
                                        })
                                      }
                                    />
                                    {room.roomNumber}
                                  </label>
                                  {room.errorCode ? (
                                    <p className="text-sm text-danger">{room.message}</p>
                                  ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                      {room.periods.map((period) => (
                                        <div key={period.id}>
                                          <p className="text-xs text-muted-foreground">
                                            {shiftLabels[period.type]}
                                            {!period.isActive && ' · Tắt'}
                                          </p>
                                          <p className="mt-1 text-sm tabular-nums">
                                            {period.startTime}–{period.endTime}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <Link
                                    className="inline-flex min-h-11 items-center text-sm font-bold text-primary"
                                    to={`/rooms/${room.roomId}/viewing-settings`}
                                  >
                                    Cấu hình riêng
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                          <p className="text-sm text-muted-foreground">
                            Trang {page}/{Math.max(query.data.totalPages, 1)} ·{' '}
                            {query.data.totalElements} phòng
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              disabled={busy || page <= 1 || query.isFetching}
                              onClick={() => setPage((value) => value - 1)}
                            >
                              Trang trước
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy || !query.data.hasNext || query.isFetching}
                              onClick={() => setPage((value) => value + 1)}
                            >
                              Trang sau
                            </Button>
                          </div>
                        </div>
                      </Panel>
                    )}
                  </QueryState>
                </section>
                {mutation.data && (
                  <Panel className="mt-8">
                    <h2 className="text-xl font-bold">Kết quả cập nhật</h2>
                    <p className="mt-3 text-sm" role="status">
                      Đã cập nhật: {mutation.data.updated} phòng · Không thay đổi:{' '}
                      {mutation.data.unchanged} phòng · Không cập nhật được: {mutation.data.failed}{' '}
                      phòng
                    </p>
                    {mutation.variables && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {shiftLabels[mutation.variables.hours.type]} ·{' '}
                        {mutation.variables.hours.startTime}–{mutation.variables.hours.endTime}
                      </p>
                    )}
                    <ul className="mt-5 divide-y divide-border">
                      {mutation.data.results.map((result) => (
                        <li key={result.roomId} className="py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-bold">
                              {result.roomNumber ??
                                submittedNames.get(result.roomId) ??
                                'Phòng đã chọn'}
                            </p>
                            <StatusBadge
                              tone={
                                result.status === 'UPDATED'
                                  ? 'success'
                                  : result.status === 'FAILED'
                                    ? 'danger'
                                    : 'neutral'
                              }
                            >
                              {result.status === 'UPDATED'
                                ? 'Đã cập nhật'
                                : result.status === 'FAILED'
                                  ? 'Không cập nhật được'
                                  : 'Không thay đổi'}
                            </StatusBadge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
                          {result.affectedAppointments.length > 0 && (
                            <details className="mt-3 text-sm">
                              <summary className="cursor-pointer font-bold">
                                {result.affectedAppointments.length} lịch bị ảnh hưởng giữ nguyên
                                giờ
                              </summary>
                              <ul className="mt-2 space-y-2 text-muted-foreground">
                                {result.affectedAppointments.map((appointment) => (
                                  <li key={appointment.id}>
                                    {appointment.date.split('-').reverse().join('/')} ·{' '}
                                    {appointment.startAt && appointment.endAt
                                      ? `${new Date(appointment.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}–${new Date(appointment.endAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`
                                      : 'Cần kiểm tra giờ đã hẹn'}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Tải lại danh sách trước khi chọn các phòng cần thử lại để dùng cấu hình mới
                      nhất.
                    </p>
                  </Panel>
                )}
              </>
            ))}
        </QueryState>
      )}
    </Page>
  )
}
