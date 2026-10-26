import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Copy } from 'lucide-react'
import { Panel, QueryState, Notice, InlineError, Modal, Field } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { Records, ManagerForm } from '@/features/manager/components'
import { userCreateSchema, type AdminUser } from '@/interfaces/admin'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { useSession } from '@/features/auth/session-store'
import { dateTime } from '@/lib/activity'
import { AdminPage, AdminLink, AdminStatus, AdminFilters } from './components'
import { useAdminQuery, useAdminMutation, useAdminFilters } from './context'
import { eventNames, roleNames } from './labels'
export function AdminUsers() {
  const state = useAdminFilters({ status: '', role: '', from: '', to: '' }),
    real = provider('adminUsers') === 'real',
    query = useAdminQuery('users', () => adminApi.users(state.filters), [state.filters])
  return (
    <AdminPage
      title="Người dùng"
      description="Quản lý danh tính và trạng thái tài khoản."
      actions={
        <Button asChild>
          <Link to="/admin/users/new">Mời người dùng</Link>
        </Button>
      }
    >
      {real && (
        <Notice>
          API hiện hỗ trợ phân trang. Tìm kiếm, lọc vai trò và ngày trên toàn bộ dữ liệu chưa được
          Backend cung cấp.
        </Notice>
      )}
      <AdminFilters
        state={state}
        search={!real}
        statuses={real ? [] : ['INVITED', 'PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED']}
        dates={!real}
      >
        {!real && (
          <select
            className="input w-auto"
            aria-label="Lọc vai trò"
            value={state.filters.role}
            onChange={(e) => state.change('role', e.target.value)}
          >
            <option value="">Mọi vai trò</option>
            {['USER', 'TENANT', 'MANAGER', 'OWNER', 'ADMIN'].map((r) => (
              <option value={r} key={r}>
                {roleNames[r]}
              </option>
            ))}
          </select>
        )}
      </AdminFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có người dùng phù hợp."
        columns={[
          {
            label: 'Người dùng',
            render: (u) => <AdminLink to={`/admin/users/${u.id}`}>{u.fullName}</AdminLink>,
          },
          {
            label: 'Liên hệ',
            render: (u) => (
              <>
                <p className="break-all">{u.email || 'Chưa có email'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.phone || 'Chưa có điện thoại'}
                </p>
              </>
            ),
          },
          { label: 'Trạng thái', render: (u) => <AdminStatus value={u.status} /> },
          {
            label: 'Vai trò',
            render: (u) => u.roles?.map((r) => roleNames[r]).join(', ') || 'Chưa được API cung cấp',
          },
          { label: 'Ngày tạo', render: (u) => dateTime(u.createdAt) },
        ]}
      />
    </AdminPage>
  )
}
function StatusAction({ target }: { target: AdminUser }) {
  const self = useSession((s) => s.user!.id) === target.id,
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    active = target.status === 'DISABLED',
    mutation = useAdminMutation(
      (value: { active: boolean; reason: string }) =>
        adminApi.status(target.id, value.active, target.version, value.reason),
      () => setOpen(false),
    )
  const canAct = (target.status === 'ACTIVE' && !self) ||
    (active && (target.canActivate === true || provider('adminUsers') === 'real'))
  return (
    <>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={!canAct}
          onClick={() => {
            setOpen(true)
            mutation.reset()
          }}
        >
          {active ? 'Kích hoạt lại' : 'Ngừng kích hoạt'}
        </Button>
      </div>
      {self && (
        <p className="mt-3 text-xs text-muted-foreground">
          Không tự vô hiệu hóa tài khoản quản trị đang sử dụng.
        </p>
      )}
      {active && target.canActivate === undefined && provider('adminUsers') === 'mock' && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cần API xác nhận điều kiện đăng nhập và xác minh trước khi mở kích hoạt lại.
        </p>
      )}
      {['INVITED', 'PENDING_VERIFICATION', 'LOCKED'].includes(target.status) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tài khoản cần hoàn tất xác minh hoặc quy trình mở khóa phù hợp.
        </p>
      )}
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) setOpen(v)
        }}
        title={active ? 'Kích hoạt lại tài khoản?' : 'Ngừng kích hoạt tài khoản?'}
      >
        <p className="mb-3 text-sm font-bold">{target.fullName}</p>
        <p className="mb-5 break-all text-sm text-muted-foreground">
          {target.email || target.phone}
        </p>
        <Notice>
          {active
            ? 'Chỉ kích hoạt tài khoản đã đủ điều kiện truy cập.'
            : provider('adminUsers') === 'mock'
              ? 'Các phiên demo của tài khoản sẽ bị thu hồi. Quan hệ và dữ liệu nghiệp vụ được giữ lại.'
              : 'Máy chủ sẽ kiểm tra và cập nhật trạng thái tài khoản.'}
        </Notice>
        {provider('adminUsers') === 'mock' && (
          <div className="my-5">
            <Field id="admin-status-reason" label="Ghi chú (không bắt buộc)">
              <textarea
                id="admin-status-reason"
                className="input min-h-24"
                maxLength={1000}
                value={reason}
                disabled={mutation.isPending}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
        )}
        <InlineError error={mutation.error} />
        <Button
          className="mt-5"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ active, reason })}
        >
          {mutation.isPending ? 'Đang cập nhật…' : 'Xác nhận thay đổi'}
        </Button>
      </Modal>
      {mutation.isSuccess && <Notice tone="success">Đã cập nhật trạng thái tài khoản.</Notice>}
    </>
  )
}
export function AdminUserDetail() {
  const { userId = '' } = useParams(),
    query = useAdminQuery('user', () => adminApi.user(userId), [userId]),
    activity = useAdminQuery(
      'user-activity',
      () => adminApi.list('activity', { userId, size: '5' }),
      [userId],
    ),
    [copied, setCopied] = useState(false)
  return (
    <AdminPage
      title={query.data?.fullName || 'Thông tin người dùng'}
      actions={<AdminLink to="/admin/users">Danh sách người dùng</AdminLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Mã người dùng', <span className="break-all">{query.data.id}</span>],
                  ['Email', query.data.email || 'Chưa có'],
                  ['Điện thoại', query.data.phone || 'Chưa có'],
                  ['Trạng thái', <AdminStatus value={query.data.status} />],
                  ['Ngày tạo', dateTime(query.data.createdAt)],
                  [
                    'Vai trò',
                    query.data.roles?.map((r) => roleNames[r]).join(', ') || 'API chưa cung cấp',
                  ],
                  [
                    'Xác minh chủ trọ',
                    query.data.ownerVerificationStatus ? (
                      <AdminStatus value={query.data.ownerVerificationStatus} />
                    ) : (
                      'API chưa cung cấp'
                    ),
                  ],
                  [
                    'Xác minh liên hệ',
                    query.data.contactVerified === undefined
                      ? 'API chưa cung cấp'
                      : query.data.contactVerified
                        ? 'Đã xác minh'
                        : 'Chưa xác minh',
                  ],
                ]}
              />
              <Button
                variant="ghost"
                className="mt-3"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(userId)
                    setCopied(true)
                  } catch {
                    setCopied(false)
                  }
                }}
              >
                <Copy size={16} />
                {copied ? 'Đã sao chép' : 'Sao chép mã người dùng'}
              </Button>
              <StatusAction
                key={`${userId}:${query.data.version}:${query.data.status}`}
                target={query.data}
              />
            </Panel>
            {query.data.scope && (
              <Panel>
                <h2 className="mb-4 font-bold">Phạm vi quan hệ</h2>
                <Facts
                  items={[
                    ['Chi nhánh sở hữu', String(query.data.scope.ownedBranches)],
                    ['Chi nhánh quản lý', String(query.data.scope.assignedBranches)],
                    ['Quan hệ thuê', String(query.data.scope.tenancies)],
                  ]}
                />
                <AdminLink to={`/admin/owner-verifications/${userId}`}>
                  Xem hồ sơ xác minh chủ trọ
                </AdminLink>
                <AdminLink to={`/admin/branches?ownerId=${userId}`}>
                  Danh bạ chi nhánh của tài khoản
                </AdminLink>
              </Panel>
            )}
            <Panel>
              <h2 className="mb-4 font-bold">Hoạt động quản trị liên quan</h2>
              <QueryState
                pending={activity.isPending}
                error={activity.error}
                retry={activity.refetch}
                empty={activity.data?.content.length === 0}
                emptyMessage="Chưa có sự kiện quản trị."
                emptyAction={null}
              >
                {activity.data?.content.map((a) => (
                  <div className="border-t border-border py-3" key={a.id}>
                    <AdminLink to={`/admin/activity/${a.id}`}>
                      {eventNames[a.action] || a.summary}
                    </AdminLink>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(a.occurredAt)} · {a.actorName}
                    </p>
                  </div>
                ))}
              </QueryState>
            </Panel>
          </>
        )}
      </QueryState>
    </AdminPage>
  )
}
export function AdminUserCreate() {
  const navigate = useNavigate(),
    mutation = useAdminMutation(adminApi.create, (u) => navigate(`/admin/users/${u.id}`))
  return (
    <AdminPage
      title="Mời người dùng"
      description="Tài khoản được mời cần hoàn tất quy trình danh tính trước khi truy cập."
      actions={<AdminLink to="/admin/users">Hủy và về danh sách</AdminLink>}
    >
      <Panel>
        <ManagerForm
          schema={userCreateSchema}
          defaults={{ fullName: '', email: '', phone: '', dateOfBirth: '', gender: '' }}
          fields={[
            { name: 'fullName', label: 'Họ và tên' },
            { name: 'email', label: 'Email (hoặc số điện thoại)' },
            {
              name: 'phone',
              label: 'Điện thoại quốc tế',
              hint: 'Ví dụ +84901234567; chỉ cần email hoặc điện thoại.',
            },
            { name: 'dateOfBirth', label: 'Ngày sinh (không bắt buộc)', kind: 'date' },
            {
              name: 'gender',
              label: 'Giới tính (không bắt buộc)',
              kind: 'select',
              options: [
                { value: 'MALE', label: 'Nam' },
                { value: 'FEMALE', label: 'Nữ' },
                { value: 'OTHER', label: 'Khác' },
              ],
            },
          ]}
          pending={mutation.isPending}
          error={mutation.error}
          submitLabel="Tạo tài khoản được mời"
          onSubmit={(v) => mutation.mutate(v)}
        />
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Thao tác chỉ tạo bản ghi tài khoản; chưa xác nhận gửi email hoặc SMS. Không tạo mật khẩu
          mặc định hoặc cấp quyền đặc biệt.
        </p>
      </Panel>
    </AdminPage>
  )
}
