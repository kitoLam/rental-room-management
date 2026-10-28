import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/http'
import {
  viewingDependenciesService,
  viewingAppointmentStatuses,
  type ViewingAppointment,
} from '@/services/viewing-dependencies'
import {
  shiftLabels,
  viewingDateTime,
  viewingStatusLabels,
  viewingCancellationLabels,
} from './viewing-time'
import { ViewingAppointmentActions } from './viewing-appointment-actions'
import { hasViewingManagementRole, viewingAppointmentsPath } from './viewing-navigation'

export function ViewingAppointmentBadge({ status }: { status: ViewingAppointment['status'] }) {
  return (
    <StatusBadge
      tone={
        status === 'CONFIRMED' || status === 'COMPLETED'
          ? 'success'
          : status === 'PENDING'
            ? 'warning'
            : status === 'REJECTED' || status === 'NO_SHOW'
              ? 'danger'
              : 'neutral'
      }
    >
      {viewingStatusLabels[status]}
    </StatusBadge>
  )
}

function LoginNotice({ redirect }: { redirect: string }) {
  return (
    <Notice>
      <Link className="font-bold underline" to={`/login?redirect=${encodeURIComponent(redirect)}`}>
        Đăng nhập để theo dõi lịch xem phòng của bạn
      </Link>
    </Notice>
  )
}

export function AppointmentsPage({ management = false }: { management?: boolean }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const fromDate = params.get('fromDate') ?? ''
  const toDate = params.get('toDate') ?? ''
  const branchId = management ? (params.get('branchId') ?? '') : ''
  const roomId = management ? (params.get('roomId') ?? '') : ''
  const needsResult = management && params.get('needsResult') === 'true'
  const basePath = management ? '/manager/appointments' : '/user/appointments'
  const [roomPage, setRoomPage] = useState(1)
  const rawPage = Number(params.get('page') ?? 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const valid =
    (!status || viewingAppointmentStatuses.includes(status as ViewingAppointment['status'])) &&
    (!fromDate || !toDate || fromDate <= toDate) &&
    (!roomId || /^[0-9a-fA-F]{24}$/.test(roomId)) &&
    (!branchId || /^[0-9a-fA-F]{24}$/.test(branchId))
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const redirectToManagement = !management && hasViewingManagementRole(context.data?.roles ?? [])
  const query = useQuery({
    queryKey: [
      'viewing-appointments',
      context.data?.accountId,
      status,
      fromDate,
      toDate,
      page,
      branchId,
      roomId,
      needsResult,
    ],
    queryFn: () =>
      viewingDependenciesService.appointments({
        status,
        fromDate,
        toDate,
        page,
        branchId,
        roomId,
        needsResult,
      }),
    enabled:
      !!context.data &&
      !context.isFetching &&
      !redirectToManagement &&
      valid &&
      (!management || context.data.manageableBranchIds.length > 0),
    refetchInterval: 15000,
  })
  const rooms = useQuery({
    queryKey: ['viewing-filter-rooms', context.data?.accountId, branchId, roomPage],
    queryFn: () => viewingDependenciesService.branchConfigurations(branchId, roomPage, 100),
    enabled: management && !!branchId && !!context.data?.manageableBranchIds.includes(branchId),
  })
  function change(field: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(field, value)
    else next.delete(field)
    setParams(next)
  }
  const guest = context.error instanceof ApiError && context.error.status === 401
  if (redirectToManagement && context.data) {
    const requestedBranch = params.get('branchId')
    const targetBranch = requestedBranch && context.data.manageableBranchIds.includes(requestedBranch)
      ? requestedBranch
      : context.data.manageableBranchIds[0]
    return (
      <Navigate
        replace
        to={viewingAppointmentsPath(context.data.roles, { branchId: targetBranch, search: params })}
      />
    )
  }
  return (
    <Page
      title={management ? 'Quản lý lịch xem phòng' : 'Lịch xem phòng'}
      eyebrow={management ? 'XỬ LÝ LỊCH XEM' : 'THEO DÕI YÊU CẦU'}
      description="Tra cứu phản hồi, thời hạn duyệt và lịch sử các yêu cầu trong phạm vi của bạn."
      actions={
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/notifications/viewing">Thông báo lịch xem</Link>
          </Button>
          <Button asChild>
            <Link to="/rooms">Tìm phòng</Link>
          </Button>
        </div>
      }
    >
      {guest ? (
        <LoginNotice redirect={basePath} />
      ) : (
        <QueryState
          pending={context.isPending || context.isFetching}
          error={context.error}
          retry={context.refetch}
        >
          {context.data && management && context.data.manageableBranchIds.length === 0 ? (
            <Notice tone="warning">
              Tài khoản hiện tại không có quyền quản lý lịch xem của chi nhánh nào.
            </Notice>
          ) : (
            context.data && (
              <>
                <Panel>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="viewing-status" label="Trạng thái">
                      <select
                        id="viewing-status"
                        className="input"
                        value={needsResult ? 'CONFIRMED' : status}
                        disabled={needsResult}
                        onChange={(event) => change('status', event.target.value)}
                      >
                        <option value="">Tất cả trạng thái</option>
                        {viewingAppointmentStatuses.map((value) => (
                          <option key={value} value={value}>
                            {viewingStatusLabels[value]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="viewing-from" label="Ngày hẹn từ">
                      <input
                        id="viewing-from"
                        type="date"
                        className="input"
                        value={fromDate}
                        onChange={(event) => change('fromDate', event.target.value)}
                      />
                    </Field>
                    <Field id="viewing-to" label="Ngày hẹn đến">
                      <input
                        id="viewing-to"
                        type="date"
                        className="input"
                        value={toDate}
                        onChange={(event) => change('toDate', event.target.value)}
                      />
                    </Field>
                  </div>
                  {management && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <Field id="viewing-branch" label="Chi nhánh">
                        <select
                          id="viewing-branch"
                          className="input"
                          value={branchId}
                          onChange={(e) => {
                            const next = new URLSearchParams(params)
                            next.delete('page')
                            next.delete('roomId')
                            setRoomPage(1)
                            if (e.target.value) next.set('branchId', e.target.value)
                            else next.delete('branchId')
                            setParams(next)
                          }}
                        >
                          <option value="">Tất cả chi nhánh có quyền</option>
                          {context.data.manageableBranchIds.map((id, index) => (
                            <option key={id} value={id}>
                              {query.data?.content.find((a) => a.branchId === id)?.branchName ??
                                (id === branchId ? rooms.data?.content[0]?.branchName : null) ??
                                `Chi nhánh được giao ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id="viewing-room" label="Phòng">
                        <select
                          id="viewing-room"
                          className="input"
                          value={roomId}
                          disabled={!branchId || rooms.isPending || !!rooms.error}
                          onChange={(e) => change('roomId', e.target.value)}
                        >
                          <option value="">
                            {branchId ? 'Tất cả phòng của chi nhánh' : 'Chọn chi nhánh trước'}
                          </option>
                          {roomId &&
                            !rooms.data?.content.some((room) => room.roomId === roomId) && (
                              <option value={roomId}>
                                {query.data?.content.find((a) => a.roomId === roomId)?.roomNumber ??
                                  'Phòng đã chọn'}
                              </option>
                            )}
                          {rooms.data?.content.map((room) => (
                            <option key={room.roomId} value={room.roomId}>
                              {room.roomNumber}
                            </option>
                          ))}
                        </select>
                        {rooms.error && (
                          <p className="mt-2 text-xs text-danger">
                            Không tải được danh sách phòng.{' '}
                            <button
                              type="button"
                              className="underline"
                              onClick={() => void rooms.refetch()}
                            >
                              Thử lại
                            </button>
                          </p>
                        )}
                        {(roomPage > 1 || rooms.data?.hasNext) && (
                          <div className="mt-2 flex gap-3 text-xs">
                            <button
                              type="button"
                              disabled={roomPage <= 1 || rooms.isFetching}
                              onClick={() => setRoomPage((p) => p - 1)}
                            >
                              Nhóm phòng trước
                            </button>
                            <button
                              type="button"
                              disabled={!rooms.data?.hasNext || rooms.isFetching}
                              onClick={() => setRoomPage((p) => p + 1)}
                            >
                              Nhóm phòng sau
                            </button>
                          </div>
                        )}
                      </Field>
                      <label className="flex min-h-11 items-center gap-3 self-end text-sm">
                        <input
                          type="checkbox"
                          checked={needsResult}
                          onChange={(e) => {
                            const next = new URLSearchParams(params)
                            next.delete('page')
                            next.delete('status')
                            if (e.target.checked) next.set('needsResult', 'true')
                            else next.delete('needsResult')
                            setParams(next)
                          }}
                        />
                        Cần cập nhật kết quả (đã hết ca)
                      </label>
                    </div>
                  )}
                </Panel>
                {!valid ? (
                  <div className="mt-5">
                    <Notice tone="warning">
                      Bộ lọc chưa hợp lệ; ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
                    </Notice>
                  </div>
                ) : (
                  <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
                    {query.data && (
                      <Panel className="mt-6">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">
                            {query.data.totalElements} yêu cầu · Giờ Việt Nam
                          </p>
                          <Button
                            variant="ghost"
                            onClick={() => void query.refetch()}
                            disabled={query.isFetching}
                          >
                            Kiểm tra lại
                          </Button>
                        </div>
                        {query.data.content.length === 0 ? (
                          <p className="py-8 text-sm text-muted-foreground">
                            Chưa có lịch xem phù hợp với bộ lọc.
                          </p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {query.data.content.map((record) => (
                              <li
                                key={record.id}
                                className="flex flex-wrap items-center justify-between gap-4 py-5"
                              >
                                <div className="min-w-0">
                                  <Link
                                    className="text-sm font-bold text-primary hover:underline"
                                    to={viewingAppointmentsPath(context.data.roles, {
                                      appointmentId: record.id,
                                      branchId: record.branchId,
                                    })}
                                  >
                                    {record.roomNumber ?? 'Phòng đã đặt lịch'}
                                  </Link>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {record.branchName}
                                  </p>
                                  <p className="mt-3 text-sm">
                                    {record.shiftType && `${shiftLabels[record.shiftType]} · `}
                                    {viewingDateTime(record.startAt)}
                                  </p>
                                  {management && (
                                    <p className="mt-2 text-sm">
                                      {record.contactName} · {record.contactPhone}
                                    </p>
                                  )}
                                  {record.status === 'PENDING' && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Hạn duyệt: {viewingDateTime(record.expiresAt)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <ViewingAppointmentBadge status={record.status} />
                                  <Button asChild variant="outline">
                                    <Link to={viewingAppointmentsPath(context.data.roles, {
                                      appointmentId: record.id,
                                      branchId: record.branchId,
                                    })}>Chi tiết</Link>
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                          <p className="text-sm text-muted-foreground">
                            Trang {page}/{Math.max(query.data.totalPages, 1)}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              disabled={page <= 1 || query.isFetching}
                              onClick={() => {
                                const next = new URLSearchParams(params)
                                next.set('page', String(page - 1))
                                setParams(next)
                              }}
                            >
                              Trang trước
                            </Button>
                            <Button
                              variant="outline"
                              disabled={!query.data.hasNext || query.isFetching}
                              onClick={() => {
                                const next = new URLSearchParams(params)
                                next.set('page', String(page + 1))
                                setParams(next)
                              }}
                            >
                              Trang sau
                            </Button>
                          </div>
                        </div>
                      </Panel>
                    )}
                  </QueryState>
                )}
              </>
            )
          )}
        </QueryState>
      )}
    </Page>
  )
}

export function AppointmentDetailPage({ management = false }: { management?: boolean }) {
  const { appointmentId = '' } = useParams()
  const valid = /^[0-9a-fA-F]{24}$/.test(appointmentId)
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    enabled: valid,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const query = useQuery({
    queryKey: ['viewing-appointment', context.data?.accountId, appointmentId],
    queryFn: () => viewingDependenciesService.appointment(appointmentId),
    enabled: valid && !!context.data && !context.isFetching,
    refetchInterval: (value) =>
      value.state.data?.status === 'PENDING' && value.state.data.expiresAt
        ? Math.min(15000, Math.max(1000, Date.parse(value.state.data.expiresAt) - Date.now()))
        : 15000,
  })
  const guest = context.error instanceof ApiError && context.error.status === 401
  const record = query.data
  const basePath = management ? '/manager/appointments' : '/user/appointments'
  const canManage =
    management && !!record?.branchId && !!context.data?.manageableBranchIds.includes(record.branchId)
  if (!management && context.data && hasViewingManagementRole(context.data.roles)) {
    return (
      <Navigate
        replace
        to={viewingAppointmentsPath(context.data.roles, { appointmentId, branchId: record?.branchId })}
      />
    )
  }
  return (
    <Page
      title="Chi tiết lịch xem phòng"
      eyebrow="YÊU CẦU XEM PHÒNG"
      back={viewingAppointmentsPath(context.data?.roles ?? [], { branchId: record?.branchId })}
      narrow
    >
      {!valid ? (
        <Notice>Liên kết lịch hẹn không hợp lệ.</Notice>
      ) : guest ? (
        <LoginNotice redirect={`${basePath}/${appointmentId}`} />
      ) : (
        <QueryState
          pending={context.isPending || context.isFetching}
          error={context.error}
          retry={context.refetch}
        >
          <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
            {record && management && !canManage ? (
              <Notice tone="warning">Bạn không có quyền quản lý lịch này.</Notice>
            ) : (
              record && (
                <>
                  <Panel>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold">
                          {record.roomNumber ?? 'Phòng đã đặt lịch'}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">{record.branchName}</p>
                      </div>
                      <ViewingAppointmentBadge status={record.status} />
                    </div>
                    <dl className="mt-7 grid gap-5 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Ngày và giờ đã hẹn (VN)</dt>
                        <dd className="mt-2 font-bold">
                          {viewingDateTime(record.startAt)} →{' '}
                          {record.endAt
                            ? new Date(record.endAt).toLocaleTimeString('vi-VN', {
                                timeZone: 'Asia/Ho_Chi_Minh',
                                hour: '2-digit',
                                minute: '2-digit',
                                hourCycle: 'h23',
                              })
                            : 'Chưa xác định'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Ca đã chọn</dt>
                        <dd className="mt-2 font-bold">
                          {record.shiftType ? shiftLabels[record.shiftType] : 'Chưa xác định'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Người liên hệ</dt>
                        <dd className="mt-2 font-bold">
                          {record.contactName ?? 'Chưa có thông tin'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Số điện thoại đã dùng</dt>
                        <dd className="mt-2 font-bold">
                          {record.contactPhone ?? 'Chưa có thông tin'}
                        </dd>
                      </div>
                    </dl>
                    {record.status === 'PENDING' && (
                      <div className="mt-6">
                        <Notice>
                          Yêu cầu đã giữ ca và đang chờ phía quản lý duyệt. Hạn duyệt:{' '}
                          {viewingDateTime(record.expiresAt)}.
                        </Notice>
                      </div>
                    )}
                    {record.status === 'EXPIRED' && (
                      <div className="mt-6">
                        <Notice tone="warning">
                          Yêu cầu đã hết thời hạn duyệt và không còn giữ ca. Bạn có thể chọn ngày/ca
                          khác còn trống.
                        </Notice>
                      </div>
                    )}
                    {record.rejectReason && (
                      <p className="mt-5 text-sm">Lý do từ chối: {record.rejectReason}</p>
                    )}
                    {record.approvedAt && (
                      <p className="mt-5 text-sm">
                        Đã duyệt bởi {record.approvedByName ?? 'Phía quản lý'} ·{' '}
                        {viewingDateTime(record.approvedAt)}
                      </p>
                    )}
                    {record.cancellationReason && (
                      <p className="mt-5 whitespace-pre-line text-sm">
                        Lý do hủy: {record.cancellationReason}
                      </p>
                    )}
                    {record.cancellationCause && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nguyên nhân: {viewingCancellationLabels[record.cancellationCause]}
                      </p>
                    )}
                    {record.result && (
                      <p className="mt-5 whitespace-pre-line text-sm">Kết quả: {record.result}</p>
                    )}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => void query.refetch()}
                        disabled={query.isFetching}
                      >
                        Kiểm tra trạng thái
                      </Button>
                      <Button asChild variant="outline">
                        <Link to={`/rooms/${record.roomId}/viewing`}>Xem ca khác</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/notifications/viewing">Thông báo lịch xem</Link>
                      </Button>
                      {record.publicContactPhone && (
                        <a
                          className="inline-flex min-h-11 items-center text-sm font-bold text-primary"
                          href={`tel:${record.publicContactPhone}`}
                        >
                          Liên hệ chi nhánh
                        </a>
                      )}
                    </div>
                  </Panel>
                  <ViewingAppointmentActions key={record.id} record={record} manager={canManage} />
                  <Panel className="mt-6">
                    <h2 className="font-bold">Lịch sử yêu cầu</h2>
                    <ol className="mt-5 space-y-5 border-l border-border pl-5">
                      {record.history.map((event) => (
                        <li key={event.id}>
                          <p className="text-sm font-bold">
                            {event.action === 'RESULT_CORRECTED'
                              ? 'Sửa kết quả / ghi chú'
                              : viewingStatusLabels[event.status]}
                          </p>
                          {event.before && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {viewingStatusLabels[event.before]} →{' '}
                              {viewingStatusLabels[event.status]}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {viewingDateTime(event.at)} ·{' '}
                            {event.actorName ??
                              (event.action === 'EXPIRED' || event.action === 'SYSTEM_CANCELLED'
                                ? 'Hệ thống'
                                : 'Tài khoản thực hiện')}
                          </p>
                          {event.reason && (
                            <p className="mt-2 text-sm text-muted-foreground">{event.reason}</p>
                          )}
                          {event.cancellationCause && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {viewingCancellationLabels[event.cancellationCause]}
                            </p>
                          )}
                          {canManage && !!event.relatedBookingIds?.length && (
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                              Booking liên quan: {event.relatedBookingIds.join(', ')}
                            </p>
                          )}
                          {event.action === 'RESULT_CORRECTED' && (
                            <p className="mt-2 whitespace-pre-line text-sm">
                              Ghi chú trước: {event.previousNote || '(trống)'}
                              <br />
                              Ghi chú sau: {event.note || '(trống)'}
                            </p>
                          )}
                          {event.action !== 'RESULT_CORRECTED' && event.note && (
                            <p className="mt-2 whitespace-pre-line text-sm">
                              Ghi chú: {event.note}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                    {record.history.length === 0 && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Chưa có lịch sử nghiệp vụ.
                      </p>
                    )}
                  </Panel>
                </>
              )
            )}
          </QueryState>
        </QueryState>
      )}
    </Page>
  )
}
