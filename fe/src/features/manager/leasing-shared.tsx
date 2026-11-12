import { dateTime } from '@/lib/activity'

export function History({ items }: { items: { at: string; note: string }[] }) {
  return (
    <ol className="grid gap-4 border-l border-border pl-5">
      {items.map((h, n) => (
        <li key={n}>
          <p className="text-xs text-muted-foreground">{dateTime(h.at)}</p>
          <p className="mt-1 text-sm leading-6">{h.note}</p>
        </li>
      ))}
    </ol>
  )
}
