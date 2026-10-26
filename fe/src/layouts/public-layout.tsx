import { useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Bell, Menu, ArrowUpRight, LogOut } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Container } from '@/components/common/container'
import { Logo } from '@/components/common/logo'
import { InlineError, Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { authService, notificationService } from '@/services/guest-user'
import { tenantApi } from '@/services/tenant'
import { managerApi } from '@/services/manager'
import { queryClient } from '@/services/query-client'
import { hasMocks } from '@/services/config'
import { cn } from '@/lib/utils'
import { useHeaderOverlay } from './use-header-overlay'

export function SiteHeader() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const overlay = useHeaderOverlay(isHome)
  const [menu, setMenu] = useState(false)
  const user = useSession((s) => s.user)
  const navigate = useNavigate()
  const tenancies = useQuery({
    queryKey: ['tenant', user?.id, 'tenancies'],
    queryFn: tenantApi.tenancies,
    enabled: !!user,
    retry: false,
  })
  const unread = useQuery({
    queryKey: ['notifications', 'unread', user?.id],
    queryFn: notificationService.unread,
    enabled: !!user,
    refetchInterval: 30000,
  })
  const assignments = useQuery({
    queryKey: ['manager-branches', user?.id],
    queryFn: managerApi.branches,
    enabled: !!user && user.roles.some((r) => r === 'MANAGER' || r === 'OWNER'),
    retry: false,
    refetchInterval: 5000,
  })
  const logout = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      navigate('/', { replace: true, flushSync: true })
      useSession.getState().clear()
      queryClient.clear()
      setMenu(false)
    },
  })
  return (
    <>
      <header
        className={cn(
          'top-0 z-30 border-b transition-colors',
          isHome ? 'fixed inset-x-0' : 'sticky',
          overlay
            ? 'border-transparent bg-transparent text-white'
            : 'border-border/70 bg-surface text-foreground',
        )}
      >
        <Container className="flex h-18 items-center justify-between gap-3">
          <Logo inverted={overlay} />
          <nav aria-label="Điều hướng chính" className="flex items-center gap-2 sm:gap-5">
            <NavLink
              to="/rooms"
              className="hidden min-h-11 items-center text-sm font-bold hover:underline sm:inline-flex"
            >
              Tìm phòng
            </NavLink>
            <Link
              to="/#how-it-works"
              className="hidden min-h-11 items-center text-sm lg:inline-flex"
            >
              Cách thuê phòng
            </Link>
            {user ? (
              <>
                {user.roles.includes('ADMIN') && <Link to="/admin/dashboard" className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex">Quản trị</Link>}
                {user.roles.includes('OWNER') && <Link to="/owner/dashboard" className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex">Chủ trọ</Link>}
                {!!assignments.data?.length && (
                  <Link
                    to="/manager/dashboard"
                    className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex"
                  >
                    Quản lý chi nhánh
                  </Link>
                )}
                {!!tenancies.data?.length && (
                  <Link
                    to="/tenant/dashboard"
                    className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex"
                  >
                    Không gian thuê
                  </Link>
                )}
                <Link
                  to="/notifications"
                  aria-label={`Thông báo${unread.data?.count ? `, ${unread.data.count} chưa đọc` : ''}`}
                  className="relative flex size-11 items-center justify-center rounded-lg hover:bg-primary/10"
                >
                  <Bell size={20} />
                  {(unread.data?.count || 0) > 0 && (
                    <span className="absolute top-0 right-0 rounded-full bg-primary px-1.5 text-xs text-white">
                      {unread.data!.count}
                    </span>
                  )}
                </Link>
                <Button
                  asChild
                  variant={overlay ? 'overlay' : 'outline'}
                  className="hidden sm:inline-flex"
                >
                  <Link to="/user/dashboard">{user.fullName.split(' ').at(-1)}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant={overlay ? 'overlay' : 'outline'}>
                  <Link to="/login">Đăng nhập</Link>
                </Button>
                <Button asChild className="hidden sm:inline-flex">
                  <Link to="/register">Đăng ký</Link>
                </Button>
              </>
            )}
            <button
              type="button"
              aria-label="Mở menu"
              aria-expanded={menu}
              className="flex size-11 items-center justify-center rounded-lg hover:bg-primary/10"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
          </nav>
        </Container>
      </header>
      <Modal
        open={menu}
        onOpenChange={setMenu}
        title={user ? `Chào ${user.fullName.split(' ').at(-1)}` : 'Khám phá TroPro'}
        description="Một không gian phù hợp, một khởi đầu mới."
        drawer
      >
        <nav aria-label="Menu" className="grid gap-1">
          {(user
            ? [
                ['Tổng quan', '/user/dashboard'],
                ...(assignments.data?.length ? [['Quản lý chi nhánh', '/manager/dashboard']] : []),
                ...(user?.roles.includes('OWNER') ? [['Không gian chủ trọ', '/owner/dashboard']] : []),
                ...(user?.roles.includes('ADMIN') ? [['Quản trị hệ thống', '/admin/dashboard']] : []),
                ...(tenancies.data?.length ? [['Không gian thuê', '/tenant/dashboard']] : []),
                ['Tìm phòng', '/rooms'],
                ['Lịch xem phòng', '/user/appointments'],
                ['Yêu cầu giữ chỗ', '/user/bookings'],
                ['Thông báo', '/notifications'],
                ['Hồ sơ', '/profile'],
              ]
            : [
                ['Trang chủ', '/'],
                ['Tìm phòng', '/rooms'],
                ['Đăng nhập', '/login'],
                ['Tạo tài khoản', '/register'],
                ['Dành cho chủ trọ', '/owner-onboarding'],
              ]
          ).map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 items-center justify-between rounded-lg px-3 text-sm hover:bg-primary-soft',
                  isActive && 'bg-primary-soft font-bold text-primary',
                )
              }
            >
              {label}
              <ArrowUpRight size={16} />
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="mt-6 border-t border-border pt-5">
            <InlineError error={logout.error} />
            <Button
              variant="outline"
              loading={logout.isPending}
              className="mt-3 w-full"
              onClick={() => logout.mutate()}
            >
              <LogOut />
              Đăng xuất
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="flex flex-col justify-between gap-8 py-10 sm:flex-row">
        <div>
          <Logo />
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Một nơi ở phù hợp. Một nhịp sống của riêng bạn.
          </p>
          {hasMocks && (
            <p className="mt-3 text-xs text-muted-foreground">
              Bản trải nghiệm có dữ liệu mô phỏng. Không chuyển tiền thật.
            </p>
          )}
        </div>
        <nav aria-label="Liên kết cuối trang" className="grid content-start gap-1 text-sm">
          <Link className="min-h-11 py-3 hover:text-primary" to="/rooms">
            Khám phá phòng
          </Link>
          <Link className="min-h-11 py-3 hover:text-primary" to="/owner-onboarding">
            Dành cho chủ trọ
          </Link>
          <Link className="min-h-11 py-3 hover:text-primary" to="/#faq">
            Câu hỏi thường gặp
          </Link>
        </nav>
        <p className="self-end text-xs text-muted-foreground">
          © {new Date().getFullYear()} TroPro
        </p>
      </Container>
    </footer>
  )
}
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Đến nội dung chính
      </a>
      <SiteHeader />
      <main id="main" className="min-w-0 flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
