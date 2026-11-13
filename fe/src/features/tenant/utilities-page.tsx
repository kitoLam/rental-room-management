import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { tenantMeterApi, type TenantMeterYear } from '@/services/meter-readings'
import { useSession } from '@/features/auth/session-store'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { useState } from 'react'
import { TenantPage } from './components'
import { useTenant } from './context'

type Month = TenantMeterYear['months'][number]

const number = (value: number | null | undefined) =>
  value == null ? '—' : new Intl.NumberFormat('vi-VN').format(value)

/** Rows of the month calendar: label + how to render one month that has data. */
const rows: { label: string; render: (m: Month) => string; strong?: boolean }[] = [
  { label: 'Giá điện', render: (m) => `${formatVnd(m.unitPrice ?? 0)}/kWh` },
  { label: 'Số điện đầu tháng', render: (m) => number(m.startReading) },
  { label: 'Số điện cuối tháng', render: (m) => number(m.endReading) },
  { label: 'Tiêu thụ', render: (m) => `${number(m.usage)} kWh` },
  { label: 'Tổng tiền tháng', render: (m) => formatVnd(m.amount ?? 0), strong: true },
]

/** Electricity of the tenant's room, one column per month (1–12) of the chosen year. */
export function UtilitiesPage() {
  const { tenancy } = useTenant()
  const userId = useSession((s) => s.user!.id)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentPeriod = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, setYear] = useState(currentYear)
  const query = useQuery({
    queryKey: ['tenant', userId, tenancy.contractId, 'meter-year', year],
    queryFn: () => tenantMeterApi.year(tenancy.contractId, year),
  })
  const months = query.data?.months ?? []
  const total = months.reduce((sum, m) => sum + (m.available ? (m.amount ?? 0) : 0), 0)
  const usage = months.reduce((sum, m) => sum + (m.available ? (m.usage ?? 0) : 0), 0)

  return (
    <TenantPage
      title="Tiền điện"
      description="Chỉ số công tơ điện và tiền điện từng tháng của phòng bạn đang thuê."
      actions={
        <div className="flex items-center gap-2" aria-label="Chọn năm">
          <Button variant="outline" size="icon" aria-label="Năm trước" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft size={18} />
          </Button>
          <span className="min-w-20 text-center text-lg font-bold tabular-nums">{year}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Năm sau"
            disabled={year >= currentYear}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      }
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Phòng" value={query.data?.roomNumber || tenancy.roomName} />
          <Summary label={`Tổng tiêu thụ ${year}`} value={`${number(usage)} kWh`} />
          <Summary label={`Tổng tiền điện ${year}`} value={formatVnd(total)} />
        </div>
        <Panel className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 w-44 bg-surface px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Zap size={14} className="text-primary" />
                      Năm {year}
                    </span>
                  </th>
                  {months.map((m) => (
                    <th
                      key={m.month}
                      className={cn(
                        'px-3 py-3 text-center text-sm font-bold',
                        m.period === currentPeriod && 'bg-primary-soft text-primary',
                      )}
                    >
                      Tháng {m.month}
                      {m.available && m.status === 'DRAFT' && (
                        <span className="mt-1 block text-[11px] font-medium text-warning">Chưa chốt</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-0">
                    <th
                      scope="row"
                      className={cn(
                        'sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-muted-foreground',
                        row.strong && 'font-bold text-foreground',
                      )}
                    >
                      {row.label}
                    </th>
                    {months.map((m) => {
                      if (!m.available) {
                        // One merged cell per empty month, spanning every row.
                        return rowIndex === 0 ? (
                          <td
                            key={m.month}
                            rowSpan={rows.length}
                            className={cn(
                              'border-x border-border/40 bg-muted/30 px-3 text-center align-middle text-xs text-muted-foreground',
                              m.period === currentPeriod && 'bg-primary-soft/40',
                            )}
                          >
                            Không có dữ liệu
                          </td>
                        ) : null
                      }
                      return (
                        <td
                          key={m.month}
                          className={cn(
                            'px-3 py-3 text-center whitespace-nowrap tabular-nums',
                            row.strong && 'font-bold text-primary',
                            m.period === currentPeriod && 'bg-primary-soft/40',
                          )}
                        >
                          {row.render(m)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <p className="text-xs text-muted-foreground">
          Chỉ hiển thị các tháng thuộc thời hạn hợp đồng của bạn. Tháng “Chưa chốt” là số liệu tạm, quản lý có thể còn
          cập nhật chỉ số cuối tháng.
        </p>
      </QueryState>
    </TenantPage>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border/70">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}
