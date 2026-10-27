import { Notice, QueryState } from '@/components/common/page'
import { managerApi } from '@/services/manager'
import { useParams } from 'react-router'
import { useManagerQuery } from './context'
import { UtilityEditorForm } from './operations-shared'
export function ManagerUtilityEditor() {
  const { chargeId } = useParams(),
    query = useManagerQuery(
      'charge-editor',
      (b) => (chargeId ? managerApi.get(b, 'utility-charges', chargeId) : Promise.resolve(null)),
      [chargeId],
    )
  return (
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
      {query.data && query.data.status !== 'DRAFT' ? (
        <Notice>Khoản phí đã chốt, chỉ xem lịch sử.</Notice>
      ) : (
        <UtilityEditorForm key={chargeId || 'new'} initial={query.data || undefined} />
      )}
    </QueryState>
  )
}
