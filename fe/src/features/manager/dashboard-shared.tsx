import { ChartBar } from '@/components/common/chart-bar'
import type { ManagerSummary } from '@/interfaces/manager'
import { formatVnd } from '@/lib/format'

export function PeriodChart({ data }: { data: ManagerSummary['series'] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.billed, d.receipts, d.sandbox]))
  return (
    <figure>
      <figcaption className="mb-5 font-bold">Hóa đơn & dòng tiền theo kỳ</figcaption>
      <div
        className="flex items-end gap-5"
        role="img"
        aria-label="Biểu đồ số tiền phát hành, thu đã xác minh và thu sandbox trong bốn tháng"
      >
        {data.map((d) => (
          <div key={d.period} className="min-w-0 flex-1">
            <div className="flex h-40 items-end justify-center gap-1.5">
              {[
                [d.billed, 'bg-primary'],
                [d.receipts, 'bg-slate-600'],
                [d.sandbox, 'bg-slate-200'],
              ].map(([v, color], n) => (
                <ChartBar
                  key={n}
                  title={formatVnd(Number(v))}
                  className={`w-1/4 rounded-t ${color}`}
                  value={Number(v)}
                  max={max}
                  vertical
                />
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {d.period.slice(5)}/{d.period.slice(0, 4)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <i className="size-2 rounded-sm bg-primary" />
          Phát hành
        </span>
        <span className="flex items-center gap-2">
          <i className="size-2 rounded-sm bg-slate-600" />
          Thu thực tế
        </span>
        <span className="flex items-center gap-2">
          <i className="size-2 rounded-sm bg-slate-200" />
          Thu sandbox
        </span>
      </div>
      <details className="mt-4 text-xs">
        <summary className="min-h-11 cursor-pointer py-3 text-primary">Xem số liệu biểu đồ</summary>
        <div className="grid gap-3">
          {data.map((d) => (
            <p key={d.period}>
              {d.period}: phát hành {formatVnd(d.billed)}; thu thực tế {formatVnd(d.receipts)};
              sandbox {formatVnd(d.sandbox)}.
            </p>
          ))}
        </div>
      </details>
    </figure>
  )
}
