import {
  ConfirmAction,
  Field,
  InlineError,
  Modal,
  Notice,
  Page,
  Panel,
  QueryState,
  RecordStatus,
} from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { bookingReviewTimeErrors, uuid } from '@/lib/validation'
import { useNow } from '@/hooks/use-now'
import { bookingService } from '@/services/guest-user'
import { useSession } from '@/features/auth/session-store'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useState } from 'react'
import { Timeline } from './activity-shared'
const toLocalDateTime = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function BookingDetailPage() {
  const { bookingId = '' } = useParams()
  const user = useSession((state) => state.user)
  const canManage = user?.roles.some((role) => ['ADMIN', 'OWNER', 'MANAGER'].includes(role)) || false
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDraft, setReviewDraft] = useState({
    startDate: '', endDate: '', amount: '', paymentDeadline: '', holdExpiresAt: '', cancellationPolicy: '',
  })
  const now = useNow(reviewOpen ? 1000 : 30000)
  const reviewTimeErrors = bookingReviewTimeErrors(reviewDraft, now)
  const hasReviewTimeError = Object.keys(reviewTimeErrors).length > 0
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
  const acceptTerms = useMutation({
    mutationFn: (accepted: boolean) => bookingService.acceptTerms(bookingId, accepted),
    onSuccess: async () => {
      await invalidateActivity()
      await result.refetch()
    },
  })
  const review = useMutation({
    mutationFn: () => {
      const errors = bookingReviewTimeErrors(reviewDraft)
      if (errors.paymentDeadline || errors.holdExpiresAt)
        throw new Error(errors.paymentDeadline || errors.holdExpiresAt)
      return bookingService.review(bookingId, {
        accepted: true,
        expectedMoveInDate: reviewDraft.startDate,
        expectedMoveOutDate: reviewDraft.endDate,
        holdingDepositAmount: Number(reviewDraft.amount),
        paymentDeadline: new Date(reviewDraft.paymentDeadline).toISOString(),
        holdExpiresAt: new Date(reviewDraft.holdExpiresAt).toISOString(),
        cancellationPolicy: reviewDraft.cancellationPolicy,
      })
    },
    onSuccess: async () => {
      setReviewOpen(false)
      await invalidateActivity()
      await result.refetch()
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
                <dd className="mt-2 font-bold text-primary">{record.status === 'REQUESTED' ? 'Chưa xác định' : formatVnd(record.holdAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Hạn thanh toán</dt>
                <dd className="mt-2 text-sm">{record.paymentDueAt ? dateTime(record.paymentDueAt) : 'Chưa xác định'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Chính sách đã áp dụng</dt>
                <dd className="mt-2 text-sm">{record.status === 'REQUESTED' ? 'Chưa có — chờ Owner/Manager duyệt' : 'Owner/Manager đã xác nhận'}</dd>
              </div>
            </dl>
            {record.status === 'REQUESTED' && (
              <Notice>Yêu cầu đã được gửi và đang chờ Owner/Manager duyệt.</Notice>
            )}
            {record.status === 'AWAITING_PAYMENT' && !record.termsAcceptedAt && (
              <Notice tone="warning">
                Owner/Manager đã gửi điều khoản. Hãy xác nhận trước khi thanh toán.
              </Notice>
            )}
            {record.status === 'AWAITING_PAYMENT' && record.termsAcceptedAt && (
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
            {record.depositStatus === 'PROCESSING' && (
              <Notice tone="warning">Khoản cọc đang được xử lý hoàn tiền.</Notice>
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
              {canManage && (record.status === 'REQUESTED' || (record.status === 'AWAITING_PAYMENT' && !record.termsAcceptedAt)) && (
                <Button onClick={() => {
                  review.reset()
                  setReviewDraft({
                    startDate: record.startDate,
                    endDate: record.endDate,
                    amount: record.holdAmount ? String(record.holdAmount) : '',
                    paymentDeadline: toLocalDateTime(record.paymentDueAt),
                    holdExpiresAt: toLocalDateTime(record.temporaryHoldUntil),
                    cancellationPolicy: record.cancellationPolicy || '',
                  })
                  setReviewOpen(true)
                }}>
                  {record.status === 'REQUESTED' ? 'Duyệt và gửi điều khoản' : 'Sửa điều khoản và gửi lại'}
                </Button>
              )}
              {!canManage && record.status === 'AWAITING_PAYMENT' && !record.termsAcceptedAt ? (
                <>
                  <Button loading={acceptTerms.isPending} onClick={() => acceptTerms.mutate(true)}>Chấp nhận điều khoản</Button>
                  <Button variant="outline" loading={acceptTerms.isPending} onClick={() => acceptTerms.mutate(false)}>Từ chối điều khoản</Button>
                </>
              ) : !canManage && record.status === 'AWAITING_PAYMENT' && record.termsAcceptedAt ? (
                <Button asChild><Link to={`/user/bookings/${record.id}/payment`}>Thanh toán giữ chỗ</Link></Button>
              ) : null}
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
              {record.cancellationPolicy || record.policySnapshot?.cancellationTerms || ''}
            </p>
          </Panel>
        )}
      </QueryState>
      <Modal
        title={record?.status === 'REQUESTED' ? 'Duyệt yêu cầu và gửi điều khoản' : 'Sửa điều khoản giữ chỗ'}
        description="Nhập thông tin cọc và hai mốc thời gian để gửi cho khách."
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      >
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!hasReviewTimeError) review.mutate() }}>
          <Field id="review-start" label="Ngày bắt đầu thuê">
            <input id="review-start" className="input" type="date" required value={reviewDraft.startDate} onChange={(event) => setReviewDraft({ ...reviewDraft, startDate: event.target.value })} />
          </Field>
          <Field id="review-end" label="Ngày kết thúc thuê">
            <input id="review-end" className="input" type="date" required min={reviewDraft.startDate} value={reviewDraft.endDate} onChange={(event) => setReviewDraft({ ...reviewDraft, endDate: event.target.value })} />
          </Field>
          <Field id="review-amount" label="Khoản cọc giữ chỗ (VND)">
            <input id="review-amount" className="input" type="number" min="0" step="1" required value={reviewDraft.amount} onChange={(event) => setReviewDraft({ ...reviewDraft, amount: event.target.value })} />
          </Field>
          <Field id="review-payment-deadline" label="Hạn thanh toán" error={reviewTimeErrors.paymentDeadline}>
            <input id="review-payment-deadline" className="input" type="datetime-local" required value={reviewDraft.paymentDeadline} onChange={(event) => setReviewDraft({ ...reviewDraft, paymentDeadline: event.target.value })} />
          </Field>
          <Field id="review-hold-expiry" label="Thời điểm hết hạn giữ chỗ" error={reviewTimeErrors.holdExpiresAt}>
            <input id="review-hold-expiry" className="input" type="datetime-local" required value={reviewDraft.holdExpiresAt} onChange={(event) => setReviewDraft({ ...reviewDraft, holdExpiresAt: event.target.value })} />
          </Field>
          <Field id="review-cancellation-policy" label="Điều kiện hủy">
            <textarea id="review-cancellation-policy" className="input min-h-24" required value={reviewDraft.cancellationPolicy} onChange={(event) => setReviewDraft({ ...reviewDraft, cancellationPolicy: event.target.value })} />
          </Field>
          <InlineError error={review.error} />
          <Button type="submit" loading={review.isPending} disabled={hasReviewTimeError}>Gửi điều khoản cho khách</Button>
        </form>
      </Modal>
    </Page>
  )
}
