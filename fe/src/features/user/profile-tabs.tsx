import { Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { ContractEvidencePanel } from '@/features/leasing/contract-evidence-panel'
import { contractStage } from '@/features/leasing/contract-stage'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { bookingService } from '@/services/guest-user'
import { paymentStatusLabel, tenantProfileApi, type MyContract } from '@/services/tenant-profile'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, CreditCard, Home } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

/** "Thanh toán" tab: deposits still to pay + payment history. */
export function PaymentsTab() {
  const awaiting = useQuery({
    queryKey: ['profile', 'bookings-awaiting-payment'],
    queryFn: () => bookingService.list('AWAITING_PAYMENT', 1),
  })
  const payments = useQuery({ queryKey: ['profile', 'payments'], queryFn: tenantProfileApi.payments })

  return (
    <div className="grid gap-6">
      <Panel>
        <h2 className="mb-1 font-bold">Cần thanh toán</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Tiền cọc giữ chỗ chờ thanh toán. Một lần thanh toán cho tất cả các chỗ bạn đã chọn; sau đó mỗi chỗ có một hợp đồng riêng.
        </p>
        <QueryState pending={awaiting.isPending} error={awaiting.error} retry={awaiting.refetch}>
          {awaiting.data?.content.length === 0 && <p className="text-sm text-muted-foreground">Không có khoản nào cần thanh toán.</p>}
          <ul className="grid gap-3">
            {awaiting.data?.content.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <p className="font-bold">{b.roomTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.slotLabels.join(', ')} · Hạn {b.paymentDueAt ? dateTime(b.paymentDueAt) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary">{formatVnd(b.holdAmount)}</span>
                  <Button asChild>
                    <Link to={`/tenant/bookings/${b.id}/payment`}>
                      <CreditCard size={16} />
                      Thanh toán
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </QueryState>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-bold">Lịch sử thanh toán</h2>
        <QueryState
          pending={payments.isPending}
          error={payments.error}
          retry={payments.refetch}
          empty={payments.data?.length === 0}
          emptyMessage="Chưa có giao dịch nào."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-bold">Thời gian</th>
                  <th className="py-2 pr-3 font-bold">Nội dung</th>
                  <th className="py-2 pr-3 font-bold">Số tiền</th>
                  <th className="py-2 font-bold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {payments.data?.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-3 pr-3 whitespace-nowrap">{dateTime(p.paidAt || p.createdAt || '')}</td>
                    <td className="py-3 pr-3">
                      {p.invoiceId ? 'Hoá đơn' : 'Tiền cọc giữ chỗ'}
                      {p.bookingId && (
                        <Link to={`/tenant/bookings/${p.bookingId}`} className="ml-2 text-xs text-primary underline">
                          Xem
                        </Link>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {p.method} {p.transactionCode && `· ${p.transactionCode}`}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-medium whitespace-nowrap">{formatVnd(p.amount)}</td>
                    <td className="py-3">
                      <StatusBadge tone={p.status === 'SUCCESS' ? 'success' : p.status === 'FAILED' ? 'danger' : 'warning'}>
                        {paymentStatusLabel[p.status] || p.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </Panel>
    </div>
  )
}

const stageFilters = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'Chờ ký & nộp', label: 'Chờ ký & nộp' },
  { key: 'Cần gửi lại', label: 'Cần gửi lại' },
  { key: 'Chờ duyệt', label: 'Chờ duyệt' },
  { key: 'Đang hiệu lực', label: 'Đang hiệu lực' },
  { key: 'ENDED', label: 'Đã kết thúc / huỷ' },
] as const

/** "Hợp đồng" tab: every slot contract, filter by stage, submit the signed copy per contract. */
export function ContractsTab() {
  const queryClient = useQueryClient()
  const contracts = useQuery({ queryKey: ['profile', 'contracts'], queryFn: tenantProfileApi.contracts })
  const [filter, setFilter] = useState<(typeof stageFilters)[number]['key']>('ALL')
  const [open, setOpen] = useState<string | null>(null)

  const matches = (c: MyContract) => {
    const label = contractStage(c).label
    if (filter === 'ALL') return true
    if (filter === 'ENDED') return label === 'Đã huỷ' || label === 'Đã kết thúc'
    return label === filter
  }
  const list = (contracts.data || []).filter(matches)
  const count = (key: (typeof stageFilters)[number]['key']) =>
    (contracts.data || []).filter((c) => {
      const label = contractStage(c).label
      return key === 'ALL' || (key === 'ENDED' ? label === 'Đã huỷ' || label === 'Đã kết thúc' : label === key)
    }).length

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Mỗi chỗ ở có một hợp đồng riêng. Tải mẫu, ký, rồi nộp bản ký cho từng hợp đồng; quản lý duyệt xong bạn mới vào được không
        gian thuê của chỗ đó.
      </p>
      <div className="flex flex-wrap gap-2">
        {stageFilters.map((f) => (
          <Button key={f.key} variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label} ({count(f.key)})
          </Button>
        ))}
      </div>
      <QueryState
        pending={contracts.isPending}
        error={contracts.error}
        retry={contracts.refetch}
        empty={list.length === 0}
        emptyMessage="Không có hợp đồng nào ở mục này."
      >
        <ul className="grid gap-3">
          {list.map((c) => {
            const stage = contractStage(c)
            const expanded = open === c.id
            return (
              <li key={c.id}>
                <Panel className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {c.contractNumber}
                        <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.roomAddress} · {formatVnd(c.rentPrice ?? 0)}/tháng
                        {c.startDate && ` · ${c.startDate} → ${c.endDate}`}
                      </p>
                      {c.status === 'DRAFT' && c.evidenceDeadline && !c.evidenceSubmittedAt && (
                        <p className="text-xs text-danger">Hạn nộp bản ký: {dateTime(c.evidenceDeadline)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'ACTIVE' && (
                        <Button asChild variant="soft">
                          <Link to="/tenant/dashboard">
                            <Home size={16} />
                            Vào không gian thuê
                          </Link>
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setOpen(expanded ? null : c.id)}>
                        {c.status === 'DRAFT' && !c.evidenceSubmittedAt ? 'Nộp bản ký' : 'Chi tiết'}
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </div>
                  </div>
                </Panel>
                {expanded && (
                  <ContractEvidencePanel
                    contractId={c.id}
                    canManage={false}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ['profile', 'contracts'] })}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </QueryState>
    </div>
  )
}
