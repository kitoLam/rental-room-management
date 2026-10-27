import { Panel, QueryState } from '@/components/common/page'
import { contractInputSchema } from '@/interfaces/manager'
import { managerApi } from '@/services/manager'
import { useNavigate, useParams } from 'react-router'
import { ManagerForm, ManagerLink, ManagerPage } from './components'
import {
  managerLink,
  useManager,
  useManagerAction,
  useManagerList,
  useManagerQuery,
} from './context'

export function ManagerContractEditor() {
  const { contractId } = useParams(),
    { branch } = useManager(),
    navigate = useNavigate(),
    rooms = useManagerList('rooms', { size: '100' }),
    query = useManagerQuery(
      'contract-editor',
      (b) => (contractId ? managerApi.get(b, 'contracts', contractId) : Promise.resolve(null)),
      [contractId],
    ),
    mutation = useManagerAction((result) =>
      navigate(managerLink(`/manager/contracts/${result?.id || contractId}`, branch.id)),
    )
  return (
    <ManagerPage
      title={contractId ? 'Chỉnh sửa hợp đồng nháp' : 'Tạo hợp đồng thuê'}
      actions={<ManagerLink to="/manager/contracts">Danh sách hợp đồng</ManagerLink>}
    >
      <QueryState
        pending={query.isPending || rooms.isPending}
        error={query.error || rooms.error}
        retry={() => {
          void query.refetch()
          void rooms.refetch()
        }}
      >
        <Panel>
          <ManagerForm
            schema={contractInputSchema}
            defaults={
              query.data
                ? { ...query.data }
                : { code: '', roomId: '', startDate: '', endDate: '', terms: '' }
            }
            fields={[
              { name: 'code', label: 'Mã hợp đồng' },
              {
                name: 'roomId',
                label: 'Phòng',
                kind: 'select',
                options: rooms.data?.content
                  .filter((r) => r.operationalStatus === 'ACTIVE')
                  .map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` })),
              },
              { name: 'startDate', label: 'Bắt đầu', kind: 'date' },
              { name: 'endDate', label: 'Kết thúc (không gồm)', kind: 'date' },
              { name: 'terms', label: 'Điều khoản chung', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'contracts',
                id: contractId,
                value,
                method: contractId ? 'PATCH' : 'POST',
              })
            }
          />
        </Panel>
      </QueryState>
    </ManagerPage>
  )
}
