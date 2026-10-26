import { useEffect } from 'react'
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Container } from '@/components/common/container'
import { Notice, QueryState } from '@/components/common/page'
import { useSession } from '@/features/auth/session-store'
import { adminApi } from '@/services/admin'
import { queryClient } from '@/services/query-client'
import type { Role } from '@/interfaces/domain'
const workspaceRoles: Record<string, Role> = {
  '/user/dashboard': 'USER',
  '/owner/dashboard': 'OWNER',
  '/manager/dashboard': 'MANAGER',
  '/tenant/dashboard': 'TENANT',
  '/admin/dashboard': 'ADMIN',
}
const groups: [string, [string, string][]][] = [
  ['Tổng quan', [['dashboard', 'Tổng quan']]],
  [
    'Tài khoản',
    [
      ['users', 'Người dùng'],
      ['owner-verifications', 'Xác minh chủ trọ'],
      ['roles', 'Vai trò & quyền'],
    ],
  ],
  [
    'Nền tảng',
    [
      ['owners', 'Danh bạ chủ trọ'],
      ['branches', 'Danh bạ chi nhánh'],
      ['activity', 'Nhật ký hoạt động'],
    ],
  ],
]
export function AdminLayout() {
  const user = useSession((s) => s.user!),
    location = useLocation(),
    navigate = useNavigate(),
    allowed = user.roles.includes('ADMIN')
  const entitlement = useQuery({
    queryKey: ['admin-entitlements', user.id],
    queryFn: adminApi.entitlements,
    enabled: allowed,
    retry: false,
    refetchInterval: 3000,
    staleTime: 0,
  })
  useEffect(() => {
    if (allowed) useSession.getState().setActiveRole('ADMIN')
    if (!allowed || entitlement.error) queryClient.removeQueries({ queryKey: ['admin'] })
    if (
      entitlement.data?.user.id === user.id &&
      JSON.stringify(entitlement.data.user) !== JSON.stringify(user)
    )
      useSession.getState().updateUser(entitlement.data.user)
  }, [allowed, entitlement.data, entitlement.error, user])
  const route =
    groups
      .flatMap(([, items]) => items)
      .find(([p]) => location.pathname.startsWith(`/admin/${p}`))?.[0] || 'dashboard'
  return (
    <Container className="py-7 sm:py-10">
      {!allowed ? (
        <Notice tone="warning">
          Bạn không có quyền quản trị hệ thống.{' '}
          <Link className="font-bold underline" to="/user/dashboard">
            Về tài khoản
          </Link>
        </Notice>
      ) : (
        <QueryState
          pending={entitlement.isPending}
          error={entitlement.error}
          retry={entitlement.refetch}
        >
          <div className="grid min-w-0 gap-8 lg:grid-cols-[205px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <p className="mb-5 hidden items-center gap-2 text-sm font-bold text-primary lg:flex">
                <ShieldCheck size={20} />
                QUẢN TRỊ HỆ THỐNG
              </p>
              <nav aria-label="Điều hướng quản trị" className="hidden lg:block">
                {groups.map(([group, items]) => (
                  <div className="mb-4" key={group}>
                    <p className="mb-1 px-3 text-[11px] font-bold uppercase text-muted-foreground">
                      {group}
                    </p>
                    {items.map(([p, label]) => (
                      <NavLink
                        key={p}
                        to={`/admin/${p}`}
                        className={({ isActive }) =>
                          `flex min-h-11 items-center rounded-lg px-3 text-sm ${isActive ? 'bg-primary-soft font-bold text-primary' : 'text-muted-foreground hover:bg-surface'}`
                        }
                      >
                        {label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>
              <select
                aria-label="Điều hướng quản trị"
                className="input lg:hidden"
                value={route}
                onChange={(e) => navigate(`/admin/${e.target.value}`)}
              >
                {groups.map(([g, items]) => (
                  <optgroup label={g} key={g}>
                    {items.map(([p, label]) => (
                      <option value={p} key={p}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="mt-3 flex gap-5 text-sm font-bold text-primary lg:mt-5 lg:grid lg:gap-3">
                <Link to="/notifications">Thông báo</Link>
                <Link to="/profile">Hồ sơ cá nhân</Link>
              </div>
              <label
                className="sr-only text-xs font-bold text-muted-foreground lg:not-sr-only lg:mt-6 lg:block"
                htmlFor="admin-workspace"
              >
                KHÔNG GIAN LÀM VIỆC
              </label>
              <select
                id="admin-workspace"
                className="input mt-2"
                value="/admin/dashboard"
                onChange={(e) => {
                  const role = workspaceRoles[e.target.value]
                  if (role) useSession.getState().setActiveRole(role)
                  navigate(e.target.value)
                }}
              >
                <option value="/admin/dashboard">Quản trị hệ thống</option>
                <option value="/user/dashboard">Tài khoản của tôi</option>
                {user.roles.includes('OWNER') && <option value="/owner/dashboard">Chủ trọ</option>}
                {user.roles.includes('MANAGER') && (
                  <option value="/manager/dashboard">Quản lý</option>
                )}
                {user.roles.includes('TENANT') && (
                  <option value="/tenant/dashboard">Người thuê</option>
                )}
              </select>
            </aside>
            <main className="min-w-0">
              <Outlet />
            </main>
          </div>
        </QueryState>
      )}
    </Container>
  )
}
