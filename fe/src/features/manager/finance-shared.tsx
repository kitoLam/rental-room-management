import { Field, InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { invoiceInputSchema, type InvoiceSources } from '@/interfaces/manager'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { ManagerForm, ManagerLink } from './components'
import { managerLink, useManager, useManagerAction, useManagerQuery } from './context'

type InvoiceInput = z.infer<typeof invoiceInputSchema>
export function InvoiceBuilder({
  tenantId,
  month,
  invoiceId,
  initial,
}: {
  tenantId: string
  month: string
  invoiceId?: string
  initial?: InvoiceInput
}) {
  const { branch } = useManager(),
    navigate = useNavigate(),
    sources = useManagerQuery(
      'invoice-sources',
      (b) => managerApi.sources(b, tenantId, month, invoiceId),
      [tenantId, month, invoiceId],
    ),
    [selected, setSelected] = useState<string[]>(
      initial?.sources.map((s) => `${s.type}:${s.id}`) || [],
    ),
    [prepaid, setPrepaid] = useState(
      initial?.prepaidSourcePaymentId
        ? `${initial.prepaidSourcePaymentId}:${initial.prepaidBucket}`
        : '',
    ),
    [preview, setPreview] = useState<InvoiceInput | null>(null),
    mutation = useManagerAction((result) =>
      navigate(managerLink(`/manager/invoices/${result?.id || invoiceId}`, branch.id)),
    )
  const total = (data: InvoiceInput, eligible: InvoiceSources) =>
    data.rentAmount +
    data.adjustment +
    eligible.sources
      .filter((s) => data.sources.some((v) => v.type === s.type && v.id === s.id))
      .reduce((sum, s) => sum + s.amount, 0)
  return (
    <QueryState pending={sources.isPending} error={sources.error} retry={sources.refetch}>
      {sources.data && (
        <Panel>
          <ManagerForm
            schema={invoiceInputSchema.omit({
              contractTenantId: true,
              billingMonth: true,
              sources: true,
              prepaidSourcePaymentId: true,
              prepaidBucket: true,
            })}
            defaults={
              initial
                ? { ...initial }
                : {
                    dueDate: sources.data.dueDate,
                    rentAmount: sources.data.rentAmount,
                    rentApprovalNote: sources.data.policyNote,
                    adjustment: 0,
                    adjustmentReason: '',
                    prepaidAmount: 0,
                  }
            }
            fields={[
              { name: 'dueDate', label: 'Hạn thanh toán', kind: 'date' },
              { name: 'rentAmount', label: 'Tiền thuê đã thỏa thuận (VND)', kind: 'number' },
              {
                name: 'rentApprovalNote',
                label: 'Căn cứ tiền thuê đã duyệt',
                kind: 'textarea',
                hint: 'Dùng số tiền đã được thỏa thuận; không tự chia giá theo ngày.',
              },
              { name: 'adjustment', label: 'Điều chỉnh trong nháp (VND)', kind: 'number' },
              { name: 'adjustmentReason', label: 'Lý do điều chỉnh', kind: 'textarea' },
              { name: 'prepaidAmount', label: 'Trả trước áp dụng (VND)', kind: 'number' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xem trước hóa đơn"
            onSubmit={(data) => {
              const [paymentId, bucket] = prepaid.split(':')
              setPreview({
                ...data,
                contractTenantId: tenantId,
                billingMonth: month,
                sources: sources
                  .data!.sources.filter((s) => selected.includes(`${s.type}:${s.id}`))
                  .map(({ type, id }) => ({ type, id })),
                prepaidSourcePaymentId: paymentId || null,
                prepaidBucket: bucket || 'FIRST_MONTH',
              } as InvoiceInput)
            }}
          >
            <Notice>{sources.data.policyNote}</Notice>
            <fieldset className="grid gap-3">
              <legend className="mb-3 text-sm font-bold">Nguồn phí đã chốt / được duyệt</legend>
              {sources.data.sources.length ? (
                sources.data.sources.map((s) => (
                  <div key={`${s.type}:${s.id}`}>
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        checked={selected.includes(`${s.type}:${s.id}`)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, `${s.type}:${s.id}`]
                              : selected.filter((v) => v !== `${s.type}:${s.id}`),
                          )
                        }
                      />
                      <span>
                        {s.label} · <strong>{formatVnd(s.amount)}</strong>
                      </span>
                    </label>
                    {s.sourceRoute && <ManagerLink to={s.sourceRoute}>Xem nguồn phí</ManagerLink>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Không có phí đủ điều kiện trong kỳ.</p>
              )}
            </fieldset>
            <Field id="invoice-prepaid-source" label="Nguồn trả trước đủ điều kiện">
              <select
                id="invoice-prepaid-source"
                className="input"
                value={prepaid}
                onChange={(e) => setPrepaid(e.target.value)}
              >
                <option value="">Không áp dụng</option>
                {sources.data.prepaid.map((p) => (
                  <option key={`${p.paymentId}:${p.bucket}`} value={`${p.paymentId}:${p.bucket}`}>
                    {p.label} · Tối đa {formatVnd(p.available)}
                  </option>
                ))}
              </select>
            </Field>
          </ManagerForm>
        </Panel>
      )}
      <Modal
        title="Kiểm tra hóa đơn trước khi lưu"
        open={!!preview}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setPreview(null)
        }}
      >
        {preview && sources.data && (
          <div className="grid gap-5">
            <Facts
              items={[
                ['Kỳ hóa đơn', preview.billingMonth.slice(0, 7)],
                ['Tổng nghĩa vụ', formatVnd(total(preview, sources.data))],
                ['Trả trước áp dụng', formatVnd(preview.prepaidAmount)],
                [
                  'Còn lại dự kiến',
                  formatVnd(Math.max(0, total(preview, sources.data) - preview.prepaidAmount)),
                ],
              ]}
            />
            <Notice>
              Đây là hóa đơn nháp. Phát hành tại màn hình chi tiết sau khi kiểm tra nguồn phí và
              đúng người chịu nghĩa vụ.
            </Notice>
            <InlineError error={mutation.error} />
            <Button
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  resource: 'invoices',
                  id: invoiceId,
                  value: preview,
                  method: invoiceId ? 'PATCH' : 'POST',
                })
              }
            >
              Lưu hóa đơn nháp
            </Button>
          </div>
        )}
      </Modal>
    </QueryState>
  )
}
