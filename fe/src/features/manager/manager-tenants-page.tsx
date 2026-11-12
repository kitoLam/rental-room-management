import { useSession } from '@/features/auth/session-store'
import { BranchTenantAccountsSection } from './branch-tenant-accounts-section'
import { ManagerLink, ManagerPage } from './components'
import { useManager } from './context'

export function ManagerTenants() {
  const { branch, branches } = useManager()
  const user = useSession((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))

  return (
    <ManagerPage
      title="Quản lý tài khoản"
      description={
        isOwner
          ? 'Quản lý tài khoản Tenant và Manager thuộc phạm vi cơ sở sở hữu: lọc, tìm kiếm, nâng/hạ vai trò và Active/Inactive tại cơ sở.'
          : 'Quản lý danh sách tài khoản người thuê (Tenant) thuộc cơ sở được phân công.'
      }
      actions={
        <ManagerLink to="/manager/bookings" button>
          Mở booking để lập hợp đồng
        </ManagerLink>
      }
    >
      <BranchTenantAccountsSection
        branchId={branch.id}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        feature={isOwner ? 'owner' : 'manager'}
        allowBranchSelect={isOwner}
      />
    </ManagerPage>
  )
}
