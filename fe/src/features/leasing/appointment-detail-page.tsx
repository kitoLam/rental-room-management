import {
  ConfirmAction,
  InlineError,
  Notice,
  Page,
  Panel,
  QueryState,
  RecordStatus,
} from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/use-now'
import { dateTime } from '@/lib/activity'
import { uuid } from '@/lib/validation'
import { provider } from '@/services/config'
import { appointmentService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Timeline } from './activity-shared'
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
