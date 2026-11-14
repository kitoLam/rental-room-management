import { useMutation } from '@tanstack/react-query'
import { InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { provider } from '@/services/config'
import { contractService } from '@/services/guest-user'

export function ContractEvidenceLink({ contractId, evidenceUrl, legacyUrl, label }: {
  contractId: string
  evidenceUrl?: string | null
  legacyUrl?: string | null
  label: string
}) {
  const url = [evidenceUrl, legacyUrl].find((value) => value && /^https?:\/\//i.test(value))
  const useSignedLink = provider('manager') === 'real' && Boolean(
    evidenceUrl && url === evidenceUrl && /^https:\/\/res\.cloudinary\.com\//i.test(evidenceUrl),
  )
  const open = useMutation({
    mutationFn: async () => {
      const tab = window.open('about:blank', '_blank')
      if (!tab) throw new Error('Trình duyệt đã chặn tab mới. Hãy cho phép mở tab rồi thử lại.')
      tab.opener = null
      try {
        const target = useSignedLink ? await contractService.downloadSignedEvidence(contractId) : url
        if (!target || !/^https?:\/\//i.test(target)) throw new Error('Đường dẫn bản ký không hợp lệ.')
        tab.location.replace(target)
      } catch (error) {
        tab.close()
        throw error
      }
    },
  })

  if (!url) return null

  return (
    <div className="grid min-w-0 justify-items-start gap-2">
      <Button type="button" variant="outline" loading={open.isPending} onClick={() => open.mutate()}>
        {label}
      </Button>
      <InlineError error={open.error} />
    </div>
  )
}
