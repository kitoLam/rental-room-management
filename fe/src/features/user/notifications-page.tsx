import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Bell, CheckCheck, ArrowUpRight, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineError, Page, Panel, Pagination, QueryState } from '@/components/common/page'
import { notificationService } from '@/services/guest-user'
import { queryClient } from '@/services/query-client'
import { dateTime, referenceLink } from '@/lib/activity'
import { useSession } from '@/features/auth/session-store'
import { provider } from '@/services/config'
import { SendNotificationDialog } from './send-notification-dialog'
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const [sendOpen, setSendOpen] = useState(false)
  const user = useSession((s) => s.user)
  const userId = user?.id || ''
  const canSend = user?.roles.some((r) => ['ADMIN', 'MANAGER', 'OWNER'].includes(r))
  const category = params.get('type') || ''
  const read = ['true', 'false'].includes(params.get('read') || '') ? params.get('read')! : ''
  const page = Math.max(1, Number(params.get('page') || 1) || 1)
  const navigate = useNavigate()
  const list = useQuery({
    queryKey: ['notifications', userId, 'list', read, page, category, params.get('demo')],
    queryFn: () => notificationService.list(read, page, category),
    refetchInterval: 30000,
  })
  const mark = useMutation({
    mutationFn: notificationService.read,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const all = useMutation({
    mutationFn: notificationService.readAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  function change(value: string, nextPage = 1) {
    setParams({
      ...(value ? { read: value } : {}),
      ...(category ? { type: category } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }
  return (
    <Page
      title="Những cập nhật dành cho bạn."
      eyebrow="THÔNG BÁO"
      description="Theo dõi phản hồi lịch xem phòng, giữ chỗ và trạng thái thanh toán."
      actions={
        <div className="flex flex-wrap gap-2">
          {canSend && (
            <Button onClick={() => setSendOpen(true)}>
              <Send size={16} />
              Gửi thông báo
            </Button>
          )}
          <Button
            variant="outline"
            loading={all.isPending}
            onClick={() => all.mutate()}
            disabled={!list.data?.content.some((n) => !n.read)}
          >
            <CheckCheck />
            Đọc tất cả
          </Button>
        </div>
      }
    >
      <SendNotificationDialog open={sendOpen} onOpenChange={setSendOpen} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Lọc thông báo"
          value={read}
          onChange={(e) => change(e.target.value)}
          className="input w-auto"
        >
          <option value="">Tất cả thông báo</option>
          <option value="false">Chưa đọc</option>
          <option value="true">Đã đọc</option>
        </select>
        {provider('notifications') === 'mock' && (
          <select
            aria-label="Loại thông báo"
            className="input w-auto"
            value={category}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              next.delete('page')
              if (e.target.value) next.set('type', e.target.value)
              else next.delete('type')
              setParams(next)
            }}
          >
            <option value="">Tất cả loại</option>
            {[
              ['TENANT_CONTRACT', 'Hợp đồng'],
              ['TENANT_INVOICE', 'Hóa đơn'],
              ['TENANT_PAYMENT', 'Thanh toán thuê'],
              ['TENANT_SERVICE', 'Dịch vụ'],
              ['TENANT_ALLOCATION', 'Phân bổ phí'],
              ['TENANT_MAINTENANCE', 'Bảo trì'],
              ['TENANT_BRANCH', 'Chi nhánh'],
              ...(useSession.getState().user?.roles.includes('ADMIN') ? [['ADMIN_VERIFICATION','Xác minh chủ trọ'],['ADMIN_USER','Quản trị tài khoản']] : []),
              ['OWNER_VERIFICATION','Kết quả xác minh chủ trọ'],
              ['ACCOUNT_STATUS','Trạng thái tài khoản'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        <Link to="/user/dashboard" className="min-h-11 py-3 text-sm text-primary underline">
          Về tổng quan
        </Link>
      </div>
      <InlineError error={mark.error || all.error} />
      <QueryState
        pending={list.isPending}
        error={list.error}
        retry={list.refetch}
        empty={list.data?.content.length === 0}
        emptyMessage={
          read === 'false'
            ? 'Bạn đã đọc hết thông báo. Những cập nhật mới sẽ xuất hiện ở đây.'
            : 'Chưa có thông báo phù hợp. Các cập nhật về lịch hẹn và giữ chỗ sẽ xuất hiện ở đây.'
        }
      >
        {list.data && (
          <>
            <Panel>
              <ul className="divide-y divide-border">
                {list.data.content.map((n) => {
                  const to = referenceLink(n.referenceType, n.referenceId, n.contractTenantId,n.branchId)
                  return (
                    <li key={n.id} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                      <div
                        className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg ${n.read ? 'bg-background text-muted-foreground' : 'bg-primary-soft text-primary'}`}
                      >
                        <Bell size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-bold">{n.title}</h2>
                          {!n.read && (
                            <span
                              className="size-2 rounded-full bg-primary"
                              aria-label="Chưa đọc"
                            />
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{n.message}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {dateTime(n.createdAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                          {!n.read && (
                            <button
                              type="button"
                              className="min-h-11 text-xs font-bold text-primary underline"
                              disabled={mark.isPending}
                              onClick={() => mark.mutate([n.id])}
                            >
                              Đánh dấu đã đọc
                            </button>
                          )}
                          {to && (
                            <button
                              type="button"
                              className="flex min-h-11 items-center gap-1 text-xs font-bold text-primary"
                              disabled={mark.isPending}
                              onClick={() => {
                                if (!n.read) mark.mutate([n.id], { onSuccess: () => navigate(to) })
                                else navigate(to)
                              }}
                            >
                              Xem chi tiết
                              <ArrowUpRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Panel>
            <Pagination
              page={page}
              totalPages={list.data.totalPages}
              onPage={(next) => change(read, next)}
            />
          </>
        )}
      </QueryState>
    </Page>
  )
}
