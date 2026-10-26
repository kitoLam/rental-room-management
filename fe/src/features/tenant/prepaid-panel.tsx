import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Panel, Notice, QueryState, Modal, InlineError, Field } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { tenantApi } from '@/services/tenant'
import { provider } from '@/services/config'
import { queryClient } from '@/services/query-client'
import { formatVnd } from '@/lib/format'
import { useTenant, useTenantQuery } from './context'
import { TenantStatus } from './components'
export function PrepaidPanel() {
  const { tenancy: t } = useTenant(),
    user = useSession((s) => s.user!),
    payments = useTenantQuery('payments', tenantApi.payments, [], true),
    [bucket, setBucket] = useState<'FIRST_MONTH' | 'LAST_MONTH' | null>(null),
    [key, setKey] = useState(''),
    [payer, setPayer] = useState(user.fullName),
    [error, setError] = useState<Error | null>(null),
    mutation = useMutation({
      mutationFn: (value: unknown) => tenantApi.prepay(t.id, value),
      onSuccess: () => {
        setBucket(null)
        void queryClient.invalidateQueries()
      },
    })
  if (t.status !== 'DRAFT') return null
  const remaining = (first: boolean) =>
    Math.max(
      0,
      (first ? t.prepaidFirstRequired : t.prepaidLastRequired) -
        (payments.data || [])
          .filter((p) => !p.invoiceId && ['PENDING', 'VERIFIED', 'REVIEW'].includes(p.status))
          .reduce((sum, p) => sum + (first ? p.prepaidFirstAmount : p.prepaidLastAmount), 0),
    )
  return (
    <Panel>
      <h2 className="mb-4 font-bold">Hoàn tất nghĩa vụ trước kích hoạt</h2>
      <QueryState pending={payments.isPending} error={payments.error} retry={payments.refetch}>
        <div className="grid gap-4">
          {(['FIRST_MONTH', 'LAST_MONTH'] as const).map((b) => (
            <div
              key={b}
              className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-4"
            >
              <div>
                <p className="text-sm font-bold">
                  {b === 'FIRST_MONTH' ? 'Trả trước kỳ đầu' : 'Trả trước kỳ cuối'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Còn có thể thanh toán: {formatVnd(remaining(b === 'FIRST_MONTH'))}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={remaining(b === 'FIRST_MONTH') === 0 || provider('tenant') !== 'mock'}
                onClick={() => {
                  setBucket(b)
                  setKey(crypto.randomUUID())
                  setError(null)
                }}
              >
                Thanh toán mô phỏng
              </Button>
            </div>
          ))}
          {payments.data
            ?.filter((p) => !p.invoiceId)
            .map((p) => (
              <p key={p.id} className="flex flex-wrap justify-between gap-3 text-sm">
                <span>{formatVnd(p.amountReceived)}</span>
                <TenantStatus value={p.status} />
              </p>
            ))}
          <Notice>
            Không chuyển tiền thật. Nhà cung cấp sandbox tự xử lý giao dịch; quản lý kiểm tra điều
            kiện trước khi kích hoạt hợp đồng.
          </Notice>
        </div>
      </QueryState>
      <Modal
        title="Thanh toán trả trước mô phỏng"
        open={!!bucket}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setBucket(null)
        }}
      >
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (payer.trim().length < 2) {
              setError(new Error('Nhập tên người chuyển từ 2 ký tự.'))
              return
            }
            mutation.mutate({
              bucket,
              amount: remaining(bucket === 'FIRST_MONTH'),
              payerName: payer.trim(),
              idempotencyKey: key,
              outcome: 'success',
            })
          }}
        >
          <p className="text-xl font-bold">{formatVnd(remaining(bucket === 'FIRST_MONTH'))}</p>
          <Field id="prepaid-payer" label="Tên người chuyển">
            <input
              id="prepaid-payer"
              className="input"
              value={payer}
              maxLength={100}
              onChange={(e) => setPayer(e.target.value)}
            />
          </Field>
          <InlineError error={error || mutation.error} />
          <Button type="submit" loading={mutation.isPending}>
            Xác nhận giao dịch sandbox
          </Button>
        </form>
      </Modal>
    </Panel>
  )
}
