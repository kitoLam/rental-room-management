import { Notice, Page, Pagination, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  appointmentStatuses,
  bookingStatuses,
  type Appointment,
  type Booking,
  type Page as PageResult,
} from '@/interfaces/domain'
import { dateTime, statusLabel } from '@/lib/activity'
import { appointmentService, bookingService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ActivityRow } from './activity-row'
export function Timeline({ items }: { items: { status: string; at: string; note: string }[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-5 font-bold">Tiến trình yêu cầu</h2>
      <ol className="space-y-5 border-l border-border pl-5">
        {items.map((item, i) => (
          <li key={`${item.at}-${i}`}>
            <p className="text-sm font-bold">{statusLabel[item.status] || item.status}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dateTime(item.at)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
export function ActivityList({ kind }: { kind: 'appointments' | 'bookings' }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const rawPage = Number(params.get('page') || 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const statuses = kind === 'appointments' ? appointmentStatuses : bookingStatuses
  const valid = !status || statuses.includes(status as never)
  const result = useQuery<PageResult<Appointment | Booking>>({
    queryKey: [kind, 'list', status, page, params.get('demo')],
    queryFn: () =>
      kind === 'appointments'
        ? appointmentService.list(status, page)
        : bookingService.list(status, page),
    enabled: valid,
    refetchInterval: 30000,
  })
  function change(nextStatus: string, nextPage = 1) {
    setParams({
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
      ...(params.get('demo') ? { demo: params.get('demo')! } : {}),
    })
  }
  return (
    <Page
      eyebrow="KHÔNG GIAN CÁ NHÂN"
      title={kind === 'appointments' ? 'Lịch xem phòng của bạn.' : 'Kế hoạch tìm nơi ở.'}
      description={
        kind === 'appointments'
          ? 'Theo dõi phản hồi từ chi nhánh và sắp xếp thời gian ghé xem.'
          : 'Theo dõi khoản giữ chỗ, thời hạn và từng bước xác nhận.'
      }
      actions={
        <Button asChild>
          <Link to="/rooms">
            Tìm thêm phòng
            <ArrowUpRight />
          </Link>
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{result.data?.totalElements || 0} yêu cầu</p>
        <select
          aria-label="Lọc trạng thái"
          className="input w-auto max-w-full"
          value={status}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
      </div>
      {!valid ? (
        <Notice>
          Trạng thái lọc không hợp lệ.{' '}
          <button className="underline" onClick={() => change('')}>
            Xem tất cả
          </button>
        </Notice>
      ) : (
        <QueryState
          pending={result.isPending}
          error={result.error}
          retry={result.refetch}
          empty={result.data?.content.length === 0}
          emptyMessage={
            status
              ? 'Chưa có yêu cầu ở trạng thái này. Thử xem tất cả trạng thái.'
              : 'Bạn chưa có yêu cầu nào. Khám phá phòng để đặt lịch xem hoặc giữ chỗ.'
          }
        >
          {result.data && (
            <>
              <Panel>
                {result.data.content.map((record) => (
                  <ActivityRow key={record.id} record={record} kind={kind} />
                ))}
              </Panel>
              <Pagination
                page={page}
                totalPages={result.data.totalPages}
                onPage={(next) => change(status, next)}
              />
            </>
          )}
        </QueryState>
      )}
    </Page>
  )
}
