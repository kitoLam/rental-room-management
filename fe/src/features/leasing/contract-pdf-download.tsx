import { InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { addMonths, dateOnly } from '@/lib/activity'
import { contractService } from '@/services/guest-user'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export function ContractPdfDownload({
  id, rentalStartDate, ready, canChooseTerm = false, waitingForTerm = false, canManage = false, onChanged,
}: {
  id: string
  rentalStartDate?: string | null
  ready: boolean
  canChooseTerm?: boolean
  waitingForTerm?: boolean
  canManage?: boolean
  onChanged: () => unknown
}) {
  const [termMonths, setTermMonths] = useState('3')
  const chooseTerm = useMutation({
    mutationFn: () => contractService.chooseTerm(id, Number(termMonths)),
    onSuccess: async () => { await onChanged() },
  })
  const download = useMutation({
    mutationFn: () => contractService.downloadPdf(id, canManage ? 'manager' : 'leasing'),
    onSuccess: (url) => { window.location.assign(url) },
  })
  const retry = useMutation({
    mutationFn: () => contractService.retryPdf(id, canManage ? 'manager' : 'leasing'),
    onSuccess: async () => { await onChanged() },
  })
  useEffect(() => {
    if (canChooseTerm || waitingForTerm || ready) return
    const timer = window.setInterval(() => { void onChanged() }, 5_000)
    return () => window.clearInterval(timer)
  }, [canChooseTerm, waitingForTerm, ready, onChanged])

  return (
    <div className="grid justify-items-start gap-2">
      {canChooseTerm && (
        <>
          <label className="grid gap-1 text-sm">Thời hạn hợp đồng
            <select className="input" value={termMonths} onChange={(event) => setTermMonths(event.target.value)}>
              {[3, 6, 8, 12].map((months) => <option key={months} value={months}>{months} tháng</option>)}
            </select>
          </label>
          {rentalStartDate && <p className="text-xs text-muted-foreground">
            Hiệu lực dự kiến: {dateOnly(rentalStartDate)} → {dateOnly(addMonths(rentalStartDate, Number(termMonths)))}
          </p>}
          <Button type="button" loading={chooseTerm.isPending} onClick={() => chooseTerm.mutate()}>Chốt kỳ hạn</Button>
        </>
      )}
      <Button type="button" variant="outline" disabled={canChooseTerm || waitingForTerm || !ready}
        loading={download.isPending} onClick={() => download.mutate()}>Tải hợp đồng PDF</Button>
      {(waitingForTerm || !ready) && (
        <p role="status" className="text-sm text-muted-foreground">
          {waitingForTerm
            ? canChooseTerm ? 'Chốt kỳ hạn để tạo PDF có thời hạn thuê.' : 'Hợp đồng chưa có kỳ hạn.'
            : retry.data === 'QUEUED' ? 'Đã gửi yêu cầu tạo lại PDF.'
              : retry.data === 'PROCESSING' ? 'Yêu cầu tạo PDF đang được xử lý.'
                : 'PDF đang được chuẩn bị.'}
        </p>
      )}
      {!waitingForTerm && !ready && <Button type="button" variant="outline" loading={retry.isPending}
        onClick={() => retry.mutate()}>Thử tạo lại PDF</Button>}
      <InlineError error={chooseTerm.error || download.error || retry.error} />
    </div>
  )
}
