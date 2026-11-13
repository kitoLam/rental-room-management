import { ConfirmAction, InlineError, Notice, Page, Panel, QueryState, RecordStatus } from '@/components/common/page'
import { ContractEvidencePanel } from './contract-evidence-panel'
import { Button } from '@/components/ui/button'
import { bookingMoveInDate, dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { bookingService } from '@/services/guest-user'
import { provider } from '@/services/config'
import { useSession } from '@/features/auth/session-store'
import { invalidateActivity } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Timeline } from './activity-shared'

export function BookingDetailPage() {
  const { bookingId = '' } = useParams()
  const { hash } = useLocation()
  const contractsSection = useRef<HTMLElement>(null)
  const user = useSession((state) => state.user)
  const canManage = user?.roles.some((role) => ['ADMIN', 'OWNER', 'MANAGER'].includes(role)) || false
  const recordQuery = useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => bookingService.get(bookingId),
    enabled: Boolean(bookingId),
    refetchInterval: 15000,
  })
  const record = recordQuery.data
  // One contract per booked slot; older bookings only have contractId.
  const contractIds = record?.contractIds?.length ? record.contractIds : record?.contractId ? [record.contractId] : []
  const showContracts = provider('leasing') === 'real' && contractIds.length > 0
  useEffect(() => {
    if (hash === '#contracts' && showContracts) contractsSection.current?.focus()
  }, [hash, showContracts, bookingId])
  const refresh = async () => {
    await invalidateActivity()
    await recordQuery.refetch()
  }
  const cancel = useMutation({ mutationFn: () => bookingService.cancel(bookingId), onSuccess: refresh })
  if (!bookingId) return <Page title="Liên kết giữ chỗ không hợp lệ" back="/tenant/bookings"><Notice>Chọn một yêu cầu từ danh sách.</Notice></Page>

  return (
    <Page title="Chi tiết giữ chỗ" back="/tenant/bookings" narrow>
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
            {record.slotMoveInDates ? (
              <div>
                <dt className="text-xs text-muted-foreground">Ngày nhận phòng theo slot</dt>
                {record.roomSlotIds.map((id, index) => {
                  const date = record.slotMoveInDates?.[id]
                  return <dd key={id} className="mt-2 text-sm">{record.slotLabels[index]} · {date ? dateOnly(date) : 'Chưa có thông tin'}</dd>
                })}
              </div>
            ) : <div><dt className="text-xs text-muted-foreground">{record.hasRentalDates ? 'Ngày bắt đầu thuê' : 'Ngày bắt đầu thuê dự kiến'}</dt><dd className="mt-2 text-sm font-bold">{bookingMoveInDate(record) ? dateOnly(bookingMoveInDate(record)!) : "Chưa có thông tin"}</dd></div>}
            <div><dt className="text-xs text-muted-foreground">Tiền cọc</dt><dd className="mt-2 font-bold text-primary">{formatVnd(record.holdAmount)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Hạn thanh toán</dt><dd className="mt-2 text-sm">{record.paymentDueAt ? dateTime(record.paymentDueAt) : '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tạo lúc</dt><dd className="mt-2 text-sm">{dateTime(record.createdAt)}</dd></div>
          </dl>
          {!record.slotMoveInDates && record.hasRentalDates && <Notice>Khoảng thuê: {record.startDate} → {record.endDate}</Notice>}
          {record.status === 'AWAITING_PAYMENT' && <Notice tone="warning">Các slot được giữ trong 24 giờ. Thanh toán sau hạn không khôi phục booking và khoản tiền đến muộn sẽ chờ manager xử lý hoàn.</Notice>}
          {record.status === 'EXPIRED' && <Notice tone="warning">Booking đã hết hạn và slot đã được trả về inventory. Khoản thanh toán đến muộn cần được hoàn.</Notice>}
          {record.depositStatus === 'PROCESSING' && <Notice tone="warning">Khoản cọc đang được xử lý hoàn tiền.</Notice>}
          {record.status === 'CONFIRMED' && <Notice tone="success">Đã nhận cọc chung cho {contractIds.length} chỗ. Mỗi chỗ có một hợp đồng riêng: ký, nộp bản ký và chờ quản lý duyệt từng hợp đồng; chỗ nào được duyệt thì vào được không gian thuê của chỗ đó.</Notice>}
          <div className="mt-6 flex flex-wrap gap-3">
            {!canManage && record.status === 'AWAITING_PAYMENT' && <Button asChild><Link to={`/tenant/bookings/${record.id}/payment`}>Thanh toán cọc</Link></Button>}
            {['REQUESTED', 'AWAITING_PAYMENT'].includes(record.status) && <ConfirmAction
              label="Hủy giữ chỗ" title="Hủy giữ chỗ?" description="Các slot sẽ được giải phóng. Nếu đã thanh toán, khoản cọc sẽ được chuyển sang xử lý hoàn."
              pending={cancel.isPending} onConfirm={() => cancel.mutateAsync()} />}
          </div>
          <InlineError error={cancel.error} />
          <Timeline items={record.timeline} />
        </Panel>}
      </QueryState>

      {showContracts && (
        <section id="contracts" ref={contractsSection} tabIndex={-1} aria-label="Hợp đồng giữ chỗ">
          {contractIds.map((contractId, index) => (
            <ContractEvidencePanel key={contractId} contractId={contractId} index={contractIds.length > 1 ? index : undefined}
              canManage={canManage} onChanged={refresh}
              moveInDate={bookingMoveInDate(record)} />
          ))}
        </section>
      )}
    </Page>
  )
}
