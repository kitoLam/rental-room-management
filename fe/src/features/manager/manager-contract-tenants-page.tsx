import { Modal, Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  contractTenantInputSchema,
  contractTenantUpdateSchema,
  type ManagerContractTenant,
} from '@/interfaces/manager'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import {
  ManagerForm,
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  type FieldSpec,
} from './components'
import { useManagerAction, useManagerList, useManagerQuery } from './context'

export function ManagerContractTenants() {
  const { contractId = '' } = useParams(),
    contract = useManagerQuery(
      'contract',
      (branchId) => managerApi.get(branchId, 'contracts', contractId),
      [contractId],
      true,
    ),
    query = useManagerList('contract-tenants', { contractId, size: '100' }, true),
    candidates = useManagerQuery(
      'eligible-contract-tenants',
      () => managerApi.eligibleContractTenants(contractId),
      [contractId],
    ),
    [editing, setEditing] = useState<ManagerContractTenant | null | undefined>(undefined),
    mutation = useManagerAction(() => setEditing(undefined))

  const fields: FieldSpec[] = [
    ...(!editing
      ? [{
          name: 'tenantId',
          label: 'Tài khoản Tenant đã xác minh',
          kind: 'select' as const,
          options: candidates.data?.map((tenant) => ({
            value: tenant.tenantId,
            label: `${tenant.fullName || 'Người thuê'} · ${tenant.email}`,
          })),
        }]
      : []),
    { name: 'rentAmount', label: 'Phần tiền thuê hàng tháng (VND)', kind: 'number', min: 0 },
    { name: 'joinedAt', label: 'Ngày bắt đầu cư trú', kind: 'date' },
    { name: 'leftAt', label: 'Ngày rời đi', kind: 'date', nullable: true },
    { name: 'isRepresentative', label: 'Đại diện hợp đồng', kind: 'check' },
    ...(editing ? [{
      name: 'status',
      label: 'Trạng thái thành viên',
      kind: 'select' as const,
      options: [
        { value: 'ACTIVE', label: 'Đang ở' },
        { value: 'LEFT', label: 'Đã rời đi' },
      ],
    }] : []),
  ]

  return (
    <ManagerPage
      title="Thành viên & nghĩa vụ cá nhân"
      description={contract.data?.code}
      actions={<ManagerLink to={`/manager/contracts/${contractId}`}>Hợp đồng</ManagerLink>}
    >
      <QueryState
        pending={contract.isPending || candidates.isPending}
        error={contract.error || candidates.error}
        retry={() => {
          void contract.refetch()
          void candidates.refetch()
        }}
      >
        <Notice>
          Quản lý thành viên, người đại diện, phần tiền thuê, ngày cư trú và trạng thái theo các trường
          hiện có của hợp đồng.
        </Notice>
        {['DRAFT', 'ACTIVE'].includes(contract.data?.status || '') && (
          <div>
            <Button onClick={() => setEditing(null)}>Thêm thành viên</Button>
          </div>
        )}
        <Records
          query={query}
          page={1}
          onPage={() => undefined}
          columns={[
            {
              label: 'Người thuê',
              render: (tenant) => (
                <>
                  <strong>{tenant.tenantName || 'Người thuê'}</strong>
                  <p className="text-xs text-muted-foreground">{tenant.tenantEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {tenant.isRepresentative ? 'Đại diện hợp đồng' : 'Thành viên'}
                  </p>
                </>
              ),
            },
            {
              label: 'Nghĩa vụ thuê',
              render: (tenant) => (
                <>
                  <strong>{formatVnd(tenant.rentAmount || 0)}/tháng</strong>
                  <p className="text-xs text-muted-foreground">
                    {tenant.joinedAt} – {tenant.leftAt || (tenant.status === 'LEFT' ? 'Đã rời đi' : 'Đang cư trú')}
                  </p>
                </>
              ),
            },
            { label: 'Trạng thái', render: (tenant) => <ManagerStatus value={tenant.status} /> },
            {
              label: 'Thao tác',
              render: (tenant) => (
                <Button variant="outline" onClick={() => setEditing(tenant)}>
                  Sửa nghĩa vụ
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
      <Modal
        title={editing ? 'Sửa nghĩa vụ thành viên' : 'Thêm thành viên'}
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEditing(undefined)
        }}
      >
        {editing !== undefined && (
          <ManagerForm
            schema={editing ? contractTenantUpdateSchema : contractTenantInputSchema}
            defaults={
              editing
                ? {
                    isRepresentative: Boolean(editing.isRepresentative),
                    rentAmount: editing.rentAmount || 0,
                    joinedAt: editing.joinedAt,
                    leftAt: editing.leftAt,
                    status: editing.status,
                  }
                : {
                    tenantId: '',
                    isRepresentative: false,
                    rentAmount: 0,
                    joinedAt: contract.data?.startDate || '',
                    leftAt: null,
                  }
            }
            fields={fields}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel={editing ? 'Lưu nghĩa vụ' : 'Thêm thành viên'}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'contract-tenants',
                id: editing?.id,
                value: editing ? value : { ...value, contractId },
                method: editing ? 'PATCH' : 'POST',
              })
            }
          />
        )}
      </Modal>
    </ManagerPage>
  )
}
