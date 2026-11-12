import { ManagementOverview } from '@/features/dashboard/management-overview'
import { useOwner } from './context'

export function OwnerDashboard() {
  const { scope } = useOwner()
  return <ManagementOverview role="owner" branchId={scope || undefined} />
}
