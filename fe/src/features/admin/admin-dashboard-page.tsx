import { ChartBar } from '@/components/common/chart-bar'
import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { ActionDialog } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { useState } from 'react'
import { AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminMutation, useAdminQuery } from './context'
import { statusNames } from './labels'

export function AdminDashboard() {
  const query = useAdminQuery('dashboard', adminApi.summary),
    [reset, setReset] = useState(false),
    mutation = useAdminMutation(adminApi.reset, () => setReset(false)),
    email = useSession((s) => s.user!.email)
  return (
    <AdminPage
      title="Tổng quan quản trị"
      description="Theo dõi phòng đăng trên nền tảng, chi nhánh, tài khoản và hoạt động quản trị."
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Phòng đã đăng công khai', query.data.publishedRooms],
                ['Tổng chi nhánh đăng ký', query.data.totalBranches],
                ['Tổng phòng trong hệ thống', query.data.totalRooms],
                ['Tổng tài khoản', query.data.totalUsers],
              ].map(([label, count]) => (
                <div className="bg-surface p-5" key={String(label)}>
                  <p className="text-xs leading-5 text-muted-foreground">{label}</p>
                  <p className="mt-3 text-[2rem] font-bold tabular-nums text-primary">{count}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                ['Phòng chưa công khai', query.data.totalRooms - query.data.publishedRooms],
                ['Chủ trọ đủ điều kiện', query.data.approvedOwners],
                ['Hồ sơ chờ duyệt', query.data.pendingOwners],
              ].map(([label, count]) => (
                <Panel key={String(label)}>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl font-bold">{count}</p>
                </Panel>
              ))}
            </div>
            {provider('admin') === 'mock' && (
              <Notice>
                Đang xem dữ liệu demo. Số liệu cập nhật theo các phòng và chi nhánh trong phiên dùng
                thử, không cần kết nối backend.
              </Notice>
            )}
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">Việc cần xử lý</h2>
                <AdminLink to="/admin/owner-verifications">
                  {query.data.pendingOwners} hồ sơ chờ duyệt
                </AdminLink>
              </div>
              <div className="mt-4 divide-y divide-border">
                {query.data.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có tài khoản cần kiểm tra.</p>
                ) : (
                  query.data.issues.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <AdminLink to={`/admin/users/${u.id}`}>{u.name}</AdminLink>
                      <AdminStatus value={u.status} />
                    </div>
                  ))
                )}
              </div>
            </Panel>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <h2 className="mb-5 font-bold">Phân bố trạng thái tài khoản</h2>
                <div className="grid gap-4">
                  {query.data.accounts.map((a) => (
                    <div key={a.status}>
                      <div className="flex justify-between gap-3 text-xs">
                        <span>{statusNames[a.status]}</span>
                        <strong>{a.count}</strong>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-sm bg-background">
                        <ChartBar
                          className="bg-primary"
                          value={a.count}
                          max={query.data!.totalUsers}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <AdminLink to="/admin/users">Xem người dùng</AdminLink>
              </Panel>
              <Panel>
                <h2 className="mb-5 font-bold">Chi nhánh trên nền tảng</h2>
                <div className="grid gap-4">
                  {query.data.branches.map((b) => (
                    <div className="flex items-center justify-between gap-3" key={b.status}>
                      <AdminStatus value={b.status} />
                      <strong>{b.count}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  <AdminLink to="/admin/owners">Danh bạ chủ trọ</AdminLink>
                  <AdminLink to="/admin/branches">Danh bạ chi nhánh</AdminLink>
                </div>
              </Panel>
            </div>
            <Panel>
              <h2 className="mb-4 font-bold">Hoạt động gần đây</h2>
              {query.data.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có hoạt động quản trị.</p>
              ) : (
                query.data.recent.map((a) => (
                  <div className="border-t border-border py-3" key={a.id}>
                    <AdminLink to={`/admin/activity/${a.id}`}>{a.summary}</AdminLink>
                    <p className="text-xs text-muted-foreground">
                      {a.actorName} · {dateTime(a.occurredAt)}
                    </p>
                  </div>
                ))
              )}
              <AdminLink to="/admin/activity">Xem nhật ký</AdminLink>
            </Panel>
          </>
        )}
      </QueryState>
      {import.meta.env.DEV && provider('admin') === 'mock' && email === 'admin@tropro.demo' && (
        <details className="rounded-lg border border-border p-4 text-xs">
          <summary className="cursor-pointer font-bold">Công cụ dữ liệu demo</summary>
          <p className="my-3 text-muted-foreground">
            Khôi phục dữ liệu dùng chung của các vai trò trong phiên demo.
          </p>
          <Button variant="outline" onClick={() => setReset(true)}>
            Khôi phục dữ liệu demo
          </Button>
        </details>
      )}
      <ActionDialog
        title="Khôi phục dữ liệu demo liên vai trò?"
        open={reset}
        onOpenChange={setReset}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() => mutation.mutate()}
      />
    </AdminPage>
  )
}
