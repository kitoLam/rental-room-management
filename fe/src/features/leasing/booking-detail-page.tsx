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
import { bookingService, contractService } from '@/services/guest-user'
import { provider } from '@/services/config'
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
  const [serviceSelectionDraft, setServiceSelectionDraft] = useState<string[] | null>(null)
  const [confirmServiceSelection, setConfirmServiceSelection] = useState(false)
  const [reviewDraft, setReviewDraft] = useState({
    startDate: '', endDate: '', amount: '', paymentDeadline: '', holdExpiresAt: '', checkInDeadline: '', cancellationPolicy: '',
  })
  const now = useNow(reviewOpen ? 1000 : 30000)
  const reviewTimeErrors = bookingReviewTimeErrors({ ...reviewDraft, expectedMoveInDate: reviewDraft.startDate }, now)
  const hasReviewTimeError = Object.keys(reviewTimeErrors).length > 0
  const result = useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => bookingService.get(bookingId),
    enabled: uuid(bookingId),
    refetchInterval: 15000,
  })
  const record = result.data
  const contractQuery = useQuery({
    queryKey: ['booking-contract', record?.contractId],
    queryFn: () => contractService.get(record!.contractId!),
    enabled: provider('leasing') === 'real' && Boolean(record?.contractId),
  })
  const serviceSelection = useMutation({
    mutationFn: (ids: string[]) => contractService.selectServices(record!.contractId!, ids),
    onSuccess: async () => {
      setServiceSelectionDraft(null)
      setConfirmServiceSelection(false)
      await contractQuery.refetch()
    },
  })
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
      if (errors.paymentDeadline || errors.holdExpiresAt || errors.checkInDeadline)
        throw new Error(errors.paymentDeadline || errors.holdExpiresAt || errors.checkInDeadline)
      return bookingService.review(bookingId, {
        accepted: true,
        expectedMoveInDate: reviewDraft.startDate,
        expectedMoveOutDate: reviewDraft.endDate,
        holdingDepositAmount: Number(reviewDraft.amount),
        paymentDeadline: new Date(reviewDraft.paymentDeadline).toISOString(),
        holdExpiresAt: new Date(reviewDraft.holdExpiresAt).toISOString(),
        checkInDeadline: new Date(reviewDraft.checkInDeadline).toISOString(),
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
                Đã lập hợp đồng nháp {record.contractId}. Chọn dịch vụ tùy chọn trong phần hợp đồng bên dưới; quản lý sẽ tải lên bản giấy đã ký sau khi bàn giao.
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
                    checkInDeadline: toLocalDateTime(record.checkInDeadline || ''),
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
            {record.contractId && <Panel>
              <h2 className="mb-4 text-lg font-bold">Hợp đồng nháp</h2>
              <QueryState pending={contractQuery.isPending} error={contractQuery.error} retry={contractQuery.refetch}>
                {contractQuery.data && <>
                  <p className="mb-3">{contractQuery.data.contractNumber} · {contractQuery.data.status}</p>
                  <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="font-semibold">Bên cho thuê</dt><dd>{contractQuery.data.landlordName || '—'} · {contractQuery.data.landlordIdNumber || '—'} · {contractQuery.data.landlordAddress || '—'}</dd></div>
                    <div><dt className="font-semibold">Bên thuê</dt><dd>{contractQuery.data.tenantName || '—'} · {contractQuery.data.tenantIdNumber || '—'} · {contractQuery.data.tenantAddress || '—'}</dd></div>
                    <div><dt className="font-semibold">Phòng / chỗ</dt><dd>{contractQuery.data.roomAddress || contractQuery.data.roomSlotId}</dd></div>
                    <div><dt className="font-semibold">Thời hạn thuê</dt><dd>{dateOnly(contractQuery.data.startDate)} – {dateOnly(contractQuery.data.endDate)}</dd></div>
                    <div><dt className="font-semibold">Giá thuê / tháng</dt><dd>{formatVnd(contractQuery.data.rentPrice)}</dd></div>
                    <div><dt className="font-semibold">Tiền cọc hợp đồng</dt><dd>{formatVnd(contractQuery.data.contractDepositAmount)}</dd></div>
                    <div><dt className="font-semibold">Hạn trả hàng tháng</dt><dd>Ngày {contractQuery.data.paymentDueDay ?? '—'}</dd></div>
                    <div><dt className="font-semibold">Số người tối đa</dt><dd>{contractQuery.data.maxOccupants ?? '—'}</dd></div>
                    <div><dt className="font-semibold">Điện</dt><dd>{contractQuery.data.electricityInitialReading ?? '—'} kWh · {formatVnd(contractQuery.data.electricityRate ?? 0)}/kWh</dd></div>
                    <div><dt className="font-semibold">Nước</dt><dd>{contractQuery.data.waterInitialReading ?? '—'} m³ · {formatVnd(contractQuery.data.waterRate ?? 0)}/m³</dd></div>
                  </dl>
                  <p className="mb-4 whitespace-pre-wrap text-sm leading-6">{contractQuery.data.terms}</p>
                  <div className="space-y-2">
                    {contractQuery.data.services.map((service) => <label key={service.serviceId} className="flex items-center gap-3 rounded border p-3">
                      <input type="checkbox" checked={service.mandatory || (serviceSelectionDraft ?? contractQuery.data!.services.filter((item) => item.mandatory || item.selected).map((item) => item.serviceId)).includes(service.serviceId)}
                        disabled={service.mandatory || contractQuery.data.status !== 'DRAFT'}
                        onChange={(event) => {
                          const selected = serviceSelectionDraft ?? contractQuery.data!.services.filter((item) => item.mandatory || item.selected).map((item) => item.serviceId)
                          const next = event.target.checked ? [...selected, service.serviceId] : selected.filter((id) => id !== service.serviceId)
                          setServiceSelectionDraft([...new Set(next)])
                        }} />
                      <span>{service.name} · {formatVnd(service.unitPrice)}/{service.unit} · {service.mandatory ? 'Bắt buộc' : 'Tùy chọn'}</span>
                    </label>)}
                  </div>
                  {serviceSelectionDraft && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => setServiceSelectionDraft(null)}>
                        Bỏ thay đổi
                      </Button>
                      <Button
                        loading={serviceSelection.isPending}
                        onClick={() => setConfirmServiceSelection(true)}
                      >
                        Xem lại và lưu dịch vụ
                      </Button>
                    </div>
                  )}
                  <p className="mt-4 font-semibold">
                    Tổng phí dịch vụ cố định đã chọn: {formatVnd(contractQuery.data.services
                      .filter((service) => service.selected && service.calculationType === 'FIXED')
                      .reduce((sum, service) => sum + service.unitPrice, 0))}/tháng
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Điện, nước và dịch vụ tính theo sản lượng/đầu người được tính theo mức sử dụng thực tế.
                  </p>
                  {contractQuery.data.signedFileUrl && <a className="mt-4 inline-block text-primary underline" href={contractQuery.data.signedFileUrl} target="_blank" rel="noreferrer">Mở hợp đồng đã ký</a>}
                  <InlineError error={serviceSelection.error} />
                </>}
              </QueryState>
            </Panel>}
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
          <Field id="review-checkin-deadline" label="Hạn check-in / bàn giao" error={reviewTimeErrors.checkInDeadline}>
            <input id="review-checkin-deadline" className="input" type="datetime-local" required value={reviewDraft.checkInDeadline} onChange={(event) => setReviewDraft({ ...reviewDraft, checkInDeadline: event.target.value })} />
          </Field>
          <Field id="review-cancellation-policy" label="Điều kiện hủy">
            <textarea id="review-cancellation-policy" className="input min-h-24" required value={reviewDraft.cancellationPolicy} onChange={(event) => setReviewDraft({ ...reviewDraft, cancellationPolicy: event.target.value })} />
          </Field>
          <InlineError error={review.error} />
          <Button type="submit" loading={review.isPending} disabled={hasReviewTimeError}>Gửi điều khoản cho khách</Button>
        </form>
      </Modal>
      <Modal
        title="Xác nhận dịch vụ hợp đồng"
        description="Các lựa chọn sẽ được lưu vào bản hợp đồng nháp để Owner/Manager chuẩn bị bàn giao."
        open={confirmServiceSelection}
        onOpenChange={(open) => !serviceSelection.isPending && setConfirmServiceSelection(open)}
      >
        <ul className="space-y-2 text-sm">
          {(serviceSelectionDraft || []).map((serviceId) => {
            const service = contractQuery.data?.services.find((item) => item.serviceId === serviceId)
            return service ? <li key={serviceId}>{service.name} · {formatVnd(service.unitPrice)}/{service.unit}</li> : null
          })}
        </ul>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" disabled={serviceSelection.isPending} onClick={() => setConfirmServiceSelection(false)}>
            Quay lại
          </Button>
          <Button
            loading={serviceSelection.isPending}
            onClick={() => serviceSelectionDraft && serviceSelection.mutate(serviceSelectionDraft)}
          >
            Xác nhận lưu lựa chọn
          </Button>
        </div>
        <InlineError error={serviceSelection.error} />
      </Modal>
    </Page>
  )
}
