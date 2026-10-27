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
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { uuid } from '@/lib/validation'
import { bookingService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Timeline } from './activity-shared'
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
