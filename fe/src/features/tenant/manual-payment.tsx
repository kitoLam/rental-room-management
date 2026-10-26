import { useRef, useState } from 'react'
import { z } from 'zod'
import type { Invoice } from '@/interfaces/tenant'
import { Button } from '@/components/ui/button'
import { Panel, Notice, Modal } from '@/components/common/page'
import { useSession } from '@/features/auth/session-store'
import { ImagePicker, ManagerForm } from '@/features/manager/components'
import { useTenant, useTenantMutation, isActive } from './context'
import { tenantApi } from '@/services/tenant'
export function ManualPayment({ invoice }: { invoice: Invoice }) {
  const { tenancy } = useTenant(),
    name = useSession((s) => s.user!.fullName),
    [open, setOpen] = useState(false),
    [evidence, setEvidence] = useState<string[]>([]),
    submission = useRef<{ signature: string; key: string } | null>(null),
    mutation = useTenantMutation((id, value: unknown) => tenantApi.manualPay(id, invoice.id, value))
  if (!invoice.manualQr || invoice.documentStatus !== 'ISSUED') return null
  return (
    <Panel>
      <h2 className="mb-4 font-bold">Chuyển khoản QR của chi nhánh</h2>
      <Notice>
        Demo không kết nối ngân hàng. Chỉ dùng chứng cứ giả lập; giao dịch chờ quản lý đối soát và
        chưa giảm dư nợ.
      </Notice>
      <img
        src={invoice.manualQr.qrUrl}
        alt="QR thủ công của chi nhánh"
        className="mx-auto my-5 max-h-60 max-w-full rounded-lg"
      />
      <p className="break-all text-sm font-bold">{invoice.manualQr.reference}</p>
      <Button
        className="mt-5"
        disabled={!isActive(tenancy) || invoice.availableToPay <= 0}
        onClick={() => {
          mutation.reset()
          setOpen(true)
        }}
      >
        Gửi chứng cứ chuyển khoản
      </Button>
      <Modal
        title="Chứng cứ chuyển khoản QR"
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) setOpen(v)
        }}
      >
        {mutation.isSuccess ? (
          <Notice tone="success">Đã ghi nhận giao dịch chờ đối soát.</Notice>
        ) : (
          <ManagerForm
            schema={z.object({
              amount: z.number().int().positive().max(invoice.availableToPay),
              payerName: z.string().trim().min(2).max(100),
              providerTransactionId: z.string().trim().min(5).max(100),
            })}
            defaults={{
              amount: invoice.availableToPay,
              payerName: name,
              providerTransactionId: '',
            }}
            fields={[
              { name: 'amount', label: 'Số tiền đã chuyển (VND)', kind: 'number', step: 1 },
              { name: 'payerName', label: 'Người chuyển tiền' },
              { name: 'providerTransactionId', label: 'Mã biên nhận giao dịch' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Gửi để đối soát"
            onSubmit={(v) => {
              const value = { ...v, evidence, reference: invoice.manualQr!.reference },
                signature = JSON.stringify(value)
              if (submission.current?.signature !== signature)
                submission.current = { signature, key: crypto.randomUUID() }
              mutation.mutate({ ...value, idempotencyKey: submission.current.key })
            }}
          >
            <ImagePicker value={evidence} onChange={setEvidence} disabled={mutation.isPending} />
            <p className="text-xs text-muted-foreground">Cần ít nhất một ảnh biên nhận.</p>
          </ManagerForm>
        )}
      </Modal>
    </Panel>
  )
}
