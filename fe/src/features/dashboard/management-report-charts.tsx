import { useId, useState } from 'react'
import { Panel } from '@/components/common/page'
import type { ManagementReportData } from '@/interfaces/dashboard'
import { formatVnd } from '@/lib/format'

type ReportRoom = ManagementReportData['topReceipts'][number]
const colors = ['#0f766e', '#52877f', '#7485a1', '#ae8959', '#9a7585', '#b9b4aa']
const percent = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
const compact = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`

export function MonthlyReceiptsChart({ months }: { months: ManagementReportData['months'] }) {
  const [selected, setSelected] = useState<string>()
  const detailId = useId()
  if (months.every((month) => month.receipts === 0))
    return (
      <p className="py-6 text-sm leading-6 text-muted-foreground">
        Chưa có thanh toán hóa đơn đủ điều kiện trong kỳ để hiển thị biểu đồ.
      </p>
    )
  const max = Math.max(...months.map((m) => m.receipts), 1)
  const width = 820 / months.length
  const active = months.find((m) => m.month === selected)
  return (
    <>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Biểu đồ tiền thu, cuộn ngang để xem các tháng"
        tabIndex={0}
      >
        <svg
          className="mt-5 h-auto w-full min-w-[760px]"
          viewBox="0 0 940 280"
          role="group"
          aria-label="Biểu đồ tiền đã thu theo tháng"
        >
          {[0, 0.5, 1].map((ratio) => (
            <g key={ratio} aria-hidden="true">
              <line
                x1="100"
                x2="920"
                y1={225 - ratio * 185}
                y2={225 - ratio * 185}
                stroke="currentColor"
                className="text-border"
              />
              <text
                x="88"
                y={229 - ratio * 185}
                textAnchor="end"
                fontSize="12"
                fill="currentColor"
                className="text-muted-foreground"
              >
                {compact(max * ratio)}
              </text>
            </g>
          ))}
          {months.map((month, index) => (
            <g
              key={month.month}
              role="button"
              tabIndex={0}
              aria-label={`${monthLabel(month.month)}: ${formatVnd(month.receipts)}`}
              aria-describedby={detailId}
              aria-pressed={active?.month === month.month}
              className="cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-primary [&:focus-visible>rect:first-of-type]:stroke-2"
              onMouseEnter={() => setSelected(month.month)}
              onFocus={() => setSelected(month.month)}
              onClick={() => setSelected(month.month)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelected(month.month)
                }
              }}
            >
              <title>
                {monthLabel(month.month)}: {formatVnd(month.receipts)}
              </title>
              <rect
                x={100 + index * width + 2}
                y="28"
                width={width - 4}
                height="205"
                rx="4"
                fill="currentColor"
                className={active?.month === month.month ? 'text-primary/5' : 'text-transparent'}
              />
              <rect
                x={100 + index * width + width * 0.23}
                y={225 - (month.receipts / max) * 185}
                width={width * 0.54}
                height={(month.receipts / max) * 185}
                rx="3"
                fill="currentColor"
                className={active?.month === month.month ? 'text-primary' : 'text-primary/70'}
              />
              <text
                x={100 + index * width + width / 2}
                y="250"
                textAnchor="middle"
                fontSize="12"
                fill="currentColor"
                className="text-muted-foreground"
              >
                {monthLabel(month.month)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p id={detailId} role="status" className="min-h-10 py-2 text-sm leading-6">
        {active ? (
          <>
            <span className="font-semibold">{monthLabel(active.month)}</span> ·{' '}
            {formatVnd(active.receipts)}
          </>
        ) : (
          <span className="text-muted-foreground">
            Trỏ, chạm hoặc dùng phím Tab để xem tiền thu từng tháng.
          </span>
        )}
      </p>
    </>
  )
}

export function RoomRankingChart({
  title,
  rows,
  kind,
}: {
  title: string
  rows: ReportRoom[]
  kind: 'receipts' | 'leases'
}) {
  const [selected, setSelected] = useState<string>()
  const detailId = useId()
  const value = (room: ReportRoom) => (kind === 'receipts' ? room.receipts : room.newLeases)
  const max = Math.max(...rows.map(value), 1)
  const active = rows.find((room) => room.id === selected)
  return (
    <Panel>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        Top 5 trong kỳ đang chọn · {kind === 'receipts' ? 'Đơn vị: đồng' : 'Đơn vị: lượt hợp đồng'}.
      </p>
      {rows.length === 0 ? (
        <p className="py-6 text-sm leading-6 text-muted-foreground">
          {kind === 'receipts'
            ? 'Chưa có thanh toán hóa đơn thành công trong kỳ.'
            : 'Chưa có hợp đồng bắt đầu thuê trong kỳ.'}
        </p>
      ) : (
        <>
          <ol className="mt-5 space-y-4" aria-label={title}>
            {rows.map((room, index) => (
              <li key={room.id}>
                <button
                  type="button"
                  className="block w-full rounded-md p-2 text-left hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-describedby={detailId}
                  aria-pressed={active?.id === room.id}
                  onMouseEnter={() => setSelected(room.id)}
                  onFocus={() => setSelected(room.id)}
                  onClick={() => setSelected(room.id)}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold">
                      <span className="mr-2 font-normal tabular-nums text-muted-foreground">
                        {index + 1}.
                      </span>
                      {room.roomNumber}
                    </span>
                    <span className="font-bold tabular-nums">
                      {kind === 'receipts' ? formatVnd(room.receipts) : `${room.newLeases} lượt`}
                    </span>
                  </span>
                  <span
                    className="mt-2 block h-3 overflow-hidden rounded-sm bg-background"
                    aria-hidden="true"
                  >
                    <svg className="h-full w-full" viewBox="0 0 100 12" preserveAspectRatio="none">
                      <rect
                        width={(value(room) / max) * 100}
                        height="12"
                        rx="0.6"
                        fill="currentColor"
                        className={active?.id === room.id ? 'text-primary' : 'text-primary/65'}
                      />
                    </svg>
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {room.branchName}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div
            id={detailId}
            role="status"
            className="mt-5 min-h-20 border-t border-border pt-4 text-xs leading-6 text-muted-foreground"
          >
            {active ? (
              <>
                <p className="font-semibold text-foreground">
                  {active.roomNumber} · {active.branchName}
                </p>
                <p>
                  {kind === 'receipts'
                    ? `${formatVnd(active.receipts)} · ${percent(active.receiptShare)} tổng tiền thu`
                    : `${active.newLeases} lượt hợp đồng · ${active.leasedSlots} lượt slot thuê${active.unknownSlotContracts > 0 ? ` · ${active.unknownSlotContracts} hợp đồng chưa rõ slot` : ''}`}
                </p>
              </>
            ) : (
              'Trỏ, chạm hoặc dùng phím Tab trên một thanh để xem chi tiết.'
            )}
          </div>
        </>
      )}
    </Panel>
  )
}

// Ring sectors have their own hit areas, so hover/touch always selects the visible slice.
function ringSector(start: number, end: number) {
  const point = (radius: number, angle: number) =>
    [130 + radius * Math.cos(angle), 130 + radius * Math.sin(angle)].join(' ')
  const a = start * Math.PI * 2 - Math.PI / 2
  const b = end * Math.PI * 2 - Math.PI / 2
  if (end - start >= 1 - 1e-10)
    return 'M 130 25 A 105 105 0 1 1 130 235 A 105 105 0 1 1 130 25 L 130 58 A 72 72 0 1 0 130 202 A 72 72 0 1 0 130 58 Z'
  const large = end - start > 0.5 ? 1 : 0
  return `M ${point(105, a)} A 105 105 0 ${large} 1 ${point(105, b)} L ${point(72, b)} A 72 72 0 ${large} 0 ${point(72, a)} Z`
}

export function ReceiptShareChart({ rooms, total }: { rooms: ReportRoom[]; total: number }) {
  const [selected, setSelected] = useState<string>()
  const detailId = useId()
  const slices = rooms
    .filter((room) => room.receipts > 0)
    .map((room, index) => ({
      id: room.id,
      name: room.roomNumber,
      branchName: room.branchName,
      amount: room.receipts,
      color: colors[index],
    }))
  const remainder = Math.max(0, total - slices.reduce((sum, slice) => sum + slice.amount, 0))
  // Avoid an extra slice caused only by floating-point arithmetic in the browser.
  if (remainder > Math.max(0.01, total * Number.EPSILON * 8))
    slices.push({
      id: 'other-rooms',
      name: 'Các phòng còn lại',
      branchName: '',
      amount: remainder,
      color: colors[5],
    })
  const active = slices.find((slice) => slice.id === selected)
  return (
    <Panel>
      <h2 className="text-lg font-bold">Tỷ trọng tiền thu theo phòng</h2>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        Top 5 phòng và các phòng còn lại trong phạm vi bộ lọc, gồm tất cả các trang chi tiết.
      </p>
      {total <= 0 || slices.length === 0 ? (
        <p className="py-6 text-sm leading-6 text-muted-foreground">
          Chưa có khoản thu trong kỳ để tính tỷ trọng.
        </p>
      ) : (
        <>
          <div className="mt-5 grid items-center gap-6 md:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.2fr)]">
            <svg
              viewBox="0 0 260 260"
              className="mx-auto w-full max-w-[280px]"
              role="group"
              aria-label="Biểu đồ donut tỷ trọng tiền thu theo phòng"
            >
              <text
                x="130"
                y="124"
                textAnchor="middle"
                fill="currentColor"
                className="text-muted-foreground"
                fontSize="12"
              >
                Tổng tiền thu
              </text>
              <text
                x="130"
                y="148"
                textAnchor="middle"
                fill="currentColor"
                fontSize="17"
                fontWeight="700"
              >
                {compact(total)} đ
              </text>
              {slices.map((slice, index) => {
                const start =
                  slices.slice(0, index).reduce((sum, item) => sum + item.amount, 0) / total
                const end = start + slice.amount / total
                const label = `${slice.name}${slice.branchName ? ` · ${slice.branchName}` : ''}: ${formatVnd(slice.amount)} · ${percent((slice.amount / total) * 100)}`
                return (
                  <path
                    key={slice.id}
                    d={ringSector(start, Math.min(end, 1))}
                    fill={slice.color}
                    stroke="var(--color-surface)"
                    strokeWidth={active?.id === slice.id ? 4 : 2}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-pressed={active?.id === slice.id}
                    aria-describedby={detailId}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onMouseEnter={() => setSelected(slice.id)}
                    onFocus={() => setSelected(slice.id)}
                    onClick={() => setSelected(slice.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelected(slice.id)
                      }
                    }}
                  >
                    <title>{label}</title>
                  </path>
                )
              })}
            </svg>
            <ul className="space-y-1" aria-label="Chú giải tỷ trọng tiền thu">
              {slices.map((slice) => (
                <li key={slice.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-describedby={detailId}
                    aria-pressed={active?.id === slice.id}
                    onMouseEnter={() => setSelected(slice.id)}
                    onFocus={() => setSelected(slice.id)}
                    onClick={() => setSelected(slice.id)}
                  >
                    <svg className="mt-1 size-3 shrink-0" aria-hidden="true">
                      <rect width="12" height="12" rx="2" fill={slice.color} />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="font-semibold">{slice.name}</span>
                        <span className="font-bold tabular-nums">
                          {percent((slice.amount / total) * 100)}
                        </span>
                      </span>
                      {slice.branchName && (
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {slice.branchName}
                        </span>
                      )}
                      <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                        {formatVnd(slice.amount)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p
            id={detailId}
            role="status"
            className="mt-4 min-h-10 border-t border-border pt-4 text-sm leading-6"
          >
            {active ? (
              <>
                <span className="font-semibold">{active.name}</span>
                {active.branchName ? ` · ${active.branchName}` : ''} · {formatVnd(active.amount)} ·{' '}
                {percent((active.amount / total) * 100)}
              </>
            ) : (
              <span className="text-muted-foreground">
                Trỏ, chạm hoặc dùng phím Tab trên một phần biểu đồ để xem chi tiết.
              </span>
            )}
          </p>
        </>
      )}
    </Panel>
  )
}
