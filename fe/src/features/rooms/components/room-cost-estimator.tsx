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
    electricityRate: '',
    waterRate: '',
    parkingRate: '',
  })
  type Key = keyof typeof values
  const fields: { key: Key; label: string; unit: string; min: number; step: number }[] = [
    { key: 'people', label: 'Số người ở', unit: 'người', min: 1, step: 1 },
    { key: 'vehicles', label: 'Số xe', unit: 'xe', min: 0, step: 1 },
    { key: 'electricity', label: 'Điện dự kiến / tháng', unit: 'kWh', min: 0, step: 1 },
    { key: 'water', label: 'Nước dự kiến / tháng', unit: 'm³', min: 0, step: 0.1 },
    { key: 'electricityRate', label: 'Đơn giá điện', unit: '₫ / kWh', min: 0, step: 1 },
    { key: 'waterRate', label: 'Đơn giá nước', unit: '₫ / m³', min: 0, step: 1 },
    { key: 'parkingRate', label: 'Phí gửi xe / tháng', unit: '₫ / xe', min: 0, step: 1 },
  ]
  const numbers = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Number(value)]),
  ) as Record<Key, number>
  const requiredRates = {
    electricityRate: numbers.electricity > 0,
    waterRate: numbers.water > 0,
    parkingRate: numbers.vehicles > 0,
  }
  function errorFor(key: Key) {
    const value = values[key]
    const number = numbers[key]
    const field = fields.find((field) => field.key === key)!
    const optionalRate = key in requiredRates && !requiredRates[key as keyof typeof requiredRates]
    if (value === '') return optionalRate ? undefined : 'Nhập giá trị để tính chi phí.'
    if (!Number.isFinite(number) || number < field.min) return `Nhập số từ ${field.min} trở lên.`
    if (key !== 'water' && !Number.isInteger(number)) return 'Vui lòng nhập số nguyên.'
    if (key === 'people' && room.capacity > 0 && number > room.capacity)
      return `Phòng có sức chứa tối đa ${room.capacity} người.`
    return undefined
  }
  const valid = fields.every(({ key }) => !errorFor(key))
  const costs = valid
    ? estimateMonthlyCost({ rent: room.price, rentalMode: room.rentalMode, ...numbers })
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
        Tiền thuê lấy từ giá tham khảo của phòng. Nhập lượng điện, nước dùng chung cho tất cả người
        ở và đơn giá bạn muốn tính.
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
                placeholder="Nhập đơn giá"
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
      </div>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        Đơn giá do bạn nhập, chưa phải bảng giá xác nhận của chi nhánh. Nhập 0 nếu dịch vụ miễn phí
        hoặc đã bao gồm trong tiền thuê.
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
          <p className="text-sm">Hoàn tất các trường được đánh dấu để xem tổng chi phí dự tính.</p>
        )}
      </div>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        Ước tính gồm tiền thuê, điện, nước và gửi xe; chưa gồm tiền cọc và các dịch vụ khác. Chi phí
        thực tế phụ thuộc mức sử dụng và thỏa thuận thuê.
      </p>
    </section>
  )
}
