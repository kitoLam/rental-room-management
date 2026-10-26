import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './session-store'
import { Container } from '@/components/common/container'
import { Skeleton } from '@/components/ui/skeleton'
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
  return <Outlet />
}
