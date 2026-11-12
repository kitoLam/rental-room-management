import { ManagementReports } from '@/features/dashboard/management-reports'
import { useOwner } from './context'

export function OwnerReports() {
  const { scope } = useOwner()
  return <ManagementReports role="owner" branchId={scope || undefined} />
}
