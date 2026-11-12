import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { InvoiceItemsTable, InvoiceStatusBadge, KindBadge } from '@/features/billing/invoice-parts'
import { formatVnd } from '@/lib/format'
import {
  billingApi,
  currentPeriod,
  dayLabel,
  periodLabel,
  type BillingContract,
  type BillingInvoice,
  type GenerateResult,
} from '@/services/billing'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FilePlus2, Send, Trash2, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManagerPage } from './components'

const BILLABLE_CONTRACT = ['ACTIVE', 'EXPIRED', 'TERMINATED']

const skipReason: Record<string, string> = {
  CONTRACT_NOT_ACTIVE: 'hợp đồng chưa hiệu lực',
  NOT_IN_PERIOD: 'chưa tới ngày tính tiền phòng trong tháng',
  ALREADY_ISSUED: 'đã phát hành',
  ALREADY_EXISTS: 'đã có hoá đơn',
  NO_ACCESS: 'không thuộc chi nhánh của bạn',
  SUPPLEMENTARY_DRAFT_PENDING: 'đang có hoá đơn bổ sung nháp',
}

/** Monthly billing board: which contract has which invoice in a month, create / issue invoices. */
export function ManagerBilling() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const [creating, setCreating] = useState<BillingContract | null>(null)
  const [viewing, setViewing] = useState<BillingInvoice | null>(null)
  const [summary, setSummary] = useState<GenerateResult | null>(null)

  const contracts = useQuery({ queryKey: ['billing', 'contracts'], queryFn: billingApi.contracts })
  const rooms = useQuery({ queryKey: ['billing', 'rooms'], queryFn: billingApi.rooms })
  const invoices = useQuery({
    queryKey: ['billing', 'month', period],
    queryFn: () => billingApi.invoicesOfMonth(period),
    enabled: /^\d{4}-\d{2}$/.test(period),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['billing'] })
  const issue = useMutation({ mutationFn: billingApi.issue, onSuccess: refresh })
  const remove = useMutation({ mutationFn: billingApi.removeDraft, onSuccess: refresh })
  const generate = useMutation({
    mutationFn: () => billingApi.generateMonth(period),
    onSuccess: (result) => {
      setSummary(result)
      void refresh()
    },
  })

  const roomName = useMemo(() => {
    const map = new Map((rooms.data || []).map((r) => [r.id, r.roomNumber || '']))
    return (id?: string | null) => (id && map.get(id) ? `Phòng ${map.get(id)}` : '—')
  }, [rooms.data])

  const byContract = useMemo(() => {
    const map = new Map<string, BillingInvoice[]>()
    for (const invoice of invoices.data || []) {
      map.set(invoice.contractId, [...(map.get(invoice.contractId) || []), invoice])
    }
    return map
  }, [invoices.data])

  const rows = (contracts.data || []).filter(
    (c) => BILLABLE_CONTRACT.includes(c.status) || byContract.has(c.id),
  )
  const monthTotal = (invoices.data || []).reduce((sum, i) => sum + i.totalAmount, 0)
  const monthPaid = (invoices.data || []).reduce((sum, i) => sum + (i.paidAmount ?? 0), 0)
  const actionError = issue.error || remove.error || generate.error

  return (
    <ManagerPage
      title="Billing theo tháng"
      description="Mỗi hợp đồng có những hoá đơn nào trong tháng. Lập hoá đơn cho từng hợp đồng hoặc cả tháng, rồi phát hành để người thuê thanh toán."
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tháng</span>
            <input
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value)
                setSummary(null)
              }}
              className="h-11 rounded-lg border border-border bg-surface px-3"
            />
          </label>
          <Button variant="outline" loading={generate.isPending} onClick={() => generate.mutate()}>
            <Zap size={16} />
            Lập nháp cả tháng
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Số hoá đơn" value={String(invoices.data?.length ?? 0)} />
        <Stat label="Tổng phải thu" value={formatVnd(monthTotal)} />
        <Stat label="Đã thu" value={formatVnd(monthPaid)} />
      </div>

      <InlineError error={actionError} />
      {summary && <GenerateSummary result={summary} />}

      <Panel className="p-0 sm:p-0">
        <QueryState
          pending={contracts.isPending || invoices.isPending}
          error={contracts.error || invoices.error}
          retry={() => Promise.all([contracts.refetch(), invoices.refetch()])}
          empty={rows.length === 0}
          emptyMessage="Chưa có hợp đồng nào đang hiệu lực trong các chi nhánh bạn quản lý."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-bold">Hợp đồng · Người thuê</th>
                  <th className="px-3 py-3 font-bold">Phòng</th>
                  <th className="px-3 py-3 font-bold">Hoá đơn {periodLabel(period).toLowerCase()}</th>
                  <th className="px-5 py-3 text-right font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((contract) => {
                  const list = byContract.get(contract.id) || []
                  return (
                    <tr key={contract.id} className="border-b border-border/60 align-top">
                      <td className="px-5 py-4">
                        <p className="font-bold">{contract.tenantName || 'Người thuê'}</p>
                        <p className="text-xs text-muted-foreground">
                          {contract.contractNumber} · {dayLabel(contract.startDate)} – {dayLabel(contract.endDate)}
                        </p>
                        {contract.status !== 'ACTIVE' && (
                          <p className="mt-1 text-xs text-muted-foreground">Trạng thái: {contract.status}</p>
                        )}
                      </td>
                      <td className="px-3 py-4">{roomName(contract.roomId)}</td>
                      <td className="px-3 py-4">
                        {list.length === 0 ? (
                          <span className="text-muted-foreground">Chưa có</span>
                        ) : (
                          <ul className="grid gap-2">
                            {list.map((invoice) => (
                              <li key={invoice.id} className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{invoice.invoiceNumber}</span>
                                <InvoiceStatusBadge status={invoice.status} />
                                <KindBadge kind={invoice.kind} />
                                <span className="font-bold">{formatVnd(invoice.totalAmount)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Xem hoá đơn"
                                  onClick={() => setViewing(invoice)}
                                >
                                  <Eye size={16} />
                                </Button>
                                {invoice.status === 'DRAFT' && invoice.id && (
                                  <>
                                    <Button
                                      variant="soft"
                                      loading={issue.isPending && issue.variables === invoice.id}
                                      disabled={issue.isPending}
                                      onClick={() => issue.mutate(invoice.id!)}
                                    >
                                      <Send size={14} />
                                      Phát hành
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Xoá hoá đơn nháp"
                                      disabled={remove.isPending}
                                      onClick={() => {
                                        if (window.confirm(`Xoá hoá đơn nháp ${invoice.invoiceNumber}?`))
                                          remove.mutate(invoice.id!)
                                      }}
                                    >
                                      <Trash2 size={16} className="text-danger" />
                                    </Button>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="outline" onClick={() => setCreating(contract)}>
                          <FilePlus2 size={16} />
                          Lập hoá đơn
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </QueryState>
      </Panel>

      {creating && (
        <CreateInvoiceModal
          contract={creating}
          defaultPeriod={period}
          onClose={() => setCreating(null)}
          onCreated={(createdPeriod) => {
            setCreating(null)
            setPeriod(createdPeriod)
            void refresh()
          }}
        />
      )}

      <Modal
        title={viewing ? `Hoá đơn ${viewing.invoiceNumber}` : 'Hoá đơn'}
        description={
          viewing
            ? `${periodLabel(viewing.period)} · Phát hành ${dayLabel(viewing.issueDate)} · Hạn ${dayLabel(viewing.dueDate)}`
            : undefined
        }
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        {viewing && <InvoiceItemsTable invoice={viewing} />}
      </Modal>
    </ManagerPage>
  )
}

/** Picks a month, previews the invoice (dry run), then creates it as a draft or issues it right away. */
function CreateInvoiceModal({
  contract,
  defaultPeriod,
  onClose,
  onCreated,
}: {
  contract: BillingContract
  defaultPeriod: string
  onClose: () => void
  onCreated: (period: string) => void
}) {
  const [period, setPeriod] = useState(defaultPeriod)
  const preview = useQuery({
    queryKey: ['billing', 'preview', contract.id, period],
    queryFn: () => billingApi.createForContract(contract.id, period, true),
    enabled: /^\d{4}-\d{2}$/.test(period),
    retry: false,
    gcTime: 0,
  })
  const create = useMutation({
    mutationFn: async (issueNow: boolean) => {
      const created = await billingApi.createForContract(contract.id, period, false)
      if (issueNow && created.id) await billingApi.issue(created.id)
      return created
    },
    onSuccess: () => onCreated(period),
  })

  return (
    <Modal
      title="Lập hoá đơn cho hợp đồng"
      description={`${contract.tenantName || 'Người thuê'} · ${contract.contractNumber}`}
      open
      onOpenChange={(open) => !open && onClose()}
    >
      <div className="grid gap-5">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Tháng tính tiền</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-11 rounded-lg border border-border bg-surface px-3"
          />
        </label>
        <Notice>
          Chỉ thu những khoản chưa có trong hoá đơn đã phát hành của tháng này. Nếu tháng đã có hoá đơn,
          hệ thống tạo hoá đơn bổ sung với phần còn thiếu.
        </Notice>
        {preview.isPending && <p className="text-sm text-muted-foreground">Đang tính thử...</p>}
        <InlineError error={preview.error} />
        {preview.data && (
          <div className="grid gap-3">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              Xem trước:
              <span className="font-bold">
                {preview.data.kind === 'SUPPLEMENTARY' ? 'Hoá đơn bổ sung' : 'Hoá đơn tháng'}
              </span>
              {preview.data.id && <span className="text-muted-foreground">(cập nhật bản nháp hiện có)</span>}
            </p>
            <InvoiceItemsTable invoice={preview.data} />
          </div>
        )}
        <InlineError error={create.error} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Huỷ
          </Button>
          <Button
            variant="outline"
            disabled={!preview.data || create.isPending}
            loading={create.isPending && create.variables === false}
            onClick={() => create.mutate(false)}
          >
            Lưu nháp
          </Button>
          <Button
            disabled={!preview.data || create.isPending}
            loading={create.isPending && create.variables === true}
            onClick={() => create.mutate(true)}
          >
            <Send size={16} />
            Tạo & phát hành
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function GenerateSummary({ result }: { result: GenerateResult }) {
  return (
    <Notice tone={result.failed.length ? 'warning' : 'success'}>
      <div className="grid gap-1">
        <p>
          Đã tạo {result.created.length} hoá đơn nháp, tính lại {result.regenerated.length}, bỏ qua{' '}
          {result.skipped.length}, lỗi {result.failed.length}.
        </p>
        {result.skipped.length > 0 && (
          <p className="text-xs">
            Bỏ qua:{' '}
            {Object.entries(
              result.skipped.reduce<Record<string, number>>((acc, s) => {
                acc[s.reason] = (acc[s.reason] || 0) + 1
                return acc
              }, {}),
            )
              .map(([reason, count]) => `${count} ${skipReason[reason] || reason}`)
              .join(', ')}
          </p>
        )}
        {result.failed.map((f) => (
          <p key={f.contractId} className="text-xs">
            Hợp đồng {f.contractId.slice(-6)}: {f.error}
          </p>
        ))}
      </div>
    </Notice>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border/70">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}
