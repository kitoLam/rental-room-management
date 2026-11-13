import { Notice, Panel, QueryState } from '@/components/common/page'
import { addMonths, dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import type { TenantContract, Tenancy } from '@/interfaces/tenant'
import { ExternalLink } from 'lucide-react'
import { useParams } from 'react-router'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { EmptyRows, Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { useTenant, useTenantQuery } from './context'
import { PrepaidPanel } from './prepaid-panel'
import { catalogService, bookingService, contractService, roomSlotService } from '@/services/guest-user'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/common/page'

export function ContractDetailPage({ terms = false }: { terms?: boolean }) {
  const { contractId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery<TenantContract | Tenancy>(
      'contract',
      (id) => tenantApi.contract(id, contractId),
      [contractId],
    ),
    payments = useTenantQuery('payments', tenantApi.payments),
    contract = query.data && 'contractNumber' in query.data ? query.data : null
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [termMonths, setTermMonths] = useState('3')
  const roomQuery = useQuery({
    queryKey: ['contract-room', contract?.roomId],
    queryFn: () => catalogService.room(contract!.roomId),
    enabled: Boolean(contract?.roomId && !terms),
    retry: false,
  })
  const slotsQuery = useQuery({
    queryKey: ['contract-room-slots', contract?.roomId],
    queryFn: async () => (await roomSlotService.list(contract!.roomId)).content,
    enabled: Boolean(contract?.roomId && contract.roomSlotIds?.length && !terms),
    retry: false,
  })
  const submitEvidence = useMutation({
    mutationFn: () => contractService.submitEvidence(contract!.id, {
      evidenceUrl: evidenceUrl.trim(),
      termMonths: Number(termMonths),
    }),
    onSuccess: async () => {
      setEvidenceUrl('')
      await query.refetch()
    },
  })
  const prepaid = (payments.data || []).filter((p) => p.status === 'VERIFIED' && !p.invoiceId)
  const tenancyMatchesContract = Boolean(contract && contract.id === t.contractId)
  const slotCodes = (contract?.roomSlotIds || []).map((id) =>
    slotsQuery.data?.find((slot) => slot.id === id)?.slotCode,
  ).filter((code): code is string => Boolean(code))
  const roomName = roomQuery.data?.title || contract?.roomAddress?.split(' · ').at(-1) || 'Phòng thuê'
  // Hợp đồng nháp lấy ngày bắt đầu thuê từ booking gốc (nguồn chốt lúc đặt cọc).
  const sourceBooking = useQuery({
    queryKey: ['contract-booking', contract?.bookingId],
    queryFn: () => bookingService.get(contract!.bookingId!),
    enabled: Boolean(contract?.bookingId && !contract?.startDate && !terms),
    retry: false,
  })
  const expectedStartDate = contract?.startDate || sourceBooking.data?.startDate || null
  const placeName = slotCodes.length
    ? `${roomName} · ${slotCodes.join(', ')}`
    : contract?.roomSlotIds?.length
      ? `${roomName} · ${contract.roomSlotIds.length} slot`
      : roomName
  return (
    <TenantPage
      title={terms ? 'Điều khoản cá nhân' : 'Chi tiết hợp đồng'}
      actions={<TenantLink to="/tenant/contracts">Danh sách hợp đồng</TenantLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{contract?.contractNumber || t.code}</h2>
                <TenantStatus value={terms ? t.status : contract?.status || t.contractStatus} />
              </div>
              <Facts
                items={
                  terms
                    ? [
                        ['Quan hệ thuê', t.id],
                        ['Chỗ ở', `${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`],
                        ['Tiền thuê thỏa thuận / tháng', formatVnd(t.monthlyRent)],
                        [
                          'Kỳ đầu / kỳ cuối',
                          `${formatVnd(t.firstMonthRent)} / ${formatVnd(t.lastMonthRent)}`,
                        ],
                        ['Trả trước kỳ đầu yêu cầu', formatVnd(t.prepaidFirstRequired)],
                        ['Trả trước kỳ cuối yêu cầu', formatVnd(t.prepaidLastRequired)],
                        ['Thời hạn cá nhân', `${dateOnly(t.startDate)} – ${dateOnly(t.endDate)}`],
                        [
                          'Ngày rời đi thực tế',
                          t.actualLeaveDate ? dateOnly(t.actualLeaveDate) : 'Chưa có',
                        ],
                      ]
                    : [
                        [
                          'Thời hạn',
                          contract?.startDate && contract.endDate
                            ? `${dateOnly(contract.startDate)} – ${dateOnly(contract.endDate)} (không gồm ngày kết thúc)`
                            : expectedStartDate
                              ? `Dự kiến từ ${dateOnly(expectedStartDate)}${contract?.termMonths ? ` · ${contract.termMonths} tháng` : ''} — chờ manager duyệt`
                              : 'Manager chưa duyệt thời hạn hợp đồng',
                        ],
                        ...(tenancyMatchesContract
                          ? [
                              ['Vai trò của bạn', t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'] as [string, string],
                              ['Trạng thái quan hệ cá nhân', <TenantStatus value={t.status} />] as [string, React.ReactNode],
                            ]
                          : []),
                      ]
                }
              />
              <p className="mt-6 border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
                {terms ? t.terms : contract?.terms || (tenancyMatchesContract ? t.sharedTerms : '')}
              </p>
              {!terms && contract && (
                <>
                  <h3 className="mt-6 font-bold">Thông tin trên hợp đồng</h3>
                  <Facts
                    items={[
                      ['Địa chỉ thuê', contract.roomAddress || t.branchName],
                      ['Phòng / chỗ ở', placeName],
                      ['Giá thuê / tháng', contract.rentPrice == null ? '—' : formatVnd(contract.rentPrice)],
                      ['Tiền cọc hợp đồng', contract.contractDepositAmount == null ? '—' : formatVnd(contract.contractDepositAmount)],
                    ]}
                  />
                  {contract.services?.length ? (
                    <div className="mt-5 space-y-2">
                      <h3 className="font-bold">Dịch vụ theo hợp đồng</h3>
                      {contract.services.map((service) => (
                        <p key={service.serviceId} className="text-sm">
                          {service.name} · {formatVnd(service.unitPrice)}/{service.unit} ·{' '}
                          {service.mandatory ? 'Bắt buộc' : 'Tùy chọn'} ·{' '}
                          {service.selected ? 'Đã chọn' : 'Chưa chọn'}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
              {!terms && tenancyMatchesContract && (
                <div className="mt-4">
                  <TenantLink to={`/tenant/contracts/${t.contractId}/my-terms`}>
                    Điều khoản & nghĩa vụ của tôi
                  </TenantLink>
                </div>
              )}
            </Panel>
            {terms ? (
              <>
                <PrepaidPanel />
                <Panel>
                  <h2 className="mb-5 font-bold">Tiền thuê trả trước</h2>
                  <QueryState
                    pending={payments.isPending}
                    error={payments.error}
                    retry={payments.refetch}
                  >
                    {prepaid.length ? (
                      prepaid.map((p) => (
                        <div key={p.id} className="grid gap-4">
                          <Facts
                            items={[
                              ['Đã xác minh kỳ đầu', formatVnd(p.prepaidFirstAmount)],
                              ['Đã xác minh kỳ cuối', formatVnd(p.prepaidLastAmount)],
                              ['Đã áp dụng kỳ đầu', formatVnd(p.prepaidFirstApplied)],
                              ['Đã áp dụng kỳ cuối', formatVnd(p.prepaidLastApplied)],
                            ]}
                          />
                          <p className="break-all text-xs text-muted-foreground">
                            Nguồn tiền: {p.reference}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyRows>Chưa có khoản trả trước đã xác minh.</EmptyRows>
                    )}
                  </QueryState>
                </Panel>
                <Notice>
                  Trả trước được áp dụng từ nguồn tiền đã nhận, không tạo thêm giao dịch thu tiền.
                  Số tiền theo hồ sơ đã duyệt; chính sách tháng lẻ và hoàn trả chưa được chốt.
                </Notice>
                <TenantLink to="/tenant/invoices">Hóa đơn của quan hệ thuê này</TenantLink>
              </>
            ) : (
              <Panel>
                <h2 className="mb-3 font-bold">Văn bản hợp đồng</h2>
                <a
                  href={contract?.contractUrl || 'https://www.youtube.com/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                >
                  Tải mẫu hợp đồng
                  <ExternalLink size={16} />
                </a>
                {contract?.signedFileUrl ? (
                  <a
                    href={contract.signedFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                  >
                    Mở bản hợp đồng đã ký
                    <ExternalLink size={16} />
                  </a>
                ) : t.document ? (
                  <a
                    href={t.document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                  >
                    {t.document.name}
                    <ExternalLink size={16} />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {contract?.status === 'DRAFT'
                      ? 'Hợp đồng đang ở trạng thái nháp; hãy tải mẫu, ký và gửi bằng chứng để quản lý duyệt.'
                      : 'Chưa có văn bản được cung cấp. Liên hệ quản lý để nhận bản hợp đồng.'}
                  </p>
                )}
                {contract?.evidenceDeadline && !contract.evidenceSubmittedAt && <div className="mt-4"><Notice>Hạn nộp bằng chứng: {new Date(contract.evidenceDeadline).toLocaleString('vi-VN')}</Notice></div>}
                {!!contract?.evidenceHistory?.length && <section className="mt-5 rounded-xl border p-4">
                  <h3 className="mb-4 font-semibold">Lịch sử xử lý bằng chứng</h3>
                  <ol className="space-y-4 border-l border-border pl-4">
                    {contract.evidenceHistory.map((entry, index) => {
                      const labels = {
                        SUBMITTED: 'Bạn đã gửi bằng chứng hợp đồng',
                        APPROVED: 'Manager/admin đã duyệt và kích hoạt hợp đồng',
                        RESUBMISSION_REQUESTED: 'Manager/admin yêu cầu gửi lại bằng chứng',
                        EXPIRED: 'Hồ sơ bằng chứng đã hết hạn',
                      }
                      return <li key={`${entry.action}-${entry.at}-${index}`} className="relative">
                        <p className="font-medium">{labels[entry.action]}</p>
                        {entry.at && <p className="mt-1 text-xs text-muted-foreground">{dateTime(entry.at)}</p>}
                        {entry.note && <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>}
                      </li>
                    })}
                  </ol>
                </section>}
                {contract?.bookingId && contract.status === 'DRAFT' && !contract.evidenceSubmittedAt && <form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); submitEvidence.mutate() }}>
                  <label className="grid gap-1 text-sm">Link ảnh/PDF hợp đồng đã ký
                    <input className="input" type="url" autoComplete="off" placeholder="https://..." required value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-sm">Thời hạn hợp đồng
                    <select className="input" value={termMonths} onChange={(event) => setTermMonths(event.target.value)}>
                      {[3, 6, 8, 12].map((months) => <option key={months} value={months}>{months} tháng</option>)}
                    </select>
                  </label>
                  {expectedStartDate && <p className="text-xs text-muted-foreground">Hiệu lực dự kiến: {dateOnly(expectedStartDate)} → {dateOnly(addMonths(expectedStartDate, Number(termMonths)))}</p>}
                  <InlineError error={submitEvidence.error} />
                  <Button loading={submitEvidence.isPending}>Gửi bằng chứng hợp đồng</Button>
                </form>}
              </Panel>
            )}
          </>
        )}
      </QueryState>
    </TenantPage>
  )
}
