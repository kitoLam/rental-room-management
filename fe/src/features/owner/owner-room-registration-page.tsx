import { useProperty } from './hooks/use-property'
import { Notice, QueryState } from '@/components/common/page'
import { databaseIdSchema } from '@/interfaces/domain'
import { Link, useParams } from 'react-router'
import { OwnerPage } from './components'
import { BackToBranches, RoomRegistrationForm } from './property-shared'
export function OwnerRoomRegistration() {
  const { branchId = '' } = useParams(),
    query = useProperty(branchId)
  const branch = query.data
  return (
    <OwnerPage
      title="Đăng ký phòng"
      description="Phòng sẽ được lưu vào chi nhánh bạn đã chọn."
      actions={<BackToBranches />}
    >
      {!databaseIdSchema.safeParse(branchId).success ? (
        <Notice>Hãy đăng ký và chọn chi nhánh trước khi thêm phòng.</Notice>
      ) : (
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {branch &&
            (branch.propertyType &&
            branch.declaredRoomCount &&
            branch.roomCount < branch.declaredRoomCount ? (
              <RoomRegistrationForm key={branch.id} branch={branch} />
            ) : (
              <Notice>
                Chi nhánh chưa hoàn tất đăng ký hoặc đã đủ số phòng.{' '}
                <Link className="font-bold underline" to={`/owner/branches/${branch.id}/edit`}>
                  Cập nhật chi nhánh
                </Link>
              </Notice>
            ))}
        </QueryState>
      )}
    </OwnerPage>
  )
}
