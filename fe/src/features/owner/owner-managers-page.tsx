import { InlineError, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ActionDialog, ManagerStatus, Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { useState } from 'react'
import { Link } from 'react-router'
import { OwnerFilters, OwnerPage } from './components'
import { useOwnerFilters, useOwnerList, useOwnerMutation } from './context'

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
