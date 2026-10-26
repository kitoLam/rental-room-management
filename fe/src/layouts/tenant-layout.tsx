import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  LayoutDashboard,
  House,
  FileText,
  ReceiptText,
  Wallet,
  Plug,
  Droplets,
  Wrench,
  Bell,
} from 'lucide-react'
import { useSession } from '@/features/auth/session-store'
import { tenantApi } from '@/services/tenant'
import { provider } from '@/services/config'
import { queryClient } from '@/services/query-client'
import { useTenancySelection, isActive, tenantLink } from '@/features/tenant/context'
import { Button } from '@/components/ui/button'
import { InlineError, Notice, QueryState } from '@/components/common/page'
import { Container } from '@/components/common/container'
const nav = [
  ['/tenant/dashboard', 'Tổng quan', LayoutDashboard],
  ['/tenant/my-room', 'Chỗ ở của tôi', House],
  ['/tenant/contracts', 'Hợp đồng', FileText],
  ['/tenant/invoices', 'Hóa đơn', ReceiptText],
  ['/tenant/payments', 'Thanh toán', Wallet],
  ['/tenant/services', 'Dịch vụ', Plug],
  ['/tenant/utilities', 'Điện & nước', Droplets],
  ['/tenant/maintenance', 'Bảo trì', Wrench],
] as const
export function TenantLayout() {
  const userId = useSession((s) => s.user!.id),
    selected = useTenancySelection((s) => s.byUser[userId]),
    select = useTenancySelection((s) => s.select)
  const [params] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate()
  const list = useQuery({
    queryKey: ['tenant', userId, 'tenancies', params.get('demo')],
    queryFn: tenantApi.tenancies,
  })
  const requested = params.get('tenancyId'),
    tenancies = list.data || []
  const tenancy = requested
    ? tenancies.find((t) => t.id === requested)
    : tenancies.find((t) => t.id === selected) || tenancies.find(isActive) || tenancies[0]
  const reset = useMutation({
    mutationFn: tenantApi.reset,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  return (
    <Container className="py-7 sm:py-10">
      <QueryState
        pending={list.isPending}
        error={list.error}
        retry={list.refetch}
        empty={list.data?.length === 0}
        emptyMessage="Tài khoản chưa có quan hệ thuê được cấp quyền. Giữ chỗ đã xác nhận chưa phải hợp đồng thuê."
        emptyAction={
          <Button asChild>
            <Link to="/user/dashboard">Về tài khoản</Link>
          </Button>
        }
      >
        {list.data && tenancies.length > 0 && !tenancy && (
          <Notice tone="warning">
            Không tìm thấy quan hệ thuê được phép truy cập.{' '}
            <Link to="/tenant/dashboard" className="underline">
              Về không gian thuê
            </Link>
          </Notice>
        )}
        {tenancy && (
          <div className="grid min-w-0 gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <div className="mb-5">
                <label
                  htmlFor="active-tenancy"
                  className="mb-2 block text-xs font-bold text-muted-foreground"
                >
                  QUAN HỆ THUÊ
                </label>
                <select
                  id="active-tenancy"
                  className="input w-full"
                  value={tenancy.id}
                  onChange={(e) => {
                    select(userId, e.target.value)
                    const target = tenancies.find((t) => t.id === e.target.value)!
                    const base =
                      nav.find(([path]) => location.pathname.startsWith(path))?.[0] ||
                      '/tenant/dashboard'
                    navigate(tenantLink(base, target))
                  }}
                >
                  {tenancies.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.roomName}
                      {t.slotName ? ` · ${t.slotName}` : ''}
                      {!isActive(t) ? ' · Lịch sử' : ''} — {t.branchName}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{tenancy.branchName}</p>
              </div>
              <nav aria-label="Không gian người thuê" className="hidden gap-1 lg:grid">
                {nav.map(([to, label, Icon]) => (
                  <NavLink
                    key={to}
                    to={tenantLink(to, tenancy)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-2 rounded-lg px-3 py-3 text-xs sm:text-sm ${isActive ? 'bg-primary-soft font-bold text-primary' : 'text-muted-foreground hover:bg-surface hover:text-foreground'}`
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <nav aria-label="Điều hướng người thuê trên di động" className="lg:hidden">
                <select
                  aria-label="Điều hướng người thuê"
                  className="input w-full"
                  value={
                    nav.find(([path]) => location.pathname.startsWith(path))?.[0] ||
                    '/tenant/dashboard'
                  }
                  onChange={(event) => navigate(tenantLink(event.target.value, tenancy))}
                >
                  {nav.map(([path, label]) => (
                    <option key={path} value={path}>
                      {label}
                    </option>
                  ))}
                </select>
              </nav>
              <div className="mt-4 hidden lg:grid lg:gap-1">
                <Link
                  to="/notifications"
                  className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground"
                >
                  <Bell size={17} />
                  Thông báo
                </Link>
                <Link
                  to="/user/dashboard"
                  className="min-h-11 px-3 py-3 text-sm text-muted-foreground"
                >
                  Về tài khoản
                </Link>
              </div>
              {import.meta.env.DEV && provider('tenant') === 'mock' && (
                <details className="mt-5 px-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer py-3">Công cụ demo</summary>
                  <p className="mb-3 leading-5">Dữ liệu mô phỏng, không phát sinh tiền thật.</p>
                  <Button
                    size="default"
                    variant="outline"
                    loading={reset.isPending}
                    onClick={() => reset.mutate()}
                  >
                    Đặt lại dữ liệu Tenant
                  </Button>
                  <InlineError error={reset.error} />
                </details>
              )}
            </aside>
            <div className="min-w-0">
              {!isActive(tenancy) && (
                <div className="mb-6">
                  <Notice>
                    Quan hệ thuê đã kết thúc hoặc chưa hiệu lực. Bạn có thể xem hồ sơ; các thao tác
                    yêu cầu thuê đang hiệu lực được khóa.
                  </Notice>
                </div>
              )}
              <Outlet key={`${userId}-${tenancy.id}`} context={{ tenancy, tenancies }} />
            </div>
          </div>
        )}
      </QueryState>
    </Container>
  )
}
