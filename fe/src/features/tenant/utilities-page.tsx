import { Field, Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { type UtilityCharge } from '@/interfaces/tenant'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { TenantLink, TenantPage } from './components'
import { useTenantQuery } from './context'
import { ChargeDetail } from './service-shared'
export function UtilitiesPage() {
  const query = useTenantQuery('utilities', tenantApi.utilities),
    [month, setMonth] = useState(''),
    [selected, setSelected] = useState<UtilityCharge | null>(null)
  const rows = query.data?.filter((c) => !month || c.billingMonth.startsWith(month)) || []
  return (
    <TenantPage
      title="Điện & nước"
      description="Số liệu chốt kỳ, từng đoạn tính phí và phần được phân bổ cho bạn."
      actions={<TenantLink to="/tenant/utilities/allocations">Đề xuất phân bổ</TenantLink>}
    >
      <Field label="Tháng / năm" id="utility-month">
        <input
          className="input max-w-xs"
          id="utility-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có khoản phí trong kỳ này."
        emptyAction={null}
      >
        <Panel>
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0"
            >
              <div>
                <h2 className="text-sm font-bold">
                  {c.name} · Kỳ {c.billingMonth.slice(0, 7)}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {dateOnly(c.startDate)} – {dateOnly(c.endDate)} · {c.segments.length} đoạn tính
                  phí
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tổng phí phòng: {formatVnd(c.totalAmount)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Phần của bạn</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">{formatVnd(c.myAmount)}</p>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Chi tiết ${c.name}`}
                  onClick={() => setSelected(c)}
                >
                  <ArrowRight size={17} />
                </Button>
              </div>
            </div>
          ))}
        </Panel>
      </QueryState>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
        title={selected ? `Chi tiết phí ${selected.name}` : 'Chi tiết phí'}
      >
        {selected && <ChargeDetail charge={selected} />}
      </Modal>
    </TenantPage>
  )
}
