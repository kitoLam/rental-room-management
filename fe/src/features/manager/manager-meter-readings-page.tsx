import { InlineError, Notice, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import { meterReadingApi, type MeterBoard } from '@/services/meter-readings'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, History, LockOpen, Save } from 'lucide-react'
import { useState } from 'react'
import { ManagerPage } from './components'
import { useManager } from './context'

const currentPeriod = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Branch electricity rate + start / end meter readings of every room for a month. */
export function ManagerMeterReadings() {
  const { branch } = useManager()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const board = useQuery({
    queryKey: ['meter-board', branch.id, period],
    queryFn: () => meterReadingApi.board(branch.id, period),
    enabled: /^\d{4}-\d{2}$/.test(period),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['meter-board'] })

  const confirmed = board.data?.rooms.filter((r) => r.reading?.status === 'CONFIRMED').length ?? 0
  const unchanged = board.data?.rooms.filter((r) => isUnchanged(r.reading)).length ?? 0
  const editable = board.data?.editable ?? period === currentPeriod()
  const total = board.data?.rooms.reduce((sum, r) => sum + (r.reading?.amount ?? 0), 0) ?? 0

  return (
    <ManagerPage
      title="Chỉ số điện"
      description="Giá điện chung của chi nhánh và chỉ số công tơ đầu / cuối tháng của từng phòng. Chỉ nhập được tháng hiện tại; sang tháng mới, chỉ số đầu và cuối được lấy sẵn từ chỉ số cuối tháng trước để bạn sửa lại."
      actions={
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Lọc theo tháng</span>
            <input
              type="month"
              value={period}
              max={currentPeriod()}
              onChange={(e) => e.target.value && e.target.value <= currentPeriod() && setPeriod(e.target.value)}
              className="h-11 rounded-lg border border-border bg-surface px-3"
            />
          </label>
          {period !== currentPeriod() && (
            <Button variant="outline" onClick={() => setPeriod(currentPeriod())}>
              Tháng này
            </Button>
          )}
        </div>
      }
    >
      <QueryState pending={board.isPending} error={board.error} retry={board.refetch}>
        {board.data && (
          <>
            {editable ? (
              <RateEditor branchId={branch.id} rate={board.data.electricityRate ?? null} onSaved={refresh} />
            ) : (
              <Notice>
                <History size={18} className="shrink-0" />
                Đang xem lịch sử tháng {formatPeriod(period)}: chỉ xem, không sửa được. Chỉ số chỉ nhập cho tháng hiện
                tại ({formatPeriod(board.data.currentPeriod)}).
              </Notice>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Số phòng" value={String(board.data.rooms.length)} />
              <Stat label="Đã chốt" value={`${confirmed} / ${board.data.rooms.length}`} />
              <Stat label="Tổng tiền điện tháng" value={formatVnd(total)} />
              <Stat label="Đầu kỳ = cuối kỳ" value={`${unchanged} phòng`} warn={unchanged > 0} />
            </div>
            {unchanged > 0 && (
              <div role="note" className="flex gap-3 rounded-lg bg-warning/15 p-4 text-sm ring-1 ring-warning/40">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />
                <p>
                  Có <strong>{unchanged} phòng</strong> có chỉ số cuối kỳ bằng chỉ số đầu kỳ (tiêu thụ 0 kWh), có thể
                  đã quên nhập chỉ số cuối tháng. Các phòng này được tô vàng bên dưới.
                </p>
              </div>
            )}
            <Panel className="p-0 sm:p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3 font-bold">Phòng</th>
                      <th className="px-3 py-3 font-bold">Chỉ số đầu kỳ</th>
                      <th className="px-3 py-3 font-bold">Chỉ số cuối kỳ</th>
                      <th className="px-3 py-3 font-bold">Tiêu thụ</th>
                      <th className="px-3 py-3 font-bold">Thành tiền</th>
                      <th className="px-5 py-3 text-right font-bold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.data.rooms.map((row) => (
                      <ReadingRow
                        key={`${row.roomId}-${row.reading?.id ?? 'new'}-${row.reading?.status ?? ''}`}
                        row={row}
                        period={period}
                        editable={editable}
                        rate={board.data.electricityRate ?? null}
                        onChanged={refresh}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </QueryState>
    </ManagerPage>
  )
}

function RateEditor({ branchId, rate, onSaved }: { branchId: string; rate: number | null; onSaved: () => void }) {
  const [value, setValue] = useState(rate == null ? '' : String(rate))
  const save = useMutation({
    mutationFn: () => meterReadingApi.updateElectricityRate(branchId, Number(value)),
    onSuccess: onSaved,
  })
  return (
    <Panel>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Giá điện chung (VND / kWh)</span>
          <input type="number" min={0} step={100} value={value} onChange={(e) => setValue(e.target.value)} className="input w-48" />
        </label>
        <Button variant="outline" loading={save.isPending} disabled={value === '' || Number(value) < 0} onClick={() => save.mutate()}>
          <Save size={16} />
          Lưu giá điện
        </Button>
        {save.isSuccess && <Notice tone="success">Đã lưu giá điện.</Notice>}
      </div>
      {rate == null && <p className="mt-3 text-sm text-danger">Chưa cấu hình giá điện, chưa thể nhập chỉ số.</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Giá mới áp dụng cho các chỉ số lưu sau thời điểm đổi; chỉ số đã chốt giữ nguyên giá cũ.
      </p>
      <InlineError error={save.error} />
    </Panel>
  )
}

function ReadingRow({
  row,
  period,
  editable,
  rate,
  onChanged,
}: {
  row: MeterBoard['rooms'][number]
  period: string
  editable: boolean
  rate: number | null
  onChanged: () => void
}) {
  const reading = row.reading
  const locked = !editable || reading?.status === 'CONFIRMED'
  const knownStart = reading?.startReading ?? row.suggestedStartReading ?? null
  const [start, setStart] = useState(knownStart == null ? '' : String(knownStart))
  const [end, setEnd] = useState(reading ? String(reading.endReading) : '')
  const usage = start !== '' && end !== '' ? Number(end) - Number(start) : null
  const save = useMutation({
    mutationFn: () => meterReadingApi.save({ roomId: row.roomId, period, startReading: start === '' ? null : Number(start), endReading: Number(end) }),
    onSuccess: onChanged,
  })
  const confirm = useMutation({ mutationFn: () => meterReadingApi.confirm(reading!.id), onSuccess: onChanged })
  const reopen = useMutation({ mutationFn: () => meterReadingApi.reopen(reading!.id), onSuccess: onChanged })
  const error = save.error || confirm.error || reopen.error
  const dirty = !reading || String(reading.endReading) !== end || String(reading.startReading) !== start
  // No usage (saved or being typed): the end-of-month reading was likely never entered.
  const flagged = start !== '' && end !== '' && Number(start) === Number(end)

  return (
    <tr className={`border-b border-border/60 align-top ${flagged ? 'bg-warning/10' : ''}`}>
      <td className="px-5 py-4">
        <p className="font-bold">{row.roomNumber}</p>
        <p className="text-xs text-muted-foreground">{row.title}</p>
        {reading && (
          <StatusBadge tone={reading.status === 'CONFIRMED' ? 'success' : 'warning'} className="mt-1">
            {reading.status === 'CONFIRMED' ? 'Đã chốt' : 'Nháp'}
          </StatusBadge>
        )}
        {flagged && (
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-warning">
            <AlertTriangle size={13} />
            Đầu = cuối, kiểm tra lại
          </p>
        )}
        {error && <p className="mt-2 max-w-48 text-xs text-danger">{error instanceof Error ? error.message : 'Lỗi'}</p>}
      </td>
      <td className="px-3 py-4">
        <input
          type="number"
          min={0}
          value={start}
          disabled={locked}
          onChange={(e) => setStart(e.target.value)}
          placeholder={row.suggestedStartReading == null ? 'Tháng đầu: nhập tay' : ''}
          className="input w-32"
          aria-label={`Chỉ số đầu kỳ phòng ${row.roomNumber}`}
        />
      </td>
      <td className="px-3 py-4">
        <input
          type="number"
          min={0}
          value={end}
          disabled={locked}
          onChange={(e) => setEnd(e.target.value)}
          className={`input w-32 ${flagged ? 'ring-2 ring-warning' : ''}`}
          aria-label={`Chỉ số cuối kỳ phòng ${row.roomNumber}`}
        />
      </td>
      <td className={`px-3 py-4 whitespace-nowrap ${usage !== null && usage < 0 ? 'text-danger' : ''}`}>
        {usage === null ? '—' : `${usage} kWh`}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        {reading && !dirty ? formatVnd(reading.amount) : usage !== null && usage >= 0 && rate != null ? `≈ ${formatVnd(usage * rate)}` : '—'}
      </td>
      <td className="px-5 py-4 text-right whitespace-nowrap">
        {!editable ? (
          <span className="text-xs text-muted-foreground">Chỉ xem</span>
        ) : locked ? (
          <Button variant="ghost" loading={reopen.isPending} onClick={() => reopen.mutate()}>
            <LockOpen size={16} />
            Mở lại
          </Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              loading={save.isPending}
              disabled={end === '' || rate == null || !dirty}
              onClick={() => save.mutate()}
            >
              <Save size={16} />
              Lưu
            </Button>
            {reading && (
              <Button variant="soft" loading={confirm.isPending} disabled={dirty} onClick={() => confirm.mutate()}>
                <Check size={16} />
                Chốt
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

const isUnchanged = (reading?: MeterBoard['rooms'][number]['reading']) =>
  !!reading && reading.startReading === reading.endReading

const formatPeriod = (period: string) => {
  const [year, month] = period.split('-')
  return `${month}/${year}`
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ring-1 ${warn ? 'bg-warning/15 ring-warning/50' : 'bg-surface ring-border/70'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${warn ? 'text-warning' : ''}`}>{value}</p>
    </div>
  )
}
