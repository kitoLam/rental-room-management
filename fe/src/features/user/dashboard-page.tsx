import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarDays, KeyRound, Search } from 'lucide-react'
import { Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/empty-state'
import { useSession } from '@/features/auth/session-store'
import { dashboardPath } from '@/features/auth/navigation'
import { bookingService, notificationService } from '@/services/guest-user'
import { viewingDependenciesService } from '@/services/viewing-dependencies'
import { ViewingAppointmentBadge } from '@/features/leasing/viewing-appointment-pages'
import { viewingDateTime } from '@/features/leasing/viewing-time'
import { viewingAppointmentsPath } from '@/features/leasing/viewing-navigation'
import { ActivityRow } from '@/features/leasing/activity-pages'
import { dateTime, referenceLink } from '@/lib/activity'
import { provider } from '@/services/config'
import { useNow } from '@/hooks/use-now'
export default function DashboardPage() {
  const user = useSession((state) => state.user)
  const home = dashboardPath(user?.roles ?? [])
  if (home !== '/user/dashboard') return <Navigate to={home} replace />
  return <PersonalDashboard />
}

function PersonalDashboard() {
  const now = useNow()
  const user = useSession((s) => s.user)
  const appointments = useQuery({
    queryKey: ['viewing-appointments', 'dashboard'],
    queryFn: () => viewingDependenciesService.appointments(),
    refetchInterval: 30000,
  })
  const bookings = useQuery({
    queryKey: ['bookings', 'dashboard'],
    queryFn: () => bookingService.list(),
    refetchInterval: 15000,
  })
  const notifications = useQuery({
    queryKey: ['viewing-notifications', 'dashboard', user?.id],
    queryFn: async () => {
      if (provider('viewing') === 'real') return viewingDependenciesService.notifications()
      const page = await notificationService.list()
      return { ...page, content: page.content.map((item) => ({
        ...item,
        detailPath: referenceLink(item.referenceType, item.referenceId, item.contractTenantId, item.branchId) || '/notifications',
      })) }
    },
  })
  const upcoming = appointments.data?.content
    .filter((a) => ['PENDING', 'CONFIRMED'].includes(a.status) && Date.parse(a.startAt ?? '') > now)
    .slice(0, 3)
  const active = bookings.data?.content
    .filter((b) => ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(b.status))
    .slice(0, 3)
  return (
    <Page
      eyebrow="KHÔNG GIAN CÁ NHÂN"
      title={`Chào ${user?.fullName.split(' ').at(-1) || 'bạn'}, kế hoạch tiếp theo là gì?`}
      description="Lịch hẹn, giữ chỗ và những cập nhật cần chú ý — tất cả ở đây."
      actions={
        <Button asChild>
          <Link to="/rooms">
            <Search />
            Khám phá phòng
          </Link>
        </Button>
      }
    >
      <section className="mb-8 flex flex-col justify-between gap-5 rounded-xl bg-primary-soft px-6 py-7 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold">Một nơi ở hợp với nhịp sống của bạn</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tiếp tục khám phá, hoặc ghé xem không gian bạn đã chọn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/tenant/maintenance"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Yêu cầu hỗ trợ & Sửa chữa
            <ArrowUpRight size={18} />
          </Link>
          <Link
            to="/rooms"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-primary"
          >
            Tìm nơi ở tiếp theo
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <div className="grid items-start gap-7 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <CalendarDays size={18} className="text-primary" />
              Lịch hẹn sắp tới
            </h2>
            <Link className="min-h-11 py-3 text-xs text-primary underline" to={viewingAppointmentsPath(user?.roles ?? [], { branchId: appointments.data?.content[0]?.branchId })}>
              Xem tất cả
            </Link>
          </div>
          <QueryState
            pending={appointments.isPending}
            error={appointments.error}
            retry={appointments.refetch}
          >
            {upcoming?.length ? (
              upcoming.map((a) => (
                <article key={a.id} className="border-b border-border py-4 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      className="text-sm font-bold text-primary"
                      to={viewingAppointmentsPath(user?.roles ?? [], { appointmentId: a.id, branchId: a.branchId })}
                    >
                      {a.roomNumber}
                    </Link>
                    <ViewingAppointmentBadge status={a.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {a.branchName} · {viewingDateTime(a.startAt)}
                  </p>
                </article>
              ))
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Chưa có lịch xem sắp tới. Tìm phòng phù hợp rồi chọn một buổi ghé xem."
              />
            )}
          </QueryState>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <KeyRound size={18} className="text-primary" />
              Giữ chỗ đang theo dõi
            </h2>
            <Link className="min-h-11 py-3 text-xs text-primary underline" to="/user/bookings">
              Xem tất cả
            </Link>
          </div>
          <QueryState pending={bookings.isPending} error={bookings.error} retry={bookings.refetch}>
            {active?.length ? (
              active.map((b) => <ActivityRow key={b.id} record={b} kind="bookings" />)
            ) : (
              <EmptyState
                icon={KeyRound}
                title="Chưa có yêu cầu giữ chỗ đang mở. Bạn có thể giữ phòng trực tiếp, không cần lịch xem trước."
              />
            )}
          </QueryState>
        </Panel>
      </div>
      <section className="mt-9">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Cập nhật lịch xem phòng</h2>
          <Link to="/notifications/viewing" className="min-h-11 py-3 text-sm text-primary underline">
            Xem thông báo
          </Link>
        </div>
        <QueryState
          pending={notifications.isPending}
          error={notifications.error}
          retry={notifications.refetch}
          empty={notifications.data?.content.length === 0}
        >
          <Panel>
            {notifications.data?.content.slice(0, 3).map((n) => {
              const to = n.detailPath
              return (
                <Link
                  key={n.id}
                  to={to}
                  className="block border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{dateTime(n.createdAt)}</p>
                </Link>
              )
            })}
          </Panel>
        </QueryState>
      </section>
    </Page>
  )
}
