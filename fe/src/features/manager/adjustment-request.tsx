import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Modal, Notice } from '@/components/common/page'
import { proposalInputSchema } from '@/interfaces/owner'
import { ownerApi } from '@/services/owner'
import { queryClient } from '@/services/query-client'
import { useManager } from './context'
import { ImagePicker, ManagerForm } from './components'
export function AdjustmentRequest({ invoiceId, total }: { invoiceId: string; total: number }) {
  const { branch } = useManager(),
    [open, setOpen] = useState(false),
    [evidence, setEvidence] = useState<string[]>([]),
    mutation = useMutation({
      mutationFn: (value: unknown) => ownerApi.requestAdjustment(branch.id, value),
      onSuccess: () => {
        void queryClient.invalidateQueries()
      },
    })
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          mutation.reset()
          setOpen(true)
        }}
      >
        Yêu cầu điều chỉnh
      </Button>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) setOpen(v)
        }}
        title="Đề xuất điều chỉnh hóa đơn"
      >
        {mutation.isSuccess ? (
          <Notice tone="success">
            Đã gửi yêu cầu. Hóa đơn gốc giữ nguyên.
            <Link className="ml-1 underline" to="/owner/approvals/invoices">
              Hàng chờ chủ trọ
            </Link>
          </Notice>
        ) : (
          <>
            <Notice>
              Đề xuất cần được chủ trọ duyệt. Quyết định không tự thay đổi chứng từ hoặc thanh toán.
            </Notice>
            <div className="mt-5">
              <ManagerForm
                schema={proposalInputSchema.omit({ invoiceId: true, evidence: true })}
                defaults={{ proposedTotal: total, reason: '' }}
                fields={[
                  {
                    name: 'proposedTotal',
                    label: 'Tổng nghĩa vụ đề xuất (VND)',
                    kind: 'number',
                    step: 1,
                  },
                  { name: 'reason', label: 'Lý do điều chỉnh', kind: 'textarea' },
                ]}
                pending={mutation.isPending}
                error={mutation.error}
                submitLabel="Gửi yêu cầu duyệt"
                onSubmit={(v) => mutation.mutate({ ...v, invoiceId, evidence })}
              >
                <ImagePicker
                  value={evidence}
                  onChange={setEvidence}
                  disabled={mutation.isPending}
                />
              </ManagerForm>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
