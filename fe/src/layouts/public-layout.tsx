import { useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Bell, Menu, ArrowUpRight, LogOut } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Popover } from 'radix-ui'
import { Container } from '@/components/common/container'
import { Logo } from '@/components/common/logo'
import { InlineError, Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { dashboardPath } from '@/features/auth/navigation'
import { authService, notificationService } from '@/services/guest-user'
import { inboxService } from '@/services/inbox'
import { viewingAppointmentsPath } from '@/features/leasing/viewing-navigation'
import { tenantApi } from '@/services/tenant'
import { managerApi } from '@/services/manager'
import { queryClient } from '@/services/query-client'
import { hasMocks, provider } from '@/services/config'
import { TenantOverdueGate } from '@/features/tenant/tenant-debts-gate'
import { dateTime } from '@/lib/activity'
import { cn } from '@/lib/utils'
import { useHeaderOverlay } from './use-header-overlay'

export function SiteHeader() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const overlay = useHeaderOverlay(isHome)
  const [menu, setMenu] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const user = useSession((s) => s.user)
  const isStaffOnly = Boolean(
    user &&
    !user.roles.includes('TENANT') &&
    user.roles.some((r) => r === 'MANAGER' || r === 'OWNER' || r === 'ADMIN'),
  )
  const navigate = useNavigate()
  const tenancies = useQuery({
    queryKey: ['tenant', user?.id, 'tenancies'],
    queryFn: tenantApi.tenancies,
    enabled: !!user,
    retry: false,
  })
  const unread = useQuery({
    queryKey: ['notifications', user?.id, 'unread'],
    queryFn: async () =>
      provider('notifications') === 'real'
        ? { count: (await inboxService.list(false, 1, 1)).totalElements }
        : notificationService.unread(),
    enabled: !!user && !isStaffOnly,
    refetchInterval: 30000,
  })
  const preview = useQuery({
    queryKey: ['notifications', user?.id, 'preview'],
    queryFn: async () => {
      if (provider('notifications') === 'real') {
        const page = await inboxService.list(undefined, 1, 5)
        return page.content.map((item) => ({ ...item, read: Boolean(item.readAt) }))
      }
      const page = await notificationService.list()
      return page.content.slice(0, 5)
    },
    enabled: notificationsOpen && !!user && !isStaffOnly,
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
    onSettled: () => {
      useSession.getState().clear()
      queryClient.clear()
      setMenu(false)
      navigate('/login', { replace: true, flushSync: true })
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
        <Container wide className="flex h-18 items-center justify-between gap-3">
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
                {user.roles.includes('ADMIN') && (
                  <Link
                    to="/admin/dashboard"
                    className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex"
                  >
                    Quản trị
                  </Link>
                )}
                {user.roles.includes('OWNER') && (
                  <Link
                    to="/owner/dashboard"
                    className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex"
                  >
                    Chủ trọ
                  </Link>
                )}
                {!user.roles.includes('OWNER') &&
                  (user.roles.includes('MANAGER') || !!assignments.data?.length) && (
                    <Link
                      to="/manager/dashboard"
                      className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex"
                    >
                      Quản lý chi nhánh
                    </Link>
                  )}
                {!isStaffOnly && (user.roles.includes('TENANT') || !!tenancies.data?.length) && (
                  <Link
                    to="/tenant/dashboard"
                    className="hidden min-h-11 items-center text-sm font-bold text-primary sm:inline-flex"
                  >
                    Không gian thuê
                  </Link>
                )}
                {!isStaffOnly && (
                  <Popover.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                    <Popover.Trigger
                      type="button"
                      aria-label={`Thông báo${unread.data?.count ? `, ${unread.data.count} chưa đọc` : ''}`}
                      className="relative flex size-11 items-center justify-center rounded-lg hover:bg-primary/10"
                    >
                      <Bell size={20} aria-hidden="true" />
                      {!!unread.data?.count && (
                        <span className="absolute top-0 right-0 rounded-full bg-primary px-1.5 text-xs text-white">
                          {unread.data.count}
                        </span>
                      )}
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="end"
                        sideOffset={8}
                        collisionPadding={12}
                        aria-label="Thông báo gần đây"
                        className="z-40 flex max-h-[var(--radix-popover-content-available-height)] w-88 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-lg"
                      >
                        <h2 className="shrink-0 border-b border-border px-4 py-3 font-bold">Thông báo</h2>
                        <div className="min-h-0 overflow-y-auto" aria-busy={preview.isPending}>
                          {preview.isPending ? (
                            <p className="p-4 text-sm text-muted-foreground">Đang tải thông báo…</p>
                          ) : preview.isError ? (
                            <div className="p-4">
                              <InlineError error={preview.error} />
                              <Button variant="outline" className="mt-3" onClick={() => void preview.refetch()}>
                                Thử lại
                              </Button>
                            </div>
                          ) : preview.data.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">Chưa có thông báo.</p>
                          ) : (
                            <ul className="divide-y divide-border">
                              {preview.data.map((item) => (
                                <li key={item.id} className={cn('px-4 py-3', !item.read && 'bg-primary-soft')}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
                                    {!item.read && (
                                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" role="img" />
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.message}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{dateTime(item.createdAt)}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <Popover.Close asChild>
                          <Link
                            to="/notifications"
                            className="flex min-h-11 shrink-0 items-center justify-center gap-2 border-t border-border px-4 text-sm font-bold text-primary hover:bg-primary-soft"
                          >
                            Xem chi tiết thông báo
                            <ArrowUpRight size={16} aria-hidden="true" />
                          </Link>
                        </Popover.Close>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}
                <Button
                  asChild
                  variant={overlay ? 'overlay' : 'outline'}
                  className="hidden sm:inline-flex"
                >
                  {/* Tenants / plain users land on their account page; staff keep their workspace. */}
                  <Link to={isStaffOnly ? dashboardPath(user.roles) : '/profile'}>
                    {user.fullName}
                  </Link>
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
        <TenantOverdueGate />
      </header>
      <Modal
        open={menu}
        onOpenChange={setMenu}
        title={user ? `Chào ${user.fullName}` : 'Khám phá TroPro'}
        description="Một không gian phù hợp, một khởi đầu mới."
        drawer
      >
        <nav aria-label="Menu" className="grid gap-1">
          {(user
            ? [
                ['Tổng quan', dashboardPath(user.roles)],
                ...(!user.roles.includes('OWNER') &&
                (user.roles.includes('MANAGER') || assignments.data?.length)
                  ? [['Quản lý chi nhánh', '/manager/dashboard']]
                  : []),
                ...(user?.roles.includes('OWNER')
                  ? [['Không gian chủ trọ', '/owner/dashboard']]
                  : []),
                ...(user?.roles.includes('ADMIN')
                  ? [['Quản trị hệ thống', '/admin/dashboard']]
                  : []),
                ...(!isStaffOnly && (user?.roles.includes('TENANT') || tenancies.data?.length)
                  ? [['Không gian thuê', '/tenant/dashboard']]
                  : []),

                ['Tìm phòng', '/rooms'],
                ...(!user.roles.includes('ADMIN') ? [[
                  'Lịch xem phòng',
                  viewingAppointmentsPath(user.roles, { branchId: assignments.data?.[0]?.id }),
                ]] : []),
                ...(!user.roles.includes('ADMIN') ? [['Yêu cầu giữ chỗ', '/tenant/bookings']] : []),
                ...(!isStaffOnly ? [['Thông báo', '/notifications']] : []),
                ['Hồ sơ', user.roles.includes('ADMIN') ? '/admin/profile' : '/profile'],
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
      <Container wide className="flex flex-col justify-between gap-8 py-10 sm:flex-row">
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
