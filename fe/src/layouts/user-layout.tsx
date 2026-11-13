import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  House,
  KeyRound,
  UserRound,
  Wallet,
} from 'lucide-react'
import { Container } from '@/components/common/container'
import { cn } from '@/lib/utils'
import { useSession } from '@/features/auth/session-store'
import { dashboardPath } from '@/features/auth/navigation'
import { useManagerSelection } from '@/features/manager/context'
import { viewingAppointmentsPath } from '@/features/leasing/viewing-navigation'
import { TenantLayout } from './tenant-layout'

/** Account pages live outside the rental space: they work before any contract is approved. */
const accountPrefixes = [
  '/profile',
  '/tenant/appointments',
  '/tenant/bookings',
  '/user/payments',
  '/user/contracts',
]
const isAccountPage = (pathname: string) =>
  accountPrefixes.some((path) => pathname === path || pathname.startsWith(path + '/'))

export function UserLayout() {
  const user = useSession((state) => state.user)
  const location = useLocation()
  const navigate = useNavigate()
  const branchId = useManagerSelection((state) => (user ? state.byUser[user.id] : undefined))
  if (user?.roles.includes('ADMIN') && location.pathname === '/profile')
    return (
      <Navigate
        to={{ pathname: '/admin/profile', search: location.search, hash: location.hash }}
        replace
      />
    )
  const roles = user?.roles ?? []
  const isTenant = roles.includes('TENANT')
  if (isTenant && !isAccountPage(location.pathname)) return <TenantLayout />
  const isStaff = roles.some((r) => r === 'MANAGER' || r === 'OWNER' || r === 'ADMIN')
  const items = [
    { to: '/profile', label: 'Hồ sơ', icon: UserRound },
    {
      to: viewingAppointmentsPath(roles, { branchId }),
      label: 'Lịch xem phòng',
      icon: CalendarDays,
    },
    { to: '/tenant/bookings', label: 'Giữ chỗ', icon: KeyRound },
    { to: '/user/payments', label: 'Thanh toán', icon: Wallet },
    { to: '/user/contracts', label: 'Hợp đồng', icon: FileText },
  ]
  const current =
    items.find(
      ({ to }) =>
        location.pathname === to.split('?')[0] || location.pathname.startsWith(to.split('?')[0] + '/'),
    )?.to ?? '/profile'
  const workspace = isTenant
    ? { to: '/tenant/dashboard', label: 'Không gian thuê' }
    : isStaff
      ? { to: dashboardPath(roles), label: 'Không gian quản lý' }
      : null
  return (
    <Container wide className="py-7 sm:py-10">
      <div className="grid min-w-0 gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{user?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <p className="mb-2 text-xs font-bold text-muted-foreground">TÀI KHOẢN</p>
          <nav aria-label="Tài khoản cá nhân" className="hidden gap-1 lg:grid">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-2 rounded-lg px-3 py-3 text-sm',
                    isActive
                      ? 'bg-primary-soft font-bold text-primary'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                  )
                }
              >
                <Icon size={17} className="shrink-0" />
                {label}
              </NavLink>
            ))}
            {workspace && (
              <NavLink
                to={workspace.to}
                className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 py-3 text-sm font-semibold text-primary hover:bg-primary-soft"
              >
                <span className="flex items-center gap-2">
                  <House size={17} className="shrink-0" />
                  {workspace.label}
                </span>
                <ArrowUpRight size={15} />
              </NavLink>
            )}
          </nav>
          <nav aria-label="Điều hướng tài khoản trên di động" className="lg:hidden">
            <select
              className="input w-full"
              aria-label="Điều hướng tài khoản"
              value={current}
              onChange={(event) => navigate(event.target.value)}
            >
              {items.map(({ to, label }) => (
                <option key={to} value={to}>
                  {label}
                </option>
              ))}
              {workspace && <option value={workspace.to}>{workspace.label} →</option>}
            </select>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </Container>
  )
}
