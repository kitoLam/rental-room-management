import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  House,
  ReceiptText,
  Plug,
  Zap,
  Wrench,
  Bell,
  FileSignature,
  ArrowRight,
} from 'lucide-react'
import { useSession } from '@/features/auth/session-store'
import { tenantApi } from '@/services/tenant'
import { useTenancySelection, isActive, tenantLink } from '@/features/tenant/context'
import { Notice, QueryState } from '@/components/common/page'
import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { dashboardPath } from '@/features/auth/navigation'

// Account pages (profile, viewings, bookings, payments, contracts) live in UserLayout,
// reached from the header avatar — the rental space only holds tenancy-scoped pages.
const nav = [
  ['/tenant/dashboard', 'Tổng quan', LayoutDashboard],
  ['/tenant/my-room', 'Phòng của tôi', House],
  ['/tenant/invoices', 'Hóa đơn', ReceiptText],
  ['/tenant/services', 'Dịch vụ tự chọn', Plug],
  ['/tenant/utilities', 'Tiền điện', Zap],
  ['/tenant/maintenance', 'Yêu cầu hỗ trợ', Wrench],
  ['/notifications', 'Thông báo', Bell],
] as const
const accountPages = ['/tenant/dashboard', '/notifications']
const needsTenancy = (path: string) =>
  path.startsWith('/tenant/') &&
  !['/tenant/appointments', '/tenant/bookings'].some(
    (base) => path === base || path.startsWith(base + '/'),
  )

export function TenantLayout() {
  const user = useSession((s) => s.user!)
  const selected = useTenancySelection((s) => s.byUser[user.id])
  const select = useTenancySelection((s) => s.select)
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const list = useQuery({
    queryKey: ['tenant', user.id, 'tenancies'],
    queryFn: tenantApi.tenancies,
    retry: false,
    enabled: user.roles.includes('TENANT'),
  })
  const tenancies = list.data || []
  const requested = params.get('tenancyId')
  const tenancy = requested
    ? tenancies.find((t) => t.id === requested || t.contractId === requested)
    : tenancies.find((t) => t.id === selected || t.contractId === selected) ||
      tenancies.find(isActive) ||
      tenancies[0]
  const unscoped = accountPages.some(
    (path) => location.pathname === path || location.pathname.startsWith(path + '/'),
  )
  const route =
    nav.find(
      ([path]) => location.pathname === path || location.pathname.startsWith(path + '/'),
    )?.[0] || '/tenant/dashboard'
  const href = (path: string) => (needsTenancy(path) && tenancy ? tenantLink(path, tenancy) : path)
  if (!user.roles.includes('TENANT')) return <Navigate replace to={dashboardPath(user.roles)} />
  // No approved slot yet: show one call-to-action screen instead of an empty rental space.
  if (list.isSuccess && tenancies.length === 0 && location.pathname !== '/notifications')
    return (
      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <FileSignature size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-foreground sm:text-3xl">
            Bạn chưa có không gian thuê
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Không gian thuê chỉ mở sau khi hợp đồng của bạn được ký kết. Hãy ký và nộp bản hợp đồng
            đã ký; khi quản lý duyệt xong, chỗ ở của bạn sẽ xuất hiện tại đây.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/user/contracts">
                Đến hợp đồng của tôi
                <ArrowRight size={18} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/rooms">Tìm phòng</Link>
            </Button>
          </div>
        </div>
      </Container>
    )
  return (
    <Container wide className="py-7 sm:py-10">
      <div className="grid min-w-0 gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="mb-5">
            <label
              htmlFor="active-tenancy"
              className="mb-2 block text-xs font-bold text-muted-foreground"
            >
              KHÔNG GIAN THUÊ
            </label>
            {tenancies.length > 0 ? (
              <>
                <select
                  id="active-tenancy"
                  className="input w-full"
                  value={tenancy?.id || ''}
                  onChange={(event) => {
                    const target = tenancies.find((t) => t.id === event.target.value)!
                    select(user.id, target.id)
                    navigate(needsTenancy(route) ? tenantLink(route, target) : route)
                  }}
                >
                  {!tenancy && <option value="">Chọn quan hệ thuê</option>}
                  {tenancies.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.roomName}
                      {t.slotName ? ` · ${t.slotName}` : ''}
                      {!isActive(t) ? ' · Lịch sử / chưa hiệu lực' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {tenancy?.branchName || 'Chọn một quan hệ thuê thuộc tài khoản.'}
                </p>
              </>
            ) : (
              <p className="text-xs leading-6 text-muted-foreground">
                {list.isPending
                  ? 'Đang tải chỗ ở…'
                  : list.error
                    ? 'Chưa tải được chỗ ở.'
                    : 'Chưa có quan hệ thuê. Bạn vẫn có thể xem lịch hẹn và yêu cầu giữ phòng.'}
              </p>
            )}
          </div>
          <nav aria-label="Không gian người thuê" className="hidden gap-1 lg:grid">
            {nav.map(([path, label, Icon]) => (
              <NavLink
                key={path}
                to={href(path)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-lg px-3 py-3 text-sm ${isActive ? 'bg-primary-soft font-bold text-primary' : 'text-muted-foreground hover:bg-surface hover:text-foreground'}`
                }
              >
                <Icon size={17} className="shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <nav aria-label="Điều hướng người thuê trên di động" className="lg:hidden">
            <select
              className="input w-full"
              aria-label="Điều hướng người thuê"
              value={route}
              onChange={(event) => navigate(href(event.target.value))}
            >
              {nav.map(([path, label]) => (
                <option key={path} value={path}>
                  {label}
                </option>
              ))}
            </select>
          </nav>
        </aside>
        <div className="min-w-0">
          {unscoped ? (
            <Outlet
              key={`${user.id}-${tenancy?.id || 'account'}`}
              context={{ tenancy, tenancies }}
            />
          ) : (
            <QueryState pending={list.isPending} error={list.error} retry={list.refetch}>
              {tenancy ? (
                <>
                  {!isActive(tenancy) && (
                    <div className="mb-6">
                      <Notice>
                        Quan hệ thuê đã kết thúc hoặc chưa hiệu lực. Bạn có thể xem hồ sơ; các thao
                        tác yêu cầu thuê đang hiệu lực được khóa.
                      </Notice>
                    </div>
                  )}
                  <Outlet key={`${user.id}-${tenancy.id}`} context={{ tenancy, tenancies }} />
                </>
              ) : (
                <Notice>
                  {requested
                    ? 'Không tìm thấy quan hệ thuê thuộc tài khoản trong liên kết này.'
                    : 'Mục này cần hợp đồng thuê đã được duyệt. Nộp bản ký ở mục Hợp đồng; quản lý duyệt xong bạn dùng được mục này.'}{' '}
                  <Link to="/user/contracts" className="font-semibold underline">
                    Mở hợp đồng
                  </Link>
                </Notice>
              )}
            </QueryState>
          )}
        </div>
      </div>
    </Container>
  )
}
