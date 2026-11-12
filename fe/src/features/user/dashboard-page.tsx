import { Navigate } from 'react-router'
import { useSession } from '@/features/auth/session-store'
import { dashboardPath } from '@/features/auth/navigation'

// Keep old bookmarks working while Tenant now has a single dashboard.
export default function DashboardPage() {
  const user = useSession((s) => s.user)
  return <Navigate replace to={dashboardPath(user?.roles ?? [])} />
}
