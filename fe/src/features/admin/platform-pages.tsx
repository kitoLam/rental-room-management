import { useState } from 'react'
import { useParams } from 'react-router'
import { Panel, QueryState, Modal, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { Records, ActionDialog } from '@/features/manager/components'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { useSession } from '@/features/auth/session-store'
import { dateTime } from '@/lib/activity'
import { AdminPage, AdminStatus, AdminLink, AdminFilters } from './components'
import { useAdminQuery, useAdminFilters, useAdminMutation } from './context'
import { eventNames, statusNames } from './labels'
export function AdminDashboard() {
  const query = useAdminQuery('dashboard', adminApi.summary),
    [reset, setReset] = useState(false),
    mutation = useAdminMutation(adminApi.reset, () => setReset(false)),
    email = useSession((s) => s.user!.email)
  return (
    <AdminPage
      title="Tổng quan quản trị"
      description="Tài khoản, hồ sơ chờ xét duyệt và hoạt động quản trị."
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Tổng tài khoản', query.data.totalUsers],
                [
                  'Đang hoạt động',
                  query.data.accounts.find((a) => a.status === 'ACTIVE')?.count || 0,
                ],
                ['Hồ sơ chờ duyệt', query.data.pendingOwners],
                ['Chủ trọ đủ điều kiện', query.data.approvedOwners],
              ].map(([label, count]) => (
                <div className="bg-surface p-5" key={String(label)}>
                  <p className="text-xs leading-5 text-muted-foreground">{label}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{count}</p>
                </div>
              ))}
            </div>
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
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${query.data!.totalUsers ? (a.count / query.data!.totalUsers) * 100 : 0}%`,
                          }}
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
export function AdminRoles() {
  const query = useAdminQuery('roles', adminApi.roles),
    [selected, setSelected] = useState<string | null>(null),
    role = query.data?.find((r) => r.id === selected)
  return (
    <AdminPage
      title="Vai trò & quyền truy cập"
      description="Năm vai trò chính thức và phạm vi tài nguyên. Danh sách chỉ đọc."
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        <div className="grid gap-5 sm:grid-cols-2">
          {query.data?.map((r) => (
            <Panel key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold">{r.name}</h2>
                <span className="text-xs font-bold text-primary">{r.id}</span>
              </div>
              <p className="my-3 text-sm leading-6 text-muted-foreground">{r.description}</p>
              <p className="text-xs">{r.userCount} tài khoản có vai trò</p>
              <Button variant="ghost" className="mt-4" onClick={() => setSelected(r.id)}>
                Xem phạm vi {r.name.toLowerCase()}
              </Button>
            </Panel>
          ))}
        </div>
      </QueryState>
      <Modal
        title={role?.name || 'Phạm vi vai trò'}
        open={!!role}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {role && (
          <div className="grid gap-5">
            <Facts
              items={[
                ['Trách nhiệm', role.description],
                ['Phạm vi', role.scope],
                ['Điều kiện', role.requirement],
              ]}
            />
            <AdminLink to={`/admin/users?role=${role.id}`}>Xem tài khoản có vai trò</AdminLink>
            <Notice>Không cấp hoặc thu hồi vai trò tùy ý từ màn hình này.</Notice>
          </div>
        )}
      </Modal>
    </AdminPage>
  )
}
export function AdminOwners() {
  const state = useAdminFilters({ status: '' }),
    query = useAdminQuery('owners', () => adminApi.list('owners', state.filters), [state.filters])
  return (
    <AdminPage
      title="Danh bạ chủ trọ"
      description="Tài khoản có vai trò OWNER; trạng thái xác minh và tài khoản được theo dõi riêng."
    >
      <AdminFilters state={state} statuses={['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']} />
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chủ trọ phù hợp."
        columns={[
          {
            label: 'Chủ trọ',
            render: (u) => <AdminLink to={`/admin/users/${u.id}`}>{u.fullName}</AdminLink>,
          },
          {
            label: 'Liên hệ',
            render: (u) => <span className="break-all">{u.email || u.phone || 'Chưa có'}</span>,
          },
          { label: 'Tài khoản', render: (u) => <AdminStatus value={u.status} /> },
          {
            label: 'Xác minh',
            render: (u) => (
              <AdminLink to={`/admin/owner-verifications/${u.id}`}>
                <AdminStatus value={u.ownerVerificationStatus || 'NOT_SUBMITTED'} />
              </AdminLink>
            ),
          },
          {
            label: 'Chi nhánh',
            render: (u) => (
              <AdminLink to={`/admin/branches?ownerId=${u.id}`}>
                {u.scope?.ownedBranches || 0} chi nhánh
              </AdminLink>
            ),
          },
          {
            label: 'Ngày xét duyệt',
            render: (u) => (u.ownerReviewedAt ? dateTime(u.ownerReviewedAt) : 'Chưa có'),
          },
        ]}
      />
    </AdminPage>
  )
}
export function AdminBranches() {
  const state = useAdminFilters({ status: '', province: '', ownerId: '' }),
    query = useAdminQuery('branches', () => adminApi.list('branches', state.filters), [
      state.filters,
    ]),
    [selected, setSelected] = useState<string | null>(null),
    branch = query.data?.content.find((b) => b.id === selected)
  return (
    <AdminPage
      title="Danh bạ chi nhánh"
      description="Thông tin hành chính cơ bản. Cấu hình và nghiệp vụ do chủ trọ/quản lý có quyền thực hiện."
    >
      <AdminFilters state={state} statuses={['DRAFT', 'ACTIVE', 'INACTIVE']}>
        <input
          aria-label="Lọc tỉnh thành"
          className="input w-auto max-w-full"
          placeholder="Tỉnh / thành phố"
          value={state.filters.province}
          onChange={(e) => state.change('province', e.target.value)}
        />
        <input
          aria-label="Mã chủ trọ"
          className="input w-auto max-w-full"
          placeholder="Mã chủ trọ"
          value={state.filters.ownerId}
          onChange={(e) => state.change('ownerId', e.target.value)}
        />
      </AdminFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chi nhánh phù hợp."
        columns={[
          {
            label: 'Chi nhánh',
            render: (b) => (
              <button
                className="min-h-11 text-left text-sm font-bold text-primary"
                onClick={() => setSelected(b.id)}
              >
                {b.name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {b.code}
                </span>
              </button>
            ),
          },
          { label: 'Địa chỉ', render: (b) => b.address },
          { label: 'Trạng thái', render: (b) => <AdminStatus value={b.status} /> },
          {
            label: 'Chủ trọ',
            render: (b) => <AdminLink to={`/admin/users/${b.ownerId}`}>{b.ownerName}</AdminLink>,
          },
          { label: 'Quản lý', render: (b) => b.managerName || 'Chưa phân công' },
        ]}
      />
      <Modal
        title="Thông tin hành chính chi nhánh"
        open={!!branch}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {branch && (
          <>
            <Facts
              items={[
                ['Mã chi nhánh', <span className="break-all">{branch.id}</span>],
                ['Code', branch.code],
                ['Tên', branch.name],
                ['Địa chỉ', branch.address],
                ['Tỉnh / thành phố', branch.province || 'Chưa cung cấp'],
                ['Trạng thái', <AdminStatus value={branch.status} />],
                ['Chủ trọ', branch.ownerName],
                ['Quản lý', branch.managerName || 'Chưa phân công'],
                [
                  'Ngày tạo',
                  branch.createdAt ? dateTime(branch.createdAt) : 'Nguồn dữ liệu chưa cung cấp',
                ],
              ]}
            />
            <AdminLink to={`/admin/users/${branch.ownerId}`}>Xem tài khoản chủ trọ</AdminLink>
          </>
        )}
      </Modal>
    </AdminPage>
  )
}
export function AdminActivity() {
  const state = useAdminFilters({ type: '', from: '', to: '' }),
    query = useAdminQuery('activity', () => adminApi.list('activity', state.filters), [
      state.filters,
    ])
  return (
    <AdminPage
      title="Nhật ký hoạt động"
      description="Sự kiện quản trị được phép, chỉ đọc và không chứa bí mật xác thực."
    >
      <AdminFilters state={state} dates>
        <select
          aria-label="Loại sự kiện"
          className="input w-auto max-w-full"
          value={state.filters.type}
          onChange={(e) => state.change('type', e.target.value)}
        >
          <option value="">Mọi sự kiện</option>
          {Object.entries(eventNames).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </AdminFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có sự kiện phù hợp."
        columns={[
          {
            label: 'Sự kiện',
            render: (a) => (
              <AdminLink to={`/admin/activity/${a.id}`}>
                {eventNames[a.action] || a.summary}
              </AdminLink>
            ),
          },
          { label: 'Người thực hiện', render: (a) => a.actorName },
          { label: 'Nội dung', render: (a) => a.summary },
          { label: 'Thời gian', render: (a) => dateTime(a.occurredAt) },
        ]}
      />
    </AdminPage>
  )
}
export function AdminAuditDetail() {
  const { eventId = '' } = useParams(),
    query = useAdminQuery('audit', () => adminApi.event(eventId), [eventId]),
    [copy, setCopy] = useState(false)
  return (
    <AdminPage
      title="Chi tiết sự kiện"
      actions={<AdminLink to="/admin/activity">Về nhật ký</AdminLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <Panel>
            <Facts
              items={[
                ['Mã audit', <span className="break-all">{query.data.id}</span>],
                ['Người thực hiện', query.data.actorName],
                [
                  'Mã người thực hiện',
                  <span className="break-all">{query.data.actorUserId || 'Hệ thống'}</span>,
                ],
                [
                  'Tài nguyên',
                  query.data.tableName === 'users'
                    ? 'Tài khoản'
                    : query.data.tableName === 'branches'
                      ? 'Chi nhánh'
                      : 'Quan hệ quản lý',
                ],
                ['Mã tài nguyên', <span className="break-all">{query.data.entityId}</span>],
                ['Hành động', eventNames[query.data.action] || query.data.summary],
                ['Nội dung', query.data.summary],
                ['Lý do', query.data.reason || 'Không có ghi chú'],
                ['Thời gian', dateTime(query.data.occurredAt)],
                [
                  'Mã yêu cầu',
                  <span className="break-all">
                    {query.data.requestKey || 'Không được cung cấp'}
                  </span>,
                ],
                ...Object.entries(query.data.detail).map(([key, value]): [string, string] => [
                  {
                    previousStatus: 'Trạng thái trước',
                    status: 'Trạng thái sau',
                    verificationStatus: 'Kết quả xác minh',
                    provisionedOwner: 'Cấp quyền qua danh tính',
                    branchName: 'Chi nhánh',
                  }[key] || 'Thông tin',
                  typeof value === 'boolean'
                    ? value
                      ? 'Có'
                      : 'Không'
                    : statusNames[String(value)] || String(value),
                ]),
              ]}
            />
            <div className="mt-5 flex flex-wrap gap-4">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(eventId)
                    setCopy(true)
                  } catch {
                    setCopy(false)
                  }
                }}
              >
                {copy ? 'Đã sao chép' : 'Sao chép mã audit'}
              </Button>
              <AdminLink
                to={
                  query.data.tableName === 'users'
                    ? `/admin/users/${query.data.entityId}`
                    : '/admin/branches'
                }
              >
                Mở tài nguyên liên quan
              </AdminLink>
            </div>
          </Panel>
        )}
      </QueryState>
    </AdminPage>
  )
}
