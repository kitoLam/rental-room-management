import { ContractEvidenceLink } from '@/features/leasing/contract-evidence-link'
import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { ContractPdfDownload } from '@/features/leasing/contract-pdf-download'
import { addMonths, bookingMoveInDate, dateOnly, firstBillingStartDate as suggestedFirstBillingStartDate, vnDateKey } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import { bookingService, contractService } from '@/services/guest-user'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { ActionDialog, ManagerForm, ManagerLink, ManagerPage, ManagerStatus, ExpiringSoonBadge } from './components'
import { useManagerAction, useManagerQuery } from './context'
import { History } from './leasing-shared'

const terminationDetailsKey = (id: string) => ['contract-termination-details', id]
const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`

function ContractTerminationSummary({ contractId }: { contractId: string }) {
  const details = useQuery({
    queryKey: terminationDetailsKey(contractId),
    queryFn: () => contractService.terminationDetails(contractId),
  })
  const settlement = details.data?.settlement
  return (
    <QueryState pending={details.isPending} error={details.error} retry={details.refetch}>
      {settlement && <Panel className="space-y-4">
        <h2 className="font-bold">Quyết toán hủy hợp đồng</h2>
        <Facts items={[
          ['Lý do hủy', settlement.reason],
          ['Ngày thuê cuối', dateOnly(settlement.lastRentalDate)],
          ['Ngày cho thuê lại khi hủy', dateOnly(details.data!.availableFrom)],
          ['Tiền cọc theo hợp đồng', settlement.agreedDepositAmount == null ? 'Mất cọc' : `Mất cọc · ${money(settlement.agreedDepositAmount)}`],
          ['Chỉ số điện đầu kỳ → ngày hủy', `${settlement.electricity.startReading} → ${settlement.electricity.endReading} kWh`],
          ['Tiền điện chốt khi hủy', money(settlement.electricity.amount)],
        ]} />
        {settlement.invoices.map((invoice) => <p key={invoice.invoiceId} className="text-sm">
          Kỳ {invoice.period} · Tổng {money(invoice.total)} · Đã trả {money(invoice.paid)} · Còn phải trả {money(invoice.outstanding)}
          {invoice.overpaid > 0 && ` · Trả dư ${money(invoice.overpaid)}`}
        </p>)}
      </Panel>}
    </QueryState>
  )
}

function ContractTerminationDialog({ contractId, close }: { contractId: string; close: () => void }) {
  const queryClient = useQueryClient()
  const suggested = useQuery({
    queryKey: terminationDetailsKey(contractId),
    queryFn: () => contractService.terminationDetails(contractId),
    staleTime: 0,
  })
  const [date, setDate] = useState<string>()
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState('')
  const [startReading, setStartReading] = useState('')
  const [endReading, setEndReading] = useState('')
  const availableFrom = date ?? suggested.data?.availableFrom ?? ''
  const tomorrow = vnDateKey(new Date(Date.now() + 86_400_000).toISOString())
  const validReading = /^\d{1,12}(?:\.\d{1,3})?$/
  const valid = confirmation === 'Xac Nhan' && Boolean(reason.trim()) && availableFrom >= tomorrow
    && validReading.test(endReading) && (!startReading || validReading.test(startReading))
    && (!startReading || Number(endReading) >= Number(startReading))
  const terminate = useMutation({
    mutationFn: () => contractService.terminate(contractId, {
      confirmation, reason: reason.trim(), availableFrom,
      electricityStartReading: startReading || undefined, electricityEndReading: endReading,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries()
      close()
    },
  })
  return (
    <Modal title="Hủy hợp đồng trước hạn" open onOpenChange={(open) => !open && !terminate.isPending && close()}>
      <form className="grid gap-4" onSubmit={(event) => {
        event.preventDefault()
        if (valid && !terminate.isPending) terminate.mutate()
      }}>
        <p className="text-sm">Bạn có chắc chắn muốn hủy hợp đồng? Người thuê mất cọc, trả tiền thuê đến hết hôm nay, đủ phí dịch vụ tháng này và tiền điện theo chỉ số chốt khi hủy. Các hóa đơn còn nợ vẫn phải thanh toán.</p>
        <QueryState pending={suggested.isPending} error={suggested.error} retry={suggested.refetch}>
          <label className="grid gap-1 text-sm">Ngày cho thuê lại
            <input className="input" type="date" min={tomorrow} required value={availableFrom} onChange={(event) => setDate(event.target.value)} />
            <span className="text-muted-foreground">Kiểm tra lại ngày nhận khách trước khi xác nhận.</span>
          </label>
        </QueryState>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Chỉ số điện đầu kỳ (kWh)
            <input className="input" type="number" min="0" step="0.001" value={startReading} onChange={(event) => setStartReading(event.target.value)} />
            <span className="text-muted-foreground">Chỉ nhập nếu hệ thống chưa có.</span>
          </label>
          <label className="grid content-start gap-1 text-sm">Chỉ số điện ngày hủy (kWh)
            <input className="input" type="number" min="0" step="0.001" required value={endReading} onChange={(event) => setEndReading(event.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-sm">Lý do hủy
          <textarea className="input min-h-16" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Nhập chính xác <span className="font-semibold">Xac Nhan</span>
          <input className="input" required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <InlineError error={terminate.error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={terminate.isPending} onClick={close}>Quay lại</Button>
          <Button type="submit" loading={terminate.isPending} disabled={!valid}>Xác nhận</Button>
        </div>
      </form>
    </Modal>
  )
}

export function ManagerContractDetail() {
  const { contractId = '' } = useParams(),
    query = useManagerQuery(
      'contract',
      (b) => managerApi.get(b, 'contracts', contractId),
      [contractId],
      true,
    ),
    [action, setAction] = useState(''),
    [evidenceNote, setEvidenceNote] = useState(''),
    mutation = useManagerAction(() => setAction(''))
  const sourceBooking = useQuery({
    queryKey: ['contract-booking', query.data?.sourceBookingId],
    queryFn: () => bookingService.get(query.data!.sourceBookingId!),
    enabled: Boolean(query.data?.sourceBookingId && !query.data?.startDate),
    retry: false,
  })
  // Hợp đồng chốt ngày bắt đầu từ booking gốc; dùng cho cả hiển thị nháp lẫn min ngày tính tiền kỳ đầu.
  const bookingStartDate = bookingMoveInDate(sourceBooking.data)
  const expectedStartDate = query.data?.startDate || bookingStartDate || null
  // Ngày tính tiền kỳ đầu gợi ý = mùng 1 đầu tiên không trước ngày hiệu lực; input chỉ đọc.
  // Booking cũ chưa chốt ngày dọn vào thì backend lùi 1 ngày sau evidence, helper xử lý cùng quy tắc.
  const firstBillingStartDate = query.data?.evidenceSubmittedAt && (expectedStartDate || sourceBooking.isSuccess)
    ? suggestedFirstBillingStartDate(query.data.evidenceSubmittedAt, undefined, expectedStartDate)
    : ''
  const signedContractUrl = [query.data?.signedEvidenceUrl, query.data?.signedFileUrl]
    .find((url) => url && /^https?:\/\//i.test(url))
  const billingDateMinimum = firstBillingStartDate
  const validFirstBillingStartDate = Boolean(
    firstBillingStartDate && firstBillingStartDate >= billingDateMinimum && firstBillingStartDate.endsWith('-01'),
  )
  return (
    <ManagerPage
      title="Hồ sơ hợp đồng"
      actions={<ManagerLink to="/manager/contracts">Danh sách hợp đồng</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold">{query.data.code ?? 'Chưa có mã hợp đồng'}</h2>
                <ManagerStatus value={query.data.status} />
                {query.data.expiringSoon && <ExpiringSoonBadge />}
              </div>
              <Facts
                items={[
                  ['Địa chỉ thuê', query.data.roomAddress || '—'],
                  ['Phòng / chỗ ở', query.data.roomName || '—'],
                  [
                    'Thời hạn',
                    query.data.startDate && query.data.endDate
                      ? `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`
                      : query.data.status !== 'DRAFT'
                        ? '—'
                        : expectedStartDate
                          ? `Dự kiến từ ${dateOnly(expectedStartDate)}${query.data.termMonths ? ` → ${dateOnly(addMonths(expectedStartDate, query.data.termMonths))}` : ''} — chưa duyệt evidence`
                          : 'Chưa duyệt evidence',
                  ],
                ]}
              />
              {query.data.terms && <p className="mt-6 whitespace-pre-wrap text-sm leading-7">{query.data.terms}</p>}
              {query.data.generatedPdf && (
                <div className="mt-4">
                  <ContractPdfDownload
                    key={contractId}
                    id={contractId}
                    ready={Boolean(query.data.contractUrl)}
                    waitingForTerm={!query.data.termMonths}
                    canManage
                    onChanged={query.refetch}
                  />
                </div>
              )}
              {signedContractUrl && (
                <div className="mt-4">
                  <ContractEvidenceLink key={signedContractUrl} contractId={contractId}
                    evidenceUrl={query.data.signedEvidenceUrl} legacyUrl={query.data.signedFileUrl} label="Mở hợp đồng đã ký" />
                </div>
              )}
              {!!query.data.services?.length && <div className="mt-4 space-y-2 text-sm">
                <h3 className="font-semibold">Dịch vụ theo snapshot hợp đồng</h3>
                {query.data.services.map((service: { serviceId: string; name: string; unit: string; unitPrice: number; mandatory: boolean; selected: boolean; quantity?: number | null }) =>
                  <p key={service.serviceId}>{service.name} · {service.quantity ?? 'Theo chỉ số'} {service.unit} × {service.unitPrice.toLocaleString('vi-VN')} đ · {service.mandatory ? 'Bắt buộc' : 'Tùy chọn'}</p>)}
              </div>}
              {query.data.status === 'DRAFT' && query.data.evidenceSubmittedAt && <div className="mt-5 grid gap-4 rounded-xl border p-4">
                <h3 className="font-semibold">Duyệt evidence đã ký</h3>
                <label className="grid gap-1 text-sm">Ngày bắt đầu tính tiền kỳ đầu<input className="input disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground" type="date" required min={billingDateMinimum} value={firstBillingStartDate} disabled /></label>
                <label className="grid gap-1 text-sm">Lý do nếu yêu cầu gửi lại<textarea className="input min-h-20" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} /></label>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={!validFirstBillingStartDate} loading={mutation.isPending} onClick={() => mutation.mutate({ resource: 'contracts', id: contractId, action: 'review-evidence', value: { approved: true, firstBillingStartDate } })}>Duyệt và kích hoạt</Button>
                  <Button variant="outline" disabled={!evidenceNote.trim()} loading={mutation.isPending} onClick={() => mutation.mutate({ resource: 'contracts', id: contractId, action: 'review-evidence', value: { approved: false, note: evidenceNote.trim() } })}>Yêu cầu gửi lại</Button>
                </div>
              </div>}
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-4">
                <ManagerLink to={`/manager/contracts/${contractId}/tenants`}>
                  Người ký và chỗ thuê
                </ManagerLink>
                {query.data.renewedToContractId && (
                  <ManagerLink to={`/manager/contracts/${query.data.renewedToContractId}`}>
                    Hợp đồng gia hạn
                  </ManagerLink>
                )}
                {query.data.status === 'DRAFT' && !query.data.sourceBookingId && (
                  <>
                    <Button onClick={() => setAction('check-in')}>Ghi nhận bàn giao và ký giấy</Button>
                  </>
                )}
                {query.data.status === 'ACTIVE' && !query.data.renewedToContractId && (
                  <>
                    <Button onClick={() => setAction('renew')}>Gia hạn</Button>
                    <Button variant="outline" onClick={() => setAction('terminate')}>Hủy hợp đồng</Button>
                  </>
                )}
              </div>
            </Panel>
            {query.data.status === 'DRAFT' && <Notice>
              Hợp đồng chỉ được kích hoạt sau khi manager duyệt evidence; các slot và snapshot dịch vụ được lưu trên cùng một hợp đồng.
            </Notice>}
            {query.data.status === 'CANCELLED' && <ContractTerminationSummary contractId={contractId} />}
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử hợp đồng</h2>
              {query.data.history.length ? (
                <History items={query.data.history.map((h) => ({ ...h, note: `${h.actor}: ${h.note}` }))} />
              ) : <p className="text-sm text-muted-foreground">Chưa có lịch sử hợp đồng.</p>}
            </Panel>
          </>
        )}
      </QueryState>
      {action === 'terminate' ? <ContractTerminationDialog contractId={contractId} close={() => setAction('')} />
        : action === 'renew' ? <Modal title="Gia hạn hợp đồng" open onOpenChange={(open) => !open && setAction('')}>
        <ManagerForm
          schema={z.object({ termMonths: z.enum(['3', '6', '8', '12']) })}
          defaults={{ termMonths: '3' }}
          fields={[{
            name: 'termMonths', label: 'Số tháng gia hạn', kind: 'select',
            options: [{ value: '3', label: '3 tháng' }, { value: '6', label: '6 tháng' }, { value: '8', label: '8 tháng' }, { value: '12', label: '12 tháng' }],
          }]}
          pending={mutation.isPending}
          error={mutation.error}
          submitLabel="Xác nhận gia hạn"
          onSubmit={(value) => mutation.mutate({ resource: 'contracts', id: contractId, action: 'renew', value: { termMonths: Number(value.termMonths) } })}
        />
      </Modal> : action === 'check-in' ? <Modal title="Bàn giao và lưu hợp đồng đã ký" open onOpenChange={(open) => !open && setAction('')}>
        <ManagerForm
          schema={z.object({ signedFileUrl: z.string().url() })}
          defaults={{ signedFileUrl: '' }}
          fields={[{ name: 'signedFileUrl', label: 'URL bản hợp đồng giấy đã ký' }]}
          pending={mutation.isPending}
          error={mutation.error}
          submitLabel="Xác nhận bàn giao"
          onSubmit={(value) => mutation.mutate({ resource: 'contracts', id: contractId, action: 'check-in', value })}
        />
      </Modal> : <ActionDialog
        title="Xác nhận thay đổi trạng thái hợp đồng"
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({ resource: 'contracts', id: contractId, action, value })
        }
      />}
    </ManagerPage>
  )
}
