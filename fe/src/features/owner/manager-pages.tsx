import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Panel, QueryState, Notice, InlineError, Field } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { ManagerForm, ManagerStatus, Records, ActionDialog } from '@/features/manager/components'
import { invitationInputSchema, type OwnedBranch } from '@/interfaces/owner'
import { ownerApi } from '@/services/owner'
import { useOwner, useOwnerList, useOwnerQuery, useOwnerMutation } from './context'
import { OwnerPage, OwnerFilters } from './components'
import { useOwnerFilters } from './context'
import { dateTime } from '@/lib/activity'
export function OwnerManagers() {
  const state = useOwnerFilters(),
    query = useOwnerList('managers', state.filters),
    invites = useOwnerList('invitations', { size: '100' }),
    [cancel, setCancel] = useState<string | null>(null),
    mutation = useOwnerMutation(() => setCancel(null))
  return (
    <OwnerPage
      title="Đội ngũ quản lý"
      description="Quản lý là tài khoản đã xác minh và có quan hệ với chủ trọ."
      actions={
        <Button asChild>
          <Link to="/owner/managers/invite">Mời quản lý</Link>
        </Button>
      }
    >
      <OwnerFilters state={state} />
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có quản lý phù hợp."
        columns={[
          {
            label: 'Quản lý',
            render: (m) => (
              <Link className="font-bold text-primary" to={`/owner/managers/${m.id}`}>
                {m.user.fullName}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {m.user.email}
                </span>
              </Link>
            ),
          },
          { label: 'Tài khoản', render: (m) => <ManagerStatus value={m.user.status} /> },
          { label: 'Ngày liên kết', render: (m) => dateTime(m.assignedAt) },
          {
            label: 'Chi nhánh phụ trách',
            render: (m) => m.branches.map((b) => b.name).join(', ') || 'Chưa phân công',
          },
        ]}
      />
      <Panel>
        <h2 className="mb-4 font-bold">Lời mời gần đây</h2>
        <QueryState
          pending={invites.isPending}
          error={invites.error}
          retry={invites.refetch}
          empty={invites.data?.content.length === 0}
          emptyMessage="Chưa gửi lời mời nào."
          emptyAction={<Link to="/owner/managers/invite">Mời quản lý</Link>}
        >
          <div className="divide-y divide-border">
            {invites.data?.content.map((i) => (
              <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={i.id}>
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold">{i.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.status === 'INVITED'
                      ? 'Chờ xác nhận'
                      : i.status === 'ACCEPTED'
                        ? 'Đã xác nhận'
                        : i.status === 'CANCELLED'
                          ? 'Đã hủy'
                          : 'Hết hạn'}{' '}
                    · Hạn {dateTime(i.expiresAt)}
                  </p>
                </div>
                {['INVITED', 'EXPIRED'].includes(i.status) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({ path: `/invitations/${i.id}/resend`, value: {} })
                      }
                    >
                      Gửi lại
                    </Button>
                    <Button variant="ghost" onClick={() => setCancel(i.id)}>
                      Hủy lời mời
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </QueryState>
        <InlineError error={mutation.error} />
      </Panel>
      <ActionDialog
        title="Hủy lời mời quản lý?"
        open={!!cancel}
        onOpenChange={(v) => {
          if (!v) setCancel(null)
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() => mutation.mutate({ path: `/invitations/${cancel}/cancel`, value: {} })}
      />
    </OwnerPage>
  )
}
export function OwnerInvite() {
  const { branches } = useOwner(),
    [selected, setSelected] = useState<string[]>([]),
    navigate = useNavigate(),
    mutation = useOwnerMutation(() => navigate('/owner/managers'))
  return (
    <OwnerPage
      title="Mời quản lý"
      description="Người nhận đăng nhập bằng email đã xác minh và tự xác nhận tham gia."
    >
      <Panel>
        <Notice>
          Lời mời chưa cấp quyền truy cập chi nhánh. Phân công cần được xác nhận riêng sau khi người
          nhận chấp thuận. Trong demo, lời mời được lưu tại tài khoản và không gửi email thật.
        </Notice>
        <div className="mt-6">
          <ManagerForm
            schema={invitationInputSchema.omit({ branchIds: true })}
            defaults={{ fullName: '', email: '', phone: '', note: '' }}
            fields={[
              { name: 'fullName', label: 'Họ tên người nhận' },
              { name: 'email', label: 'Email người nhận' },
              { name: 'phone', label: 'Điện thoại (không bắt buộc)' },
              { name: 'note', label: 'Lời nhắn', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Gửi lời mời"
            onSubmit={(v) =>
              mutation.mutate({ path: '/invitations', value: { ...v, branchIds: selected } })
            }
          >
            <fieldset>
              <legend className="mb-3 text-sm font-bold">Dự kiến phụ trách</legend>
              <div className="grid gap-2">
                {branches.map((b) => (
                  <label key={b.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      disabled={mutation.isPending}
                      checked={selected.includes(b.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, b.id] : s.filter((id) => id !== b.id),
                        )
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </ManagerForm>
        </div>
      </Panel>
    </OwnerPage>
  )
}
export function OwnerManagerDetail() {
  const { managerId = '' } = useParams(),
    query = useOwnerQuery('manager', () => ownerApi.manager(managerId), [managerId]),
    [remove, setRemove] = useState(false),
    navigate = useNavigate(),
    mutation = useOwnerMutation(() => navigate('/owner/managers'))
  return (
    <OwnerPage title={query.data?.user.fullName || 'Thông tin quản lý'}>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Email', query.data.user.email],
                  ['Điện thoại', query.data.user.phone || 'Chưa cập nhật'],
                  ['Tài khoản', <ManagerStatus value={query.data.user.status} />],
                  ['Quan hệ', 'Đang thuộc chủ trọ'],
                  ['Ngày liên kết', dateTime(query.data.assignedAt)],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-4">
                <Button asChild>
                  <Link to="/owner/manager-assignments">Phân công / chuyển chi nhánh</Link>
                </Button>
                <Button variant="outline" onClick={() => setRemove(true)}>
                  Kết thúc quan hệ quản lý
                </Button>
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Chi nhánh phụ trách</h2>
              {query.data.branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có phân công.</p>
              ) : (
                <div className="divide-y divide-border">
                  {query.data.branches.map((b) => (
                    <div className="flex flex-wrap justify-between gap-3 py-4" key={b.id}>
                      <Link
                        className="text-sm font-bold text-primary"
                        to={`/owner/branches/${b.id}`}
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.assignedAt ? dateTime(b.assignedAt) : 'Đã phân công'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Notice>
              Kết thúc quan hệ chỉ thu hồi quyền trong phạm vi chủ trọ; không khóa tài khoản dùng
              chung. Xem thay đổi phân công tại{' '}
              <Link className="underline" to="/owner/activity?type=ASSIGNMENT">
                nhật ký hoạt động
              </Link>
              .
            </Notice>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Kết thúc quan hệ quản lý?"
        open={remove}
        onOpenChange={setRemove}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(v) =>
          mutation.mutate({ path: `/managers/${managerId}`, value: v, method: 'DELETE' })
        }
      />
    </OwnerPage>
  )
}
function AssignmentCard({ branch }: { branch: OwnedBranch }) {
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
export function OwnerAssignments() {
  const { branches, scope } = useOwner()
  return (
    <OwnerPage
      title="Phân công quản lý"
      description="Một quản lý có thể phụ trách nhiều chi nhánh thuộc cùng chủ trọ."
    >
      {branches
        .filter((b) => !scope || b.id === scope)
        .map((b) => (
          <AssignmentCard key={`${b.id}:${b.version}`} branch={b} />
        ))}
      {branches.length === 0 && <Notice>Tạo chi nhánh để bắt đầu phân công.</Notice>}
    </OwnerPage>
  )
}
