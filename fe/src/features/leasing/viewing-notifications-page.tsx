import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/http'
import {
  viewingDependenciesService,
  type ViewingNotification,
} from '@/services/viewing-dependencies'
import { viewingDateTime } from './viewing-time'
import { viewingAppointmentsPath } from './viewing-navigation'

export default function ViewingNotificationsPage() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const navigate = useNavigate()
  const filter = params.get('read') ?? ''
  const rawPage = Number(params.get('page') ?? 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const list = useQuery({
    queryKey: ['viewing-notifications', context.data?.accountId, filter, page],
    queryFn: () =>
      viewingDependenciesService.notifications(filter === '' ? undefined : filter === 'true', page),
    enabled: !!context.data && !context.isFetching,
    refetchInterval: 15000,
  })
  const mark = useMutation({
    mutationFn: ({ notification }: { notification: ViewingNotification; open?: boolean }) =>
      viewingDependenciesService.readNotification(notification.id),
    onSuccess: async (_, input) => {
      await client.invalidateQueries({ queryKey: ['viewing-notifications'] })
      if (input.open) navigate(input.notification.detailPath)
    },
  })
  const all = useMutation({
    mutationFn: viewingDependenciesService.readAllNotifications,
    onSuccess: () => client.invalidateQueries({ queryKey: ['viewing-notifications'] }),
  })
  const guest = context.error instanceof ApiError && context.error.status === 401
  function open(notification: ViewingNotification) {
    if (notification.readAt) navigate(notification.detailPath)
    else mark.mutate({ notification, open: true })
  }
  return (
    <Page
      title="Thông báo lịch xem phòng"
      eyebrow="CẬP NHẬT VÀ NHẮC LỊCH"
      description="Mở thông báo để xem chi tiết lịch. Đọc thông báo không đổi trạng thái hoặc gia hạn lịch."
      actions={
        <Button asChild variant="outline">
          <Link
            to={viewingAppointmentsPath(context.data?.roles ?? [], { branchId: context.data?.manageableBranchIds[0] })}
          >
            Danh sách lịch xem
          </Link>
        </Button>
      }
    >
      {guest ? (
        <Notice>
          <Link className="font-bold underline" to="/login?redirect=%2Fnotifications%2Fviewing">
            Đăng nhập để xem thông báo của bạn
          </Link>
        </Notice>
      ) : (
        <QueryState
          pending={context.isPending || context.isFetching}
          error={context.error}
          retry={context.refetch}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <select
              aria-label="Lọc thông báo lịch xem"
              className="input w-auto"
              value={filter}
              onChange={(event) => {
                setParams(event.target.value ? { read: event.target.value } : {})
              }}
            >
              <option value="">Tất cả</option>
              <option value="false">Chưa đọc</option>
              <option value="true">Đã đọc</option>
            </select>
            <Button
              variant="outline"
              loading={all.isPending}
              disabled={!list.data?.content.length || filter === 'true' || mark.isPending}
              onClick={() => all.mutate()}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
          <InlineError error={mark.error || all.error} />
          <QueryState pending={list.isPending} error={list.error} retry={list.refetch}>
            {list.data && (
              <Panel>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {list.data.totalElements} thông báo phù hợp
                  </p>
                  <Button
                    variant="ghost"
                    disabled={list.isFetching}
                    onClick={() => void list.refetch()}
                  >
                    Kiểm tra lại
                  </Button>
                </div>
                {!list.data.content.length ? (
                  <p className="py-8 text-sm text-muted-foreground">Chưa có thông báo phù hợp.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {list.data.content.map((notification) => (
                      <li key={notification.id} className="py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h2 className="font-bold">{notification.title}</h2>
                          {!notification.readAt && (
                            <span className="text-xs font-bold text-primary">Chưa đọc</span>
                          )}
                        </div>
                        <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {viewingDateTime(notification.createdAt)}
                          {notification.readAt
                            ? ` · Đã đọc ${viewingDateTime(notification.readAt)}`
                            : ''}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            disabled={mark.isPending || all.isPending}
                            onClick={() => open(notification)}
                          >
                            Mở lịch xem
                          </Button>
                          {!notification.readAt && (
                            <Button
                              variant="ghost"
                              disabled={mark.isPending || all.isPending}
                              onClick={() => mark.mutate({ notification })}
                            >
                              Đánh dấu đã đọc
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {page}/{Math.max(1, list.data.totalPages)}
                  </p>
                  <div className="flex gap-3">
                    {[-1, 1].map((delta) => (
                      <Button
                        key={delta}
                        variant="outline"
                        disabled={list.isFetching || (delta < 0 ? page <= 1 : !list.data.hasNext)}
                        onClick={() => {
                          const next = new URLSearchParams(params)
                          next.set('page', String(page + delta))
                          setParams(next)
                        }}
                      >
                        {delta < 0 ? 'Trang trước' : 'Trang sau'}
                      </Button>
                    ))}
                  </div>
                </div>
              </Panel>
            )}
          </QueryState>
        </QueryState>
      )}
    </Page>
  )
}
