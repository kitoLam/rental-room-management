import { Notice } from '@/components/common/page'
import { type OwnedBranch } from '@/interfaces/owner'
import { OwnerPage } from './components'
import { useOwner } from './context'
import { AssignmentCard } from './manager-shared'
export function OwnerAssignments() {
  const { branches, scope } = useOwner()
  return (
    <OwnerPage
      title="Phân công quản lý"
      description="Một quản lý có thể phụ trách nhiều chi nhánh thuộc cùng chủ trọ."
    >
      {branches
        .filter((b): b is OwnedBranch => 'version' in b)
        .filter((b) => !scope || b.id === scope)
        .map((b) => (
          <AssignmentCard key={`${b.id}:${b.version}`} branch={b} />
        ))}
      {branches.length === 0 && <Notice>Tạo chi nhánh để bắt đầu phân công.</Notice>}
      {branches.some((b) => !('version' in b)) && (
        <Notice>Phân công quản lý cho chi nhánh mới hiện chưa khả dụng.</Notice>
      )}
    </OwnerPage>
  )
}
