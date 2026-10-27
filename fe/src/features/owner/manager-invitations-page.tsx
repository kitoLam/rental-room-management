import { InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { dateTime } from '@/lib/activity'
import { ownerApi } from '@/services/owner'
import { queryClient } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

export function ManagerInvitationsPage() {
  const user = useSession((s) => s.user!),
    query = useQuery({
      queryKey: ['my-manager-invitations', user.id],
      queryFn: ownerApi.invitations,
    }),
    mutation = useMutation({
      mutationFn: ownerApi.accept,
      onSuccess: (data) => {
        useSession.getState().updateUser(data.user)
        void queryClient.invalidateQueries()
      },
    })
  return (
    <Page title="Lời mời quản lý" back="/profile" narrow>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.length === 0}
        emptyMessage="Bạn chưa có lời mời quản lý."
        emptyAction={<Link to="/profile">Về hồ sơ</Link>}
      >
        <div className="grid gap-5">
          {query.data?.map((i) => (
            <Panel key={i.id}>
              <h2 className="text-lg font-bold">Lời mời dành cho {i.fullName}</h2>
              <p className="my-3 text-sm text-muted-foreground">
                {i.note || 'Tham gia quản lý chi nhánh trên TroPro.'}
              </p>
              <p className="text-xs">Hết hạn: {dateTime(i.expiresAt)}</p>
              <p className="my-3 text-sm">
                {i.status === 'ACCEPTED'
                  ? 'Đã xác nhận. Chủ trọ sẽ phân công chi nhánh.'
                  : i.status === 'INVITED'
                    ? 'Chờ bạn xác nhận'
                    : 'Lời mời đã hủy hoặc hết hạn'}
              </p>
              {i.status === 'INVITED' && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate(i.id)}>
                  Xác nhận tham gia
                </Button>
              )}
            </Panel>
          ))}
        </div>
        <InlineError error={mutation.error} />
        {mutation.isSuccess && (
          <Notice tone="success">
            Đã xác nhận bằng tài khoản của bạn.{' '}
            <Link to="/manager/dashboard" className="underline">
              Xem phân công
            </Link>
          </Notice>
        )}
      </QueryState>
    </Page>
  )
}
