import { useId } from 'react'
import { formatVnd } from '@/lib/format'
import type { RoomServiceOption } from '@/interfaces/domain'
import { shownOnRoomPage, type ServiceSelection } from '../lib/cost-estimate'

// Bắt buộc: tích sẵn, không bỏ chọn, không sửa số lượng. Tùy chọn: tự tích / bỏ tích, chỉnh số lượng
// khi dịch vụ không tính theo chỉ số. Đơn giá do hệ thống thiết lập, chỉ xem.
export function RoomServicePicker({
  services,
  selection,
  onChange,
  slotCount = 1,
}: {
  services: RoomServiceOption[]
  selection: ServiceSelection
  onChange: (selection: ServiceSelection) => void
  slotCount?: number
}) {
  const id = useId()
  const toggle = (serviceId: string, checked: boolean) => {
    const next = { ...selection }
    if (checked) next[serviceId] = services.find((s) => s.id === serviceId)?.quantityRule === 'PER_SLOT' ? Math.max(1, slotCount) : 1
    else delete next[serviceId]
    onChange(next)
  }
  return (
    <ul className="divide-y divide-border">
      {services.filter(shownOnRoomPage).map((s) => {
        const checked = s.mandatory || (selection[s.id] ?? 0) > 0
        const metered = s.quantityRule === 'METERED' || s.calculationType === 'METERED'
        const userQuantity = s.quantityRule === 'USER_INPUT'
        const inputId = `${id}-${s.id}`
        return (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <label htmlFor={inputId} className="flex min-w-0 items-center gap-3">
              <input
                id={inputId}
                type="checkbox"
                className="size-4 accent-primary"
                checked={checked}
                disabled={s.mandatory}
                onChange={(event) => toggle(s.id, event.target.checked)}
              />
              <span>
                {s.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.mandatory ? 'Bắt buộc' : 'Tùy chọn'}
                </span>
              </span>
            </label>
            <div className="flex items-center gap-3">
              {!s.mandatory && checked && userQuantity && !metered && (
                <input
                  type="number"
                  min={1}
                  max={slotCount > 0 ? slotCount : undefined}
                  step={1}
                  aria-label={`Số lượng ${s.name}`}
                  className="input w-20"
                  value={selection[s.id]}
                  onChange={(event) =>
                    onChange({
                      ...selection,
                      [s.id]: Math.min(
                        slotCount > 0 ? slotCount : Infinity,
                        Math.max(1, Math.floor(Number(event.target.value) || 0)),
                      ),
                    })
                  }
                />
              )}
              {s.quantityRule === 'PER_SLOT' && <span className="text-xs text-muted-foreground">{slotCount > 0 ? `${slotCount} slot` : 'theo slot'}</span>}
              {metered && <span className="text-xs text-muted-foreground">Tính theo chỉ số thực tế</span>}
              <span className="text-muted-foreground">
                {formatVnd(s.price)} / {s.unit}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
