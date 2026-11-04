import { ConfirmAction, InlineError, Notice, Page, Panel, QueryState, RecordStatus } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { bookingService, contractService } from '@/services/guest-user'
import { provider } from '@/services/config'
import { useSession } from '@/features/auth/session-store'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Timeline } from './activity-shared'

export function BookingDetailPage() {
  const { bookingId = '' } = useParams()
  const user = useSession((state) => state.user)
  const canManage = user?.roles.some((role) => ['ADMIN', 'OWNER', 'MANAGER'].includes(role)) || false
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [termMonths, setTermMonths] = useState('3')
  const [signedDate, setSignedDate] = useState('')
  const [managerNote, setManagerNote] = useState('')
  const [firstBillingStartDate, setFirstBillingStartDate] = useState('')
  const recordQuery = useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => bookingService.get(bookingId),
    enabled: Boolean(bookingId),
    refetchInterval: 15000,
  })
  const record = recordQuery.data
  const contractQuery = useQuery({
    queryKey: ['booking-contract', record?.contractId],
    queryFn: () => contractService.get(record!.contractId!),
    enabled: provider('leasing') === 'real' && Boolean(record?.contractId),
  })
  const refresh = async () => {
    await invalidateActivity()
    await Promise.all([recordQuery.refetch(), contractQuery.refetch()])
  }
  const cancel = useMutation({ mutationFn: () => bookingService.cancel(bookingId), onSuccess: refresh })
  const submitEvidence = useMutation({
    mutationFn: () => contractService.submitEvidence(record!.contractId!, {
      evidenceUrl: evidenceUrl.trim(), termMonths: Number(termMonths), ...(signedDate ? { signedDate } : {}),
    }),
    onSuccess: async () => { setEvidenceUrl(''); await refresh() },
  })
  const reviewEvidence = useMutation({
    mutationFn: (approved: boolean) => contractService.reviewEvidence(record!.contractId!, {
      approved,
      ...(managerNote.trim() ? { note: managerNote.trim() } : {}),
      ...(signedDate ? { adjustedSignedDate: signedDate } : {}),
      ...(firstBillingStartDate ? { firstBillingStartDate } : {}),
    }),
    onSuccess: refresh,
  })
  if (!bookingId) return <Page title="Liên kết giữ chỗ không hợp lệ" back="/user/bookings"><Notice>Chọn một yêu cầu từ danh sách.</Notice></Page>

  return (
    <Page title="Chi tiết giữ chỗ" back="/user/bookings" narrow>
      <QueryState pending={recordQuery.isPending} error={recordQuery.error} retry={recordQuery.refetch}>
        {record && <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{record.roomTitle}</h2>
            <RecordStatus status={record.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{record.branchName} · {record.slotLabels.join(', ')}</p>
          <p className="mt-3 break-all text-xs text-muted-foreground">Mã giữ chỗ: {record.id}</p>
          <dl className="my-7 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Các slot</dt><dd className="mt-2 text-sm font-bold">{record.slotLabels.join(', ') || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tiền cọc</dt><dd className="mt-2 font-bold text-primary">{formatVnd(record.holdAmount)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Hạn thanh toán</dt><dd className="mt-2 text-sm">{record.paymentDueAt ? dateTime(record.paymentDueAt) : '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tạo lúc</dt><dd className="mt-2 text-sm">{dateTime(record.createdAt)}</dd></div>
          </dl>
          {record.hasRentalDates && <Notice>Khoảng thuê: {record.startDate} → {record.endDate}</Notice>}
          {record.status === 'AWAITING_PAYMENT' && <Notice tone="warning">Các slot được giữ trong 24 giờ. Thanh toán sau hạn không khôi phục booking và khoản tiền đến muộn sẽ chờ manager xử lý hoàn.</Notice>}
          {record.status === 'EXPIRED' && <Notice tone="warning">Booking đã hết hạn và slot đã được trả về inventory. Khoản thanh toán đến muộn cần được hoàn.</Notice>}
          {record.depositStatus === 'PROCESSING' && <Notice tone="warning">Khoản cọc đang được xử lý hoàn tiền.</Notice>}
          {record.status === 'CONFIRMED' && <Notice tone="success">Đã nhận cọc. Hợp đồng tạm đã được tạo; tenancy chỉ kích hoạt sau khi manager duyệt bằng chứng.</Notice>}
          <div className="mt-6 flex flex-wrap gap-3">
            {!canManage && record.status === 'AWAITING_PAYMENT' && <Button asChild><Link to={`/user/bookings/${record.id}/payment`}>Thanh toán cọc</Link></Button>}
            {record.contractId && <Button asChild variant="outline"><Link to={`/tenant/contracts/${record.contractId}`}>Mở hợp đồng tạm</Link></Button>}
            {['REQUESTED', 'AWAITING_PAYMENT'].includes(record.status) && <ConfirmAction
              label="Hủy giữ chỗ" title="Hủy giữ chỗ?" description="Các slot sẽ được giải phóng. Nếu đã thanh toán, khoản cọc sẽ được chuyển sang xử lý hoàn."
              pending={cancel.isPending} onConfirm={() => cancel.mutateAsync()} />}
          </div>
          <InlineError error={cancel.error} />
          <Timeline items={record.timeline} />
        </Panel>}
      </QueryState>

      {record?.contractId && provider('leasing') === 'real' && <Panel className="mt-5">
        <h2 className="text-lg font-bold">Hợp đồng tạm</h2>
        <QueryState pending={contractQuery.isPending} error={contractQuery.error} retry={contractQuery.refetch}>
          {contractQuery.data && <div className="mt-4 grid gap-5">
            <p className="text-sm">{contractQuery.data.contractNumber} · {contractQuery.data.status} · {contractQuery.data.roomSlotIds?.length ?? 1} slot</p>
            {contractQuery.data.templateDownloadUrl && <a className="text-sm text-primary underline" href={contractQuery.data.templateDownloadUrl} target="_blank" rel="noreferrer">Tải mẫu hợp đồng</a>}
            {contractQuery.data.evidenceDeadline && <Notice>Hạn nộp evidence: {dateTime(contractQuery.data.evidenceDeadline)}</Notice>}
            {contractQuery.data.evidenceNote && <Notice tone="warning">Manager yêu cầu gửi lại: {contractQuery.data.evidenceNote}</Notice>}
            {contractQuery.data.evidenceSubmittedAt && <Notice>Evidence đã gửi lúc {dateTime(contractQuery.data.evidenceSubmittedAt)}; đang chờ manager duyệt.</Notice>}
            {!canManage && contractQuery.data.status === 'DRAFT' && !contractQuery.data.evidenceSubmittedAt && <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submitEvidence.mutate() }}>
              <label className="grid gap-1 text-sm">Link ảnh/PDF hợp đồng đã ký<input className="input" type="url" required value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">Thời hạn hợp đồng<select className="input" value={termMonths} onChange={(event) => setTermMonths(event.target.value)}>{[3, 6, 8, 12].map((months) => <option key={months} value={months}>{months} tháng</option>)}</select></label>
              <label className="grid gap-1 text-sm">Ngày ký (để trống nếu ký hôm nay)<input className="input" type="date" value={signedDate} onChange={(event) => setSignedDate(event.target.value)} /></label>
              <InlineError error={submitEvidence.error} />
              <Button loading={submitEvidence.isPending}>Gửi bằng chứng hợp đồng</Button>
            </form>}
            {canManage && contractQuery.data.evidenceSubmittedAt && <div className="grid gap-4">
              {contractQuery.data.signedEvidenceUrl && <a className="text-sm text-primary underline" href={contractQuery.data.signedEvidenceUrl} target="_blank" rel="noreferrer">Xem evidence đã gửi</a>}
              <label className="grid gap-1 text-sm">Ngày ký đã xác minh (tùy chỉnh)<input className="input" type="date" value={signedDate} onChange={(event) => setSignedDate(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">Ngày bắt đầu kỳ tính tiền đầu tiên<input className="input" type="date" required value={firstBillingStartDate} onChange={(event) => setFirstBillingStartDate(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">Ghi chú / lý do gửi lại<textarea className="input min-h-20" value={managerNote} onChange={(event) => setManagerNote(event.target.value)} /></label>
              <InlineError error={reviewEvidence.error} />
              <div className="flex flex-wrap gap-3"><Button loading={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate(true)}>Duyệt evidence</Button><Button variant="outline" loading={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate(false)}>Yêu cầu gửi lại</Button></div>
            </div>}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">Giá thuê theo tháng</dt><dd>{formatVnd(contractQuery.data.rentPrice)}</dd></div>
              <div><dt className="font-semibold">Tiền cọc</dt><dd>{formatVnd(contractQuery.data.contractDepositAmount)}</dd></div>
              {contractQuery.data.startDate && <div><dt className="font-semibold">Hiệu lực</dt><dd>{contractQuery.data.startDate} → {contractQuery.data.endDate}</dd></div>}
              {contractQuery.data.services.map((service) => <div key={service.serviceId}><dt className="font-semibold">{service.name}</dt><dd>{service.quantity ?? 'Theo chỉ số'} {service.unit} · {formatVnd(service.unitPrice)}</dd></div>)}
            </dl>
          </div>}
        </QueryState>
      </Panel>}
    </Page>
  )
}
