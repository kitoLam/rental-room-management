import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './session-store'
import { Container } from '@/components/common/container'
import { Skeleton } from '@/components/ui/skeleton'
import { accountPath, dashboardPath } from './navigation'
import type { Role } from '@/interfaces/domain'

const workspaceRole: Record<string, Role> = {
  tenant: 'TENANT',
  manager: 'MANAGER',
  owner: 'OWNER',
  admin: 'ADMIN',
}

export function RouteGuard() {
  const { user, ready } = useSession()
  const location = useLocation()
  if (!ready)
    return (
      <Container className="py-12">
        <Skeleton className="h-48" />
        <p className="sr-only" role="status">
          Đang khôi phục phiên đăng nhập
        </p>
      </Container>
    )
  if (!user)
    return (
      <Navigate
        replace
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
      />
    )
  const prefix = location.pathname.split('/')[1]
  const requiredRole = workspaceRole[prefix]
  if (prefix === 'manager' && user.roles.includes('OWNER'))
    return (
      <Navigate
        replace
        to={{
          pathname: location.pathname.replace(/^\/manager(?=\/|$)/, '/owner'),
          search: location.search,
          hash: location.hash,
        }}
      />
    )
  if (requiredRole && !user.roles.includes(requiredRole)) {
    const section = location.pathname.split('/').slice(2).join('/')
    const compatible =
      prefix === 'tenant' &&
      /^(appointments|bookings|payments|contracts|profile|notifications)(\/|$)/.test(section)
    const target = compatible ? accountPath(user.roles, section) : dashboardPath(user.roles)
    return (
      <Navigate replace to={{ pathname: target, search: location.search, hash: location.hash }} />
    )
  }
  return <Outlet />
}
