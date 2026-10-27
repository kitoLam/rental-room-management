import { InlineError, Panel, QueryState } from '@/components/common/page'
import { useSession } from '@/features/auth/session-store'
import { dateOnly, dateTime, referenceLink } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { notificationService } from '@/services/guest-user'
import { tenantApi } from '@/services/tenant'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyRows, TenantLink, TenantPage } from './components'
import { isActive, tenantLink, useTenant, useTenantQuery } from './context'

export function TenantDashboard() {
  const { tenancy: t } = useTenant(),
    userId = useSession((s) => s.user!.id)
  const invoices = useTenantQuery('invoices', tenantApi.invoices, [], true),
    reports = useTenantQuery('maintenance', tenantApi.reports, [], true),
    services = useTenantQuery('services', tenantApi.services, [], true)
  const notifications = useQuery({
    queryKey: ['notifications', userId, 'tenant-dashboard'],
    queryFn: () => notificationService.list('', 1),
    refetchInterval: 30000,
  })
  const debt = (invoices.data || []).reduce((s, i) => s + i.outstanding, 0),
    due = (invoices.data || [])
      .filter((i) => i.outstanding > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return (
    <TenantPage
      title="Một nơi an tâm để ở."
      description={`${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''} — ${t.branchName}`}
      actions={
        <TenantLink to="/tenant/my-room" button>
          Xem chỗ ở
        </TenantLink>
      }
    >
      <QueryState pending={invoices.isPending} error={invoices.error} retry={invoices.refetch}>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Công nợ của bạn', formatVnd(debt)],
            ['Hạn thanh toán gần nhất', due ? dateOnly(due.dueDate) : 'Không có khoản đến hạn'],
            ['Hợp đồng', isActive(t) ? `Đến ${dateOnly(t.endDate)}` : 'Hồ sơ lịch sử'],
          ].map(([label, value]) => (
            <Panel key={label} className="sm:p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
            </Panel>
          ))}
        </div>
        <Panel>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-bold">Hóa đơn gần đây</h2>
            <TenantLink to="/tenant/invoices">Tất cả hóa đơn</TenantLink>
          </div>
          {invoices.data
            ?.filter((i) => i.documentStatus === 'ISSUED')
            .slice(0, 3)
            .map((i) => (
              <Link
                key={i.id}
                to={tenantLink(`/tenant/invoices/${i.id}`, t)}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4"
              >
                <div>
                  <p className="text-sm font-bold">{i.code}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kỳ {i.billingMonth.slice(0, 7)} · Hạn {dateOnly(i.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">{formatVnd(i.outstanding)}</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          {!invoices.data?.length && <EmptyRows />}
        </Panel>
      </QueryState>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <h2 className="mb-4 font-bold">Việc đang chờ</h2>
          <InlineError error={reports.error || services.error} />
          <p className="text-sm leading-7">
            <TenantLink to="/tenant/maintenance">
              Bảo trì:{' '}
              {reports.data?.filter((r) => ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status))
                .length ?? '…'}{' '}
              yêu cầu
            </TenantLink>
          </p>
          <TenantLink to="/tenant/services">
            Dịch vụ:{' '}
            {services.data?.filter((s) => ['PENDING', 'CANCEL_REQUESTED'].includes(s.status || ''))
              .length ?? '…'}{' '}
            chờ duyệt
          </TenantLink>
        </Panel>
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Cập nhật mới</h2>
            <Link to="/notifications" className="text-xs text-primary underline">
              Tất cả
            </Link>
          </div>
          <QueryState
            pending={notifications.isPending}
            error={notifications.error}
            retry={notifications.refetch}
            empty={notifications.data?.content.length === 0}
            emptyMessage="Chưa có cập nhật mới."
            emptyAction={null}
          >
            {notifications.data?.content.slice(0, 3).map((n) => {
              const to = referenceLink(n.referenceType, n.referenceId, n.contractTenantId)
              return (
                <div key={n.id} className="border-t border-border py-3 text-sm">
                  {to ? (
                    <Link to={to} className="font-bold hover:text-primary">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{dateTime(n.createdAt)}</p>
                </div>
              )
            })}
          </QueryState>
        </Panel>
      </div>
    </TenantPage>
  )
}
