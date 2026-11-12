import { InlineError } from '@/components/common/page'
import { formatVnd } from '@/lib/format'
import { serviceCatalogApi } from '@/services/service-catalog'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

/** Checkbox list of the branch's room service catalog; value = selected room service ids. */
export function RoomServiceSelect({
  branchId,
  value,
  onChange,
  disabled = false,
}: {
  branchId: string
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const catalog = useQuery({
    queryKey: ['service-catalog', 'room', branchId],
    queryFn: () => serviceCatalogApi.list('room', branchId),
  })
  // Keep services already on the room visible even if they were switched off later.
  const items = (catalog.data || []).filter((s) => s.status === 'ACTIVE' || value.includes(s.id))
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((v) => v !== id))

  return (
    <fieldset className="grid gap-2 rounded-lg border border-border/70 p-4">
      <legend className="px-1 text-sm font-bold">Dịch vụ đi kèm phòng</legend>
      <p className="text-xs text-muted-foreground">
        Áp dụng cho mọi người ở trong phòng. Quản lý danh mục ở trang{' '}
        <Link to="/manager/room-services" className="text-primary underline">
          Dịch vụ theo phòng
        </Link>
        .
      </p>
      <InlineError error={catalog.error} />
      {catalog.isPending && <p className="text-sm text-muted-foreground">Đang tải dịch vụ...</p>}
      {catalog.data && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Chi nhánh chưa có dịch vụ theo phòng nào.</p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((s) => (
          <li key={s.id}>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border/60 px-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={value.includes(s.id)}
                disabled={disabled}
                onChange={(e) => toggle(s.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{s.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatVnd(s.unitPrice)} / {s.unit}
                  {s.status !== 'ACTIVE' && ' · đã ngừng'}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/** Read-only list of a room's services, resolved against the branch catalog. */
export function RoomServiceList({ branchId, ids }: { branchId: string; ids: string[] }) {
  const catalog = useQuery({
    queryKey: ['service-catalog', 'room', branchId],
    queryFn: () => serviceCatalogApi.list('room', branchId),
  })
  const items = (catalog.data || []).filter((s) => ids.includes(s.id))
  if (catalog.isPending) return <p className="text-sm text-muted-foreground">Đang tải dịch vụ...</p>
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Chưa gắn dịch vụ nào.</p>
  return (
    <ul className="grid gap-1 text-sm">
      {items.map((s) => (
        <li key={s.id} className="flex justify-between gap-4 border-t border-border/60 py-2">
          <span>{s.name}</span>
          <span className="text-muted-foreground">
            {formatVnd(s.unitPrice)} / {s.unit}
          </span>
        </li>
      ))}
    </ul>
  )
}
