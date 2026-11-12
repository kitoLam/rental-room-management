import { BranchTenantAccountsSection } from '@/features/manager/branch-tenant-accounts-section'
import { branchTenantsService } from '@/services/branch-tenants'
import { useQuery } from '@tanstack/react-query'
import { OwnerPage } from './components'
import { useOwner } from './context'

export function OwnerTenantsPage() {
  const { branches, scope } = useOwner()
  const managedBranches = useQuery({
    queryKey: ['owner-managed-branches-for-tenants'],
    queryFn: () => branchTenantsService.managedBranches('owner'),
    enabled: branches.length === 0,
  })
  const availableBranches =
    branches.length > 0
      ? branches.map((b) => ({ id: b.id, name: b.name }))
      : (managedBranches.data || []).map((b) => ({ id: b.id, name: b.name }))

  return (
    <OwnerPage
      title="Quản lý tài khoản"
      description="Lọc và tìm kiếm danh sách Tenant và Manager thuộc phạm vi các cơ sở sở hữu, nâng/hạ vai trò giữa Tenant và Manager, tạo tài khoản Tenant (gửi link qua Gmail) và Active/Inactive tại cơ sở."
    >
      <BranchTenantAccountsSection
        branchId={scope || undefined}
        branches={availableBranches}
        feature="owner"
        allowBranchSelect
      />
    </OwnerPage>
  )
}
export default OwnerTenantsPage
