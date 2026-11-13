import { useId } from 'react'
import { Upload } from 'lucide-react'
import { InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { contractService } from '@/services/guest-user'
import { uploadToCloudinary } from '@/services/upload'

const fileTypes = ['application/pdf', 'image/jpeg', 'image/png']

export async function submitContractEvidence(id: string, file: File, termMonths: number) {
  if (!fileTypes.includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Chọn file PDF, JPG hoặc PNG có dung lượng tối đa 10 MB.')
  }
  const evidenceUrl = await uploadToCloudinary(file, 'contract-evidence')
  return contractService.submitEvidence(id, { evidenceUrl, termMonths })
}

export function ContractEvidenceFile({ file, onSelect, pending, error }: {
  file: File | null
  onSelect: (file: File | null) => void
  pending: boolean
  error: unknown
}) {
  const inputId = useId()
  return (
    <>
      <div className="grid gap-2">
        <p id={`${inputId}-help`} className="text-sm text-muted-foreground">
          Chọn bản scan hoặc ảnh rõ nét của hợp đồng đã ký. Hỗ trợ PDF, JPG và PNG, tối đa 10 MB.
        </p>
        <label className="relative inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-primary">
          <Upload size={16} aria-hidden="true" />
          Chọn file hợp đồng
          <input id={inputId} className="sr-only" type="file" accept={fileTypes.join(',')}
            aria-describedby={`${inputId}-help`} disabled={pending}
            onClick={(event) => { event.currentTarget.value = '' }}
            onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)} />
        </label>
        {file && <p className="break-all text-sm" role="status">{file.name}</p>}
      </div>
      <InlineError error={error} />
      <Button type="submit" disabled={!file} loading={pending}>
        <Upload size={16} aria-hidden="true" /> Nộp file hợp đồng
      </Button>
    </>
  )
}
