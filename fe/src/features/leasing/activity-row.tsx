import { RecordStatus } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { type Appointment, type Booking } from '@/interfaces/domain'
import { dateOnly, dateTime } from '@/lib/activity'
import { ArrowUpRight, CalendarDays, Clock3, KeyRound } from 'lucide-react'
import { Link } from 'react-router'

export function ActivityRow({
  record,
  kind,
}: {
  record: Appointment | Booking
  kind: 'appointments' | 'bookings'
}) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-5 border-b border-border py-5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Link
            to={`/user/${kind}/${record.id}`}
            className="text-sm font-bold hover:text-primary hover:underline"
          >
            {record.roomTitle}
          </Link>
          <RecordStatus status={record.status} />
        </div>
        <p className="text-xs text-muted-foreground">{record.branchName}</p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          {kind === 'appointments' ? (
            <CalendarDays size={16} className="text-primary" />
          ) : (
            <KeyRound size={16} className="text-primary" />
          )}
          {'startAt' in record
            ? dateTime(record.startAt)
            : `${dateOnly(record.startDate)} → ${dateOnly(record.endDate)}`}
        </p>
        {'paymentDueAt' in record && record.status === 'AWAITING_PAYMENT' && (
          <p className="mt-2 flex items-center gap-2 text-xs text-warning">
            <Clock3 size={14} />
            Thanh toán trước {dateTime(record.paymentDueAt)}
          </p>
        )}
      </div>
      <Button asChild variant="outline">
        <Link to={`/user/${kind}/${record.id}`}>
          Chi tiết
          <ArrowUpRight />
        </Link>
      </Button>
    </article>
  )
}
