import { Link, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarDays, Clock3, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ConfirmAction,
  InlineError,
  Notice,
  Page,
  Pagination,
  Panel,
  QueryState,
  RecordStatus,
} from '@/components/common/page'
import { appointmentService, bookingService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { provider } from '@/services/config'
import {
  appointmentStatuses,
  bookingStatuses,
  type Appointment,
  type Booking,
  type Page as PageResult,
} from '@/interfaces/domain'
import { useNow } from '@/hooks/use-now'
import { dateOnly, dateTime, statusLabel } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { uuid } from '@/lib/validation'

function Timeline({ items }: { items: { status: string; at: string; note: string }[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-5 font-bold">Tiến trình yêu cầu</h2>
      <ol className="space-y-5 border-l border-border pl-5">
        {items.map((item, i) => (
          <li key={`${item.at}-${i}`}>
            <p className="text-sm font-bold">{statusLabel[item.status] || item.status}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dateTime(item.at)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
export function ActivityRow({
  record,
  kind,
}: {
  record: Appointment | Booking
  kind: 'appointments' | 'bookings'
}) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-5 border-b border-border py-5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Link
            to={`/user/${kind}/${record.id}`}
            className="text-sm font-bold hover:text-primary hover:underline"
          >
            {record.roomTitle}
          </Link>
          <RecordStatus status={record.status} />
        </div>
        <p className="text-xs text-muted-foreground">{record.branchName}</p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          {kind === 'appointments' ? (
            <CalendarDays size={16} className="text-primary" />
          ) : (
            <KeyRound size={16} className="text-primary" />
          )}
          {'startAt' in record
            ? dateTime(record.startAt)
            : `${dateOnly(record.startDate)} → ${dateOnly(record.endDate)}`}
        </p>
        {'paymentDueAt' in record && record.status === 'AWAITING_PAYMENT' && (
          <p className="mt-2 flex items-center gap-2 text-xs text-warning">
            <Clock3 size={14} />
            Thanh toán trước {dateTime(record.paymentDueAt)}
          </p>
        )}
      </div>
      <Button asChild variant="outline">
        <Link to={`/user/${kind}/${record.id}`}>
          Chi tiết
          <ArrowUpRight />
        </Link>
      </Button>
    </article>
  )
}
function ActivityList({ kind }: { kind: 'appointments' | 'bookings' }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const rawPage = Number(params.get('page') || 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const statuses = kind === 'appointments' ? appointmentStatuses : bookingStatuses
  const valid = !status || statuses.includes(status as never)
  const result = useQuery<PageResult<Appointment | Booking>>({
    queryKey: [kind, 'list', status, page, params.get('demo')],
    queryFn: () =>
      kind === 'appointments'
        ? appointmentService.list(status, page)
        : bookingService.list(status, page),
    enabled: valid,
    refetchInterval: 30000,
  })
  function change(nextStatus: string, nextPage = 1) {
    setParams({
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
      ...(params.get('demo') ? { demo: params.get('demo')! } : {}),
    })
  }
  return (
    <Page
      eyebrow="KHÔNG GIAN CÁ NHÂN"
      title={kind === 'appointments' ? 'Lịch xem phòng của bạn.' : 'Kế hoạch tìm nơi ở.'}
      description={
        kind === 'appointments'
          ? 'Theo dõi phản hồi từ chi nhánh và sắp xếp thời gian ghé xem.'
          : 'Theo dõi khoản giữ chỗ, thời hạn và từng bước xác nhận.'
      }
      actions={
        <Button asChild>
          <Link to="/rooms">
            Tìm thêm phòng
            <ArrowUpRight />
          </Link>
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{result.data?.totalElements || 0} yêu cầu</p>
        <select
          aria-label="Lọc trạng thái"
          className="input w-auto max-w-full"
          value={status}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
      </div>
      {!valid ? (
        <Notice>
          Trạng thái lọc không hợp lệ.{' '}
          <button className="underline" onClick={() => change('')}>
            Xem tất cả
          </button>
        </Notice>
      ) : (
        <QueryState
          pending={result.isPending}
          error={result.error}
          retry={result.refetch}
          empty={result.data?.content.length === 0}
          emptyMessage={
            status
              ? 'Chưa có yêu cầu ở trạng thái này. Thử xem tất cả trạng thái.'
              : 'Bạn chưa có yêu cầu nào. Khám phá phòng để đặt lịch xem hoặc giữ chỗ.'
          }
        >
          {result.data && (
            <>
              <Panel>
                {result.data.content.map((record) => (
                  <ActivityRow key={record.id} record={record} kind={kind} />
                ))}
              </Panel>
              <Pagination
                page={page}
                totalPages={result.data.totalPages}
                onPage={(next) => change(status, next)}
              />
            </>
          )}
        </QueryState>
      )}
    </Page>
  )
}
export function AppointmentsPage() {
  return <ActivityList kind="appointments" />
}
export function BookingsPage() {
  return <ActivityList kind="bookings" />
}
export function AppointmentDetailPage() {
  const now = useNow()
  const { appointmentId = '' } = useParams()
  const result = useQuery({
    queryKey: ['appointments', appointmentId],
    queryFn: () => appointmentService.get(appointmentId),
    enabled: uuid(appointmentId),
  })
  const record = result.data
  const cancel = useMutation({
    mutationFn: () => appointmentService.cancel(appointmentId),
    onSuccess: async () => {
      await invalidateActivity()
    },
  })
  const demo = useMutation({
    mutationFn: (status: 'CONFIRMED' | 'REJECTED') =>
      appointmentService.demoResponse(appointmentId, status),
    onSuccess: async () => {
      await invalidateActivity()
    },
  })
  const canCancel =
    record &&
    ['PENDING', 'CONFIRMED'].includes(record.status) &&
    Date.parse(record.startAt) - now >=
      record.policySnapshot.appointmentPolicy.cancellationHours * 3600000
  if (!uuid(appointmentId))
    return (
      <Page title="Liên kết lịch hẹn không hợp lệ" back="/user/appointments">
        <Notice>Chọn một lịch hẹn từ danh sách của bạn.</Notice>
      </Page>
    )
  return (
    <Page title="Lịch hẹn xem phòng." back="/user/appointments" narrow>
      <QueryState pending={result.isPending} error={result.error} retry={result.refetch}>
        {record && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{record.roomTitle}</h2>
              <RecordStatus status={record.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{record.branchName}</p>
            <dl className="my-7 space-y-5 text-sm">
              <div>
                <dt className="text-muted-foreground">Thời gian (giờ Việt Nam)</dt>
                <dd className="mt-1 font-bold">
                  {dateTime(record.startAt)} → {dateTime(record.endAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Người phụ trách</dt>
                <dd className="mt-1">{record.assignedManager || 'Chi nhánh đang phân công'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lời nhắn</dt>
                <dd className="mt-1 whitespace-pre-line">{record.note || 'Không có lời nhắn'}</dd>
              </div>
            </dl>
            <InlineError error={cancel.error || demo.error} />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to={`/rooms/${record.roomId}`}>
                  Xem phòng
                  <ArrowUpRight />
                </Link>
              </Button>
              {canCancel && (
                <ConfirmAction
                  label="Hủy lịch hẹn"
                  title="Hủy lịch xem phòng này?"
                  description="Chi nhánh sẽ nhận thông báo. Bạn có thể đặt một lịch khác sau đó."
                  pending={cancel.isPending}
                  onConfirm={() => cancel.mutateAsync()}
                />
              )}
            </div>
            {!canCancel && ['PENDING', 'CONFIRMED'].includes(record.status) && (
              <p className="mt-4 text-xs text-muted-foreground">
                Đã ngoài thời hạn tự hủy. Vui lòng trao đổi với chi nhánh.
              </p>
            )}
            <Timeline items={record.timeline} />
            {provider('leasing') === 'mock' && record.status === 'PENDING' && (
              <div className="mt-8 rounded-lg bg-background p-4">
                <p className="text-xs font-bold">MÔ PHỎNG PHẢN HỒI CHI NHÁNH</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Công cụ thử luồng demo; không cấp quyền duyệt lịch thật cho người dùng.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    loading={demo.isPending}
                    onClick={() => demo.mutate('CONFIRMED')}
                  >
                    Mô phỏng chấp nhận
                  </Button>
                  <Button
                    variant="outline"
                    disabled={demo.isPending}
                    onClick={() => demo.mutate('REJECTED')}
                  >
                    Mô phỏng từ chối
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        )}
      </QueryState>
    </Page>
  )
}
export function BookingDetailPage() {
  const { bookingId = '' } = useParams()
  const result = useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => bookingService.get(bookingId),
    enabled: uuid(bookingId),
    refetchInterval: 15000,
  })
  const record = result.data
  const cancel = useMutation({
    mutationFn: () => bookingService.cancel(bookingId),
    onSuccess: async () => {
      await invalidateActivity()
    },
  })
  if (!uuid(bookingId))
    return (
      <Page title="Liên kết giữ chỗ không hợp lệ" back="/user/bookings">
        <Notice>Chọn một yêu cầu từ danh sách của bạn.</Notice>
      </Page>
    )
  return (
    <Page title="Yêu cầu giữ chỗ." back="/user/bookings" narrow>
      <QueryState pending={result.isPending} error={result.error} retry={result.refetch}>
        {record && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{record.roomTitle}</h2>
              <RecordStatus status={record.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {record.branchName}
              {record.slotLabel ? ` · ${record.slotLabel}` : ' · Nguyên phòng'}
            </p>
            <p className="mt-3 break-all text-xs text-muted-foreground">Mã yêu cầu: {record.id}</p>
            <dl className="my-7 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Khoảng thuê</dt>
                <dd className="mt-2 text-sm font-bold">
                  {dateOnly(record.startDate)} → {dateOnly(record.endDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Khoản giữ chỗ</dt>
                <dd className="mt-2 font-bold text-primary">{formatVnd(record.holdAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Hạn thanh toán</dt>
                <dd className="mt-2 text-sm">{dateTime(record.paymentDueAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Chính sách đã áp dụng</dt>
                <dd className="mt-2 text-sm">Phiên bản {record.policySnapshot.version}</dd>
              </div>
            </dl>
            {record.status === 'AWAITING_PAYMENT' && (
              <Notice tone="warning">
                Hoàn tất thanh toán trước thời hạn. Thanh toán đang chờ xác minh chưa xác nhận giữ
                chỗ.
              </Notice>
            )}
            {record.status === 'EXPIRED' && (
              <Notice tone="warning">
                Yêu cầu đã hết hạn. Giao dịch đến muộn cần được đối soát; yêu cầu này không tự động
                khôi phục.
              </Notice>
            )}
            {record.status === 'CONFIRMED' && (
              <Notice tone="success">
                Khoản giữ chỗ đã được xác minh. Đây chưa phải hợp đồng thuê và chưa tạo quan hệ
                Tenant.
              </Notice>
            )}
            {record.contractId && (
              <Notice>
                Đã chuyển sang hợp đồng {record.contractId}. Màn hình hợp đồng Tenant nằm ngoài phạm
                vi phiên bản này.
              </Notice>
            )}
            <InlineError error={cancel.error} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                asChild
                variant={record.status === 'AWAITING_PAYMENT' ? 'default' : 'outline'}
              >
                <Link to={`/user/bookings/${record.id}/payment`}>
                  {record.status === 'AWAITING_PAYMENT' ? 'Thanh toán giữ chỗ' : 'Xem thanh toán'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/rooms/${record.roomId}`}>Xem phòng</Link>
              </Button>
              {['REQUESTED', 'AWAITING_PAYMENT'].includes(record.status) && (
                <ConfirmAction
                  label="Hủy yêu cầu"
                  title="Hủy yêu cầu giữ chỗ?"
                  description="Tài nguyên sẽ được giải phóng. Nếu đã gửi tiền, giao dịch cần được đối soát riêng."
                  pending={cancel.isPending}
                  onConfirm={() => cancel.mutateAsync()}
                />
              )}
            </div>
            <Timeline items={record.timeline} />
            <p className="mt-6 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
              {record.policySnapshot.cancellationTerms}
            </p>
          </Panel>
        )}
      </QueryState>
    </Page>
  )
}
