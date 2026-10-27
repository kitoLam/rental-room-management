import { useProperty } from './hooks/use-property'
import { Notice, QueryState } from '@/components/common/page'
import { databaseIdSchema } from '@/interfaces/domain'
import { useParams } from 'react-router'
import { OwnerPage } from './components'
import { BackToBranches, PropertyForm } from './property-shared'
export function OwnerPropertyEditor() {
  const { branchId = '' } = useParams()
  const query = useProperty(branchId)
  return (
    <OwnerPage
      title={branchId ? 'Cập nhật chi nhánh' : 'Đăng ký chi nhánh'}
      description="Khai báo thông tin căn hộ hoặc nhà trọ mà bạn sở hữu."
      actions={<BackToBranches />}
    >
      {!branchId ? (
        <PropertyForm />
      ) : !databaseIdSchema.safeParse(branchId).success ? (
        <Notice>Liên kết chi nhánh không hợp lệ.</Notice>
      ) : (
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {query.data && <PropertyForm key={query.data.id} branch={query.data} />}
        </QueryState>
      )}
    </OwnerPage>
  )
}
