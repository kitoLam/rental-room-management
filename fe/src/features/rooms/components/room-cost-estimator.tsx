import { useId, useState } from 'react'
import { Calculator } from 'lucide-react'
import { Field } from '@/components/common/page'
import { formatVnd } from '@/lib/format'
import type { Room } from '@/interfaces/domain'
import { estimateMonthlyCost } from '../lib/cost-estimate'

export function RoomCostEstimator({ room }: { room: Room }) {
  const id = useId()
  const [values, setValues] = useState({
    people: '1',
    vehicles: '0',
    electricity: '0',
    water: '0',
  })
  type Key = keyof typeof values
  const fields: { key: Key; label: string; unit: string; min: number; step: number }[] = [
    { key: 'people', label: 'Số người ở', unit: 'người', min: 1, step: 1 },
    { key: 'vehicles', label: 'Số xe', unit: 'xe', min: 0, step: 1 },
    { key: 'electricity', label: 'Điện dự kiến / tháng', unit: 'kWh', min: 0, step: 1 },
    { key: 'water', label: 'Nước dự kiến / tháng', unit: 'm³', min: 0, step: 0.1 },
  ]
  const rateFields = [
    {
      key: 'electricityRate' as const,
      label: 'Đơn giá điện',
      unit: '₫ / kWh',
      usage: 'electricity' as const,
    },
    { key: 'waterRate' as const, label: 'Đơn giá nước', unit: '₫ / m³', usage: 'water' as const },
    {
      key: 'parkingRate' as const,
      label: 'Phí gửi xe / tháng',
      unit: '₫ / xe',
      usage: 'vehicles' as const,
    },
  ]
  const rates = room.utilityRates ?? { electricityRate: null, waterRate: null, parkingRate: null }
  const numbers = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Number(value)]),
  ) as Record<Key, number>
  const missingRates = rateFields.filter(
    ({ key, usage }) => rates[key] == null && numbers[usage] > 0,
  )
  function errorFor(key: Key) {
    const value = values[key]
    const number = numbers[key]
    const field = fields.find((field) => field.key === key)!
    if (value === '') return 'Nhập giá trị để tính chi phí.'
    if (!Number.isFinite(number) || number < field.min) return `Nhập số từ ${field.min} trở lên.`
    if (key !== 'water' && !Number.isInteger(number)) return 'Vui lòng nhập số nguyên.'
    if (key === 'people' && room.capacity > 0 && number > room.capacity)
      return `Phòng có sức chứa tối đa ${room.capacity} người.`
    return undefined
  }
  const valid = fields.every(({ key }) => !errorFor(key))
  const costs =
    valid && missingRates.length === 0
      ? estimateMonthlyCost({
          rent: room.price,
          rentalMode: room.rentalMode,
          ...numbers,
          electricityRate: rates.electricityRate ?? 0,
          waterRate: rates.waterRate ?? 0,
          parkingRate: rates.parkingRate ?? 0,
        })
      : null
  const money = (value: number) => formatVnd(Math.round(value))

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-8"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-xl bg-primary-soft p-3 text-primary">
          <Calculator className="size-5" />
        </span>
        <h2 id={`${id}-title`} className="text-xl font-bold">
          Dự tính chi phí hằng tháng
        </h2>
      </div>
      <p className="mb-6 text-sm leading-7 text-muted-foreground">
        Tiền thuê lấy từ giá tham khảo của phòng. Nhập số xe và lượng điện, nước dự kiến dùng chung
        cho tất cả người ở. Đơn giá do Owner/Manager cấu hình.
        {room.rentalMode === 'SLOT' && ' Giá thuê theo chỗ được nhân với số người.'}
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-4">
        <span className="text-sm text-muted-foreground">
          {room.rentalMode === 'SLOT' ? 'Tiền thuê / người / tháng' : 'Tiền thuê / phòng / tháng'}
        </span>
        <strong className="text-lg text-primary">{money(room.price)}</strong>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map(({ key, label, unit, min, step }) => (
          <Field key={key} id={`${id}-${key}`} label={label} error={errorFor(key)}>
            <div className="relative min-w-0">
              <input
                id={`${id}-${key}`}
                type="number"
                min={min}
                step={step}
                max={key === 'people' && room.capacity > 0 ? room.capacity : undefined}
                className="input pr-24"
                value={values[key]}
                aria-invalid={!!errorFor(key)}
                aria-describedby={errorFor(key) ? `${id}-${key}-error` : undefined}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [key]: event.target.value }))
                }
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
          </Field>
        ))}
        {rateFields.map(({ key, label, unit }) => (
          <Field key={key} id={`${id}-${key}`} label={label}>
            <div className="relative min-w-0">
              <input
                id={`${id}-${key}`}
                type="text"
                readOnly
                aria-readonly="true"
                className="input bg-background pr-24 text-muted-foreground"
                value={rates[key] == null ? 'Chưa cấu hình' : money(rates[key])}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
          </Field>
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        Đơn giá áp dụng theo cấu hình riêng của phòng hoặc đơn giá mặc định của chi nhánh. Giá 0 ₫
        nghĩa là miễn phí; “Chưa cấu hình” không được tính là miễn phí.
      </p>
      <div
        className="mt-6 rounded-xl bg-primary-soft p-5 sm:p-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {costs ? (
          <>
            <dl className="space-y-3 text-sm">
              {(
                [
                  ['Tiền thuê', costs.rent],
                  ['Tiền điện', costs.electricity],
                  ['Tiền nước', costs.water],
                  ['Tiền gửi xe', costs.parking],
                ] as const
              ).map(([label, cost]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2">
                  <dt>{label}</dt>
                  <dd className="font-semibold">{money(cost)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-primary/20 pt-5">
              <h3 className="font-bold">Tổng dự tính / tháng</h3>
              <p className="text-[1.75rem] font-bold text-primary">{money(costs.total)}</p>
            </div>
            <p className="mt-2 text-sm">
              Chia đều {numbers.people} người:{' '}
              <strong>{money(costs.perPerson)} / người / tháng</strong>
            </p>
          </>
        ) : (
          <p className="text-sm">
            {valid && missingRates.length
              ? `Chưa thể tính tổng vì chưa có ${missingRates.map((field) => field.label.toLowerCase()).join(', ')}. Vui lòng liên hệ chi nhánh để xác nhận.`
              : 'Hoàn tất các trường được đánh dấu để xem tổng chi phí dự tính.'}
          </p>
        )}
      </div>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        Ước tính gồm tiền thuê, điện, nước và gửi xe; chưa gồm tiền cọc và các dịch vụ khác. Chi phí
        thực tế phụ thuộc mức sử dụng và thỏa thuận thuê.
      </p>
    </section>
  )
}
