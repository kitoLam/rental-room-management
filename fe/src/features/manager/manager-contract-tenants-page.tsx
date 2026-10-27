import { Modal, Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { tenancyInputSchema, type ManagerTenancy } from '@/interfaces/manager'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import {
  ActionDialog,
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
      (b) => managerApi.get(b, 'contracts', contractId),
      [contractId],
      true,
    ),
    query = useManagerList('tenants', { contractId, size: '100' }, true),
    users = useManagerQuery('eligible-users', managerApi.users),
    slots = useManagerList('slots', { roomId: contract.data?.roomId || '', size: '100' }),
    [editing, setEditing] = useState<ManagerTenancy | null | undefined>(undefined),
    [action, setAction] = useState<{ id: string; action: string } | null>(null),
    mutation = useManagerAction(() => {
      setEditing(undefined)
      setAction(null)
    })
  const fields: FieldSpec[] = [
    {
      name: 'userId',
      label: 'Tài khoản đã xác minh',
      kind: 'select',
      options: users.data?.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.email}` })),
    },
    {
      name: 'roomSlotId',
      label: 'Chỗ ở (chỉ thuê chỗ)',
      kind: 'select',
      nullable: true,
      options: slots.data?.content.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
    },
    {
      name: 'role',
      label: 'Vai trò',
      kind: 'select',
      options: [
        { value: 'REPRESENTATIVE', label: 'Đại diện' },
        { value: 'MEMBER', label: 'Thành viên' },
      ],
    },
    { name: 'startDate', label: 'Bắt đầu cư trú', kind: 'date' },
    { name: 'endDate', label: 'Kết thúc cư trú (không gồm)', kind: 'date' },
    ...(
      [
        'monthlyRent',
        'firstMonthRent',
        'lastMonthRent',
        'prepaidFirstRequired',
        'prepaidLastRequired',
      ] as const
    ).map((name, n) => ({
      name,
      label:
        [
          'Giá thuê hàng tháng',
          'Giá thuê kỳ đầu',
          'Giá thuê kỳ cuối',
          'Trả trước kỳ đầu',
          'Trả trước kỳ cuối',
        ][n] + ' (VND)',
      kind: 'number' as const,
      hint:
        name === 'lastMonthRent' || name === 'prepaidLastRequired'
          ? 'Thuê đúng 1 tháng: nhập 0, chỉ trả trước kỳ đầu.'
          : undefined,
    })),
    { name: 'terms', label: 'Điều khoản cá nhân', kind: 'textarea' },
  ]
  return (
    <ManagerPage
      title="Thành viên & nghĩa vụ cá nhân"
      description={contract.data?.code}
      actions={<ManagerLink to={`/manager/contracts/${contractId}`}>Hợp đồng</ManagerLink>}
    >
      <QueryState
        pending={contract.isPending || users.isPending}
        error={contract.error || users.error}
        retry={() => {
          void contract.refetch()
          void users.refetch()
        }}
      >
        <Notice>
          Chọn tài khoản đã có yêu cầu/quan hệ tại chi nhánh. Hồ sơ tài khoản không bị ghi đè khi
          thêm người thuê.
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
              render: (t) => (
                <>
                  <ManagerLink to={`/manager/tenancies/${t.id}`}>{t.userName}</ManagerLink>
                  <p className="text-xs text-muted-foreground">
                    {t.slotName || 'Nguyên phòng'} ·{' '}
                    {t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'}
                  </p>
                </>
              ),
            },
            {
              label: 'Giá thuê / trả trước',
              render: (t) => (
                <>
                  <strong>{formatVnd(t.monthlyRent)}/tháng</strong>
                  <p className="text-xs text-muted-foreground">
                    Đầu: {formatVnd(t.prepaidFirstRequired)} · Cuối:{' '}
                    {formatVnd(t.prepaidLastRequired)}
                  </p>
                </>
              ),
            },
            { label: 'Trạng thái', render: (t) => <ManagerStatus value={t.status} /> },
            {
              label: 'Thao tác',
              render: (t) => (
                <div className="flex flex-wrap gap-2">
                  {t.status === 'DRAFT' && (
                    <Button variant="outline" onClick={() => setEditing(t)}>
                      Sửa nghĩa vụ
                    </Button>
                  )}
                  {t.status === 'DRAFT' && contract.data?.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      onClick={() => setAction({ id: t.id, action: 'activate' })}
                    >
                      Kích hoạt
                    </Button>
                  )}
                  {t.status === 'ACTIVE' && t.role === 'MEMBER' && (
                    <Button
                      variant="outline"
                      onClick={() => setAction({ id: t.id, action: 'representative' })}
                    >
                      Chọn đại diện
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </QueryState>
      <Modal
        title={editing ? 'Sửa nghĩa vụ nháp' : 'Thêm thành viên'}
        open={editing !== undefined}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setEditing(undefined)
        }}
      >
        {editing !== undefined && (
          <ManagerForm
            schema={tenancyInputSchema}
            defaults={
              editing
                ? { ...editing }
                : {
                    userId: '',
                    roomSlotId: '',
                    role: 'MEMBER',
                    startDate: contract.data?.startDate,
                    endDate: contract.data?.endDate,
                    monthlyRent: 0,
                    firstMonthRent: 0,
                    lastMonthRent: 0,
                    prepaidFirstRequired: 0,
                    prepaidLastRequired: 0,
                    terms: '',
                  }
            }
            fields={fields}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'tenants',
                id: editing?.id,
                value: { ...value, contractId },
                method: editing ? 'PATCH' : 'POST',
              })
            }
          />
        )}
      </Modal>
      <ActionDialog
        title="Cập nhật quan hệ thuê"
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction(null)
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'tenants',
            id: action!.id,
            action: action!.action,
            value: { ...value, contractId },
          })
        }
      />
    </ManagerPage>
  )
}
