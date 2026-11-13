import { InlineError, Notice, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { addMonths, dateOnly, dateTime, firstBillingStartDate as suggestedFirstBillingStartDate } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { contractService } from '@/services/guest-user'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { contractStage } from './contract-stage'
import { ContractPdfDownload } from './contract-pdf-download'
import { ContractEvidenceFile, submitContractEvidence } from './contract-evidence-file'

/**
 * One slot contract: tenant downloads the template, submits the signed copy;
 * staff review it. Each contract of a booking goes through this on its own.
 */
export function ContractEvidencePanel({
  contractId,
  canManage,
  onChanged,
  index,
  moveInDate,
}: {
  contractId: string
  canManage: boolean
  onChanged?: () => unknown
  index?: number
  /** Booking move-in date; first billing month is not before it. */
  moveInDate?: string | null
  /** Booking rental start, for the "expected term" preview while choosing the term. */
}) {
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [termMonths, setTermMonths] = useState('3')
  const [managerNote, setManagerNote] = useState('')
  const contractQuery = useQuery({
    queryKey: ['booking-contract', contractId],
    queryFn: () => contractService.get(contractId),
  })
  const refresh = async () => {
    await contractQuery.refetch()
    await onChanged?.()
  }
  const submitEvidence = useMutation({
    mutationFn: (file: File) => submitContractEvidence(contractId, file,
      data?.generatedPdf ? data.termMonths! : Number(termMonths)),
    onSuccess: async () => {
      setEvidenceFile(null)
      await refresh()
    },
  })
  const data = contractQuery.data
  // Billing starts on the 1st of the month after the contract takes effect (field is read-only).
  const billingDateMinimum = data?.evidenceSubmittedAt
    ? suggestedFirstBillingStartDate(data.evidenceSubmittedAt, undefined, data.startDate || moveInDate)
    : ''
  const firstBillingStartDate = billingDateMinimum
  const validFirstBillingStartDate = Boolean(firstBillingStartDate && firstBillingStartDate.endsWith('-01'))
  const reviewEvidence = useMutation({
    mutationFn: (approved: boolean) =>
      contractService.reviewEvidence(contractId, {
        approved,
        ...(managerNote.trim() ? { note: managerNote.trim() } : {}),
        ...(firstBillingStartDate ? { firstBillingStartDate } : {}),
      }),
    onSuccess: refresh,
  })
  const stage = data ? contractStage(data) : null
  // Expected contract term: from the rental start date for the chosen number of months.
  const rentalStartDate = data?.startDate || moveInDate
  const termPreview = rentalStartDate
    ? `${dateOnly(rentalStartDate)} → ${dateOnly(addMonths(rentalStartDate, data?.generatedPdf ? data.termMonths ?? Number(termMonths) : Number(termMonths)))}`
    : null
  const pendingEvidence = !canManage && data?.status === 'DRAFT' && !data.evidenceSubmittedAt

  return (
    <Panel className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          Hợp đồng{index !== undefined ? ` #${index + 1}` : ''} {data ? `· ${data.contractNumber}` : ''}
        </h2>
        {stage && <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>}
      </div>
      <QueryState pending={contractQuery.isPending} error={contractQuery.error} retry={contractQuery.refetch}>
        {data && (
          <div className="mt-4 grid gap-5">
            {data.roomAddress && <p className="text-sm text-muted-foreground">{data.roomAddress}</p>}
            {data.generatedPdf ? (
              <ContractPdfDownload
                key={contractId}
                id={contractId}
                rentalStartDate={rentalStartDate}
                ready={Boolean(data.contractUrl)}
                canChooseTerm={Boolean(pendingEvidence && data.evidenceDeadline && !data.termMonths)}
                waitingForTerm={!data.termMonths}
                canManage={canManage}
                onChanged={refresh}
              />
            ) : data.contractUrl && (
              <a className="text-sm text-primary underline" href={data.contractUrl} target="_blank" rel="noreferrer">
                Tải mẫu hợp đồng
              </a>
            )}
            {data.evidenceDeadline && <Notice>Hạn nộp bản ký: {dateTime(data.evidenceDeadline)}</Notice>}
            {data.evidenceNote && <Notice tone="warning">Quản lý yêu cầu gửi lại: {data.evidenceNote}</Notice>}
            {data.evidenceSubmittedAt && data.status === 'DRAFT' && (
              <Notice>Đã gửi bản ký lúc {dateTime(data.evidenceSubmittedAt)}; đang chờ quản lý duyệt.</Notice>
            )}
            {pendingEvidence && (!data.generatedPdf || (data.termMonths && data.contractUrl)) && (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (evidenceFile && !submitEvidence.isPending) submitEvidence.mutate(evidenceFile)
                }}
              >
                {!data.generatedPdf && <label className="grid gap-1 text-sm">
                  Thời hạn hợp đồng
                  <select className="input" value={termMonths} onChange={(event) => setTermMonths(event.target.value)}>
                    {[3, 6, 8, 12].map((months) => (
                      <option key={months} value={months}>
                        {months} tháng
                      </option>
                    ))}
                  </select>
                </label>}
                {termPreview && (
                  <p className="text-xs text-muted-foreground">Hiệu lực dự kiến: {termPreview} (bắt đầu từ ngày bắt đầu thuê)</p>
                )}
                <ContractEvidenceFile file={evidenceFile} pending={submitEvidence.isPending} error={submitEvidence.error}
                  onSelect={(file) => { setEvidenceFile(file); submitEvidence.reset() }} />
              </form>
            )}
            {canManage && data.status === 'DRAFT' && data.evidenceSubmittedAt && (
              <div className="grid gap-4">
                {data.signedEvidenceUrl && (
                  <a className="text-sm text-primary underline" href={data.signedEvidenceUrl} target="_blank" rel="noreferrer">
                    Xem bản ký đã gửi
                  </a>
                )}
                <label className="grid gap-1 text-sm">
                  Ngày bắt đầu kỳ tính tiền đầu tiên
                  <input
                    className="input disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                    type="date"
                    required
                    min={billingDateMinimum}
                    value={firstBillingStartDate}
                    disabled
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Ghi chú / lý do gửi lại
                  <textarea className="input min-h-20" value={managerNote} onChange={(event) => setManagerNote(event.target.value)} />
                </label>
                <InlineError error={reviewEvidence.error} />
                <div className="flex flex-wrap gap-3">
                  <Button disabled={!validFirstBillingStartDate} loading={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate(true)}>
                    Duyệt hợp đồng
                  </Button>
                  <Button variant="outline" loading={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate(false)}>
                    Yêu cầu gửi lại
                  </Button>
                </div>
              </div>
            )}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold">Giá thuê theo tháng</dt>
                <dd>{formatVnd(data.rentPrice)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Tiền cọc</dt>
                <dd>{formatVnd(data.contractDepositAmount)}</dd>
              </div>
              {data.startDate && data.endDate && (
                <div>
                  <dt className="font-semibold">Hiệu lực</dt>
                  <dd>
                    {data.startDate} → {data.endDate}
                  </dd>
                </div>
              )}
              {data.services.map((service) => (
                <div key={service.serviceId}>
                  <dt className="font-semibold">{service.name}</dt>
                  <dd>
                    {service.quantity ?? 1} {service.unit} · {formatVnd(service.unitPrice)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </QueryState>
    </Panel>
  )
}
