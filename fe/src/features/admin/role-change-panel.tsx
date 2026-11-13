import { InlineError, Modal, Notice, Panel } from '@/components/common/page'
import { StatusBadge, type StatusTone } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Records, SearchBox } from '@/features/manager/components'
import { type AdminUser } from '@/interfaces/admin'
import { adminApi } from '@/services/admin'
import { useState } from 'react'
import { AdminStatus } from './components'
import { useAdminMutation, useAdminQuery } from './context'

const roleNames: Record<string, string> = {
  TENANT: 'Người thuê',
  MANAGER: 'Quản lý',
  OWNER: 'Chủ trọ',
  ADMIN: 'Quản trị viên',
}
const roleTones: Record<string, StatusTone> = {
  TENANT: 'neutral',
  MANAGER: 'info',
  OWNER: 'success',
  ADMIN: 'warning',
}

/** The only transitions the backend accepts, keyed by the user's current role. */
const changes = {
  TENANT: {
    to: 'OWNER',
    action: 'Nâng lên Chủ trọ',
    effects: ['Tài khoản có quyền sở hữu và quản lý cơ sở.'],
  },
  MANAGER: {
    to: 'TENANT',
    action: 'Hạ xuống Người thuê',
    effects: [
      'Các phân công quản lý của tài khoản chuyển sang INACTIVE.',
      'Mất quyền vận hành ở mọi cơ sở.',
    ],
  },
  OWNER: {
    to: 'TENANT',
    action: 'Hạ xuống Người thuê',
    effects: ['Chỉ hạ được khi không còn cơ sở đang sở hữu, nếu còn hệ thống sẽ từ chối.'],
  },
} as const
type Changeable = keyof typeof changes
const changeable = (role?: string): role is Changeable => !!role && role in changes

const filters = ['', 'TENANT', 'MANAGER', 'OWNER'] as const

/** Admin-only role changes; each row offers the one transition valid for its current role. */
export function RoleChangePanel({
  role,
  onRole,
}: {
  role: string
  onRole: (role: string) => void
}) {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [target, setTarget] = useState<AdminUser | null>(null),
    [done, setDone] = useState(''),
    targetRole = target?.roles?.[0],
    change = changeable(targetRole) ? changes[targetRole] : null,
    query = useAdminQuery(
      'role-change-users',
      () => adminApi.users({ role, q, page: String(page - 1), size: '8' }),
      [role, q, page],
    ),
    mutation = useAdminMutation(
      (user: AdminUser) => adminApi.changeRole(user.id, change!.to),
      (updated) => {
        setDone(`Đã đổi vai trò của ${updated.fullName}.`)
        setTarget(null)
      },
    )
  return (
    <Panel className="mt-5">
      <h2 className="font-bold">Thay đổi vai trò người dùng</h2>
      <p className="my-3 text-sm leading-6 text-muted-foreground">
        Chọn một vai trò ở trên hoặc dùng bộ lọc nhanh, rồi bấm nút ở từng dòng. Vai trò có hiệu lực
        ngay ở lần truy cập tiếp theo của người dùng.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo vai trò">
          {filters.map((k) => (
            <Button
              key={k || 'all'}
              size="sm"
              variant={role === k ? 'default' : 'outline'}
              aria-pressed={role === k}
              onClick={() => {
                onRole(k)
                setPage(1)
                setDone('')
              }}
            >
              {k ? roleNames[k] : 'Tất cả'}
            </Button>
          ))}
        </div>
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
          placeholder="Tìm theo tên, email hoặc số điện thoại…"
        />
      </div>
      {done && <Notice tone="success">{done}</Notice>}
      <Records
        query={query}
        page={page}
        onPage={setPage}
        empty="Không có người dùng phù hợp."
        columns={[
          { label: 'Người dùng', render: (u) => <strong>{u.fullName}</strong> },
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
          {
            label: 'Vai trò',
            render: (u) => {
              const r = u.roles?.[0] ?? ''
              return <StatusBadge tone={roleTones[r] ?? 'neutral'}>{roleNames[r] ?? r}</StatusBadge>
            },
          },
          { label: 'Trạng thái', render: (u) => <AdminStatus value={u.status} /> },
          {
            label: 'Thao tác',
            render: (u) => {
              const r = u.roles?.[0]
              if (!changeable(r))
                return <span className="text-xs text-muted-foreground">Tài khoản hệ thống</span>
              return (
                <Button
                  size="sm"
                  variant={r === 'TENANT' ? 'default' : 'outline'}
                  onClick={() => {
                    mutation.reset()
                    setDone('')
                    setTarget(u)
                  }}
                >
                  {changes[r].action}
                </Button>
              )
            },
          },
        ]}
      />
      <Modal
        open={!!target}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setTarget(null)
        }}
        title={change ? `${change.action}?` : 'Đổi vai trò'}
      >
        {target && change && (
          <>
            <p className="mb-1 text-sm font-bold">{target.fullName}</p>
            <p className="mb-4 break-all text-sm text-muted-foreground">
              {target.email || target.phone}
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge tone={roleTones[targetRole!]}>{roleNames[targetRole!]}</StatusBadge>
              <span aria-hidden>→</span>
              <StatusBadge tone={roleTones[change.to]}>{roleNames[change.to]}</StatusBadge>
            </div>
            <Notice>
              <ul className="list-disc pl-4">
                {change.effects.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Notice>
            <InlineError error={mutation.error} />
            <Button
              className="mt-5"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(target)}
            >
              {mutation.isPending ? 'Đang cập nhật…' : 'Xác nhận thay đổi'}
            </Button>
          </>
        )}
      </Modal>
    </Panel>
  )
}
