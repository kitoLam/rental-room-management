import { ManagementReports } from '@/features/dashboard/management-reports'
import { useSession } from '@/features/auth/session-store'
import { useManager } from './context'

export function ManagerReports() {
  const { branch, overviewBranchId } = useManager()
  const owner = useSession((s) => s.user?.roles.includes('OWNER'))
  return (
    <ManagementReports
      role={owner ? 'owner' : 'manager'}
      branchId={owner ? overviewBranchId : branch.id}
    />
  )
}
