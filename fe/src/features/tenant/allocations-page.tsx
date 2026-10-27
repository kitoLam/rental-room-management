import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { type AllocationProposal } from '@/interfaces/tenant'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyRows, TenantLink, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantQuery } from './context'
import { ProposalForm } from './service-shared'
export function AllocationsPage() {
  const { tenancy: t } = useTenant(),
    charges = useTenantQuery('utilities', tenantApi.utilities),
    query = useTenantQuery('allocations', tenantApi.allocations, [], true),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<AllocationProposal | null>(null),
    [success, setSuccess] = useState(false)
  const detail = query.data?.find((p) => p.id === selected?.id)
  return (
    <TenantPage
      title="Phân bổ phí sinh hoạt"
      description="Phân bổ mặc định theo số ngày cư trú; thỏa thuận khác cần quản lý duyệt."
      actions={
        <Button onClick={() => setOpen(true)} disabled={!isActive(t) || !charges.data?.length}>
          <Plus size={17} />
          Đề xuất phân bổ
        </Button>
      }
    >
      <TenantLink to="/tenant/utilities">Về điện & nước</TenantLink>
      {success && <Notice tone="success">Đã gửi đề xuất, đang chờ quản lý xét duyệt.</Notice>}
      <QueryState pending={charges.isPending} error={charges.error} retry={charges.refetch}>
        {charges.data?.map((c) => (
          <Panel key={c.id}>
            <h2 className="mb-4 font-bold">
              {c.name} · {c.billingMonth.slice(0, 7)}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {dateOnly(c.startDate)} – {dateOnly(c.endDate)} · Tổng {formatVnd(c.totalAmount)}
            </p>
            {c.participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap justify-between gap-3 border-t border-border py-3 text-sm"
              >
                <span>
                  {p.label} · {p.days} ngày
                </span>
                <span className="font-bold tabular-nums">{formatVnd(p.amount)}</span>
              </div>
            ))}
          </Panel>
        ))}
      </QueryState>
      <Panel>
        <h2 className="mb-5 font-bold">Lịch sử đề xuất</h2>
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {query.data?.length ? (
            query.data.map((p) => (
              <button
                key={p.id}
                className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border py-4 text-left"
                onClick={() => setSelected(p)}
              >
                <div>
                  <p className="text-sm font-bold">
                    {charges.data?.find((c) => c.id === p.chargeId)?.name || 'Phí sinh hoạt'} ·{' '}
                    {p.method === 'RESIDENT_DAYS' ? 'Theo ngày cư trú' : 'Thỏa thuận riêng'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateTime(p.createdAt)}</p>
                </div>
                <TenantStatus value={p.status} />
              </button>
            ))
          ) : (
            <EmptyRows>Chưa có đề xuất phân bổ.</EmptyRows>
          )}
        </QueryState>
      </Panel>
      <Modal title="Đề xuất phân bổ" open={open} onOpenChange={setOpen}>
        {charges.data?.length && (
          <ProposalForm
            charges={charges.data}
            onSuccess={() => {
              setOpen(false)
              setSuccess(true)
            }}
          />
        )}
      </Modal>
      <Modal
        title="Chi tiết đề xuất"
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
        drawer
      >
        {detail && (
          <div className="grid min-w-0 grid-cols-1 gap-5">
            <TenantStatus value={detail.status} />
            <p className="text-sm leading-6">{detail.reason}</p>
            {detail.shares.map((s) => (
              <div key={s.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {charges.data
                    ?.find((c) => c.id === detail.chargeId)
                    ?.participants.find((p) => p.id === s.id)?.label || 'Người cư trú'}
                </span>
                <strong className="tabular-nums">{formatVnd(s.amount)}</strong>
              </div>
            ))}
            {detail.decidedAt && (
              <p className="text-xs text-muted-foreground">
                Xử lý lúc {dateTime(detail.decidedAt)}
              </p>
            )}
            <Notice>{detail.decision || 'Đang chờ người có thẩm quyền xét duyệt.'}</Notice>
          </div>
        )}
      </Modal>
    </TenantPage>
  )
}
