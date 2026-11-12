import { Field, InlineError, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ActionDialog, ManagerStatus } from '@/features/manager/components'
import { type OwnedBranch } from '@/interfaces/owner'
import { dateTime } from '@/lib/activity'
import { ownerApi } from '@/services/owner'
import { useState } from 'react'
import { Link } from 'react-router'
import { useOwnerMutation, useOwnerQuery } from './context'

export function AssignmentCard({ branch }: { branch: OwnedBranch }) {
  const managers = useOwnerQuery('eligible-managers', () =>
      ownerApi.list('managers', { size: '100' }),
    ),
    [manager, setManager] = useState(branch.managerId || ''),
    [confirm, setConfirm] = useState(false),
    mutation = useOwnerMutation(() => setConfirm(false))
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="font-bold text-primary" to={`/owner/branches/${branch.id}`}>
            {branch.name}
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            Hiện tại: {branch.managerName || 'Chưa phân công'}
          </p>
          {branch.assignedAt && (
            <p className="mt-1 text-xs text-muted-foreground">{dateTime(branch.assignedAt)}</p>
          )}
        </div>
        <ManagerStatus value={branch.status} />
      </div>
      <Field id={`assignment-${branch.id}`} label="Quản lý chính">
        <select
          id={`assignment-${branch.id}`}
          className="input"
          value={manager}
          disabled={mutation.isPending}
          onChange={(e) => setManager(e.target.value)}
        >
          <option value="">Không phân công</option>
          {managers.data?.content
            .filter((m) => m.user.status === 'ACTIVE')
            .map((m) => (
              <option value={m.id} key={m.id}>
                {m.user.fullName} · {m.branches.length} chi nhánh
              </option>
            ))}
        </select>
      </Field>
      <InlineError error={managers.error} />
      {branch.status === 'ACTIVE' && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Chi nhánh hoạt động luôn cần một quản lý chính. Chuyển phân công sẽ thu hồi quyền của quản
          lý cũ ngay.
        </p>
      )}
      <Button
        className="mt-5"
        disabled={
          manager === (branch.managerId || '') ||
          mutation.isPending ||
          (!manager && branch.status === 'ACTIVE')
        }
        onClick={() => setConfirm(true)}
      >
        Kiểm tra phân công
      </Button>
      <ActionDialog
        title="Xác nhận thay đổi phân công?"
        open={confirm}
        onOpenChange={setConfirm}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(v) =>
          mutation.mutate({
            path: `/branches/${branch.id}/assignment`,
            value: { ...v, managerId: manager || null, version: branch.version },
            method: 'PUT',
          })
        }
      />
    </Panel>
  )
}
