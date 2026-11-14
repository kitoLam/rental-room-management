import { formatVnd } from '@/lib/format'
import type { RoomServiceOption } from '@/interfaces/domain'

export function RoomServiceList({
  services,
  slotCount = 1,
}: {
  services: RoomServiceOption[]
  slotCount?: number
}) {
  return (
    <ul className="divide-y divide-border">
      {services.map((s) => {
        const metered = s.quantityRule === 'METERED' || s.calculationType === 'METERED'
        return (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0 font-medium">{s.name}</span>
            <div className="flex flex-wrap items-center gap-3">
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
