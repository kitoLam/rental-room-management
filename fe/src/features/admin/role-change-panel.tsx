import { InlineError, Modal, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Records, SearchBox } from '@/features/manager/components'
import { type AdminUser } from '@/interfaces/admin'
import { adminApi } from '@/services/admin'
import { useState } from 'react'
import { AdminStatus } from './components'
import { useAdminMutation, useAdminQuery } from './context'

const flows = {
  TENANT: { to: 'OWNER', label: 'Người thuê → Chủ trọ', action: 'Nâng lên Chủ trọ' },
  MANAGER: { to: 'TENANT', label: 'Quản lý → Người thuê', action: 'Hạ xuống Người thuê' },
} as const
type Flow = keyof typeof flows

/** Admin-only role changes; the backend accepts exactly these two transitions. */
export function RoleChangePanel() {
  const [from, setFrom] = useState<Flow>('TENANT'),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [target, setTarget] = useState<AdminUser | null>(null),
    [done, setDone] = useState(''),
    flow = flows[from],
    query = useAdminQuery(
      'role-change-users',
      () => adminApi.users({ role: from, q, page: String(page - 1), size: '8' }),
      [from, q, page],
    ),
    mutation = useAdminMutation(
      (user: AdminUser) => adminApi.changeRole(user.id, flow.to),
      (updated) => {
        setDone(`Đã đổi vai trò của ${updated.fullName}.`)
        setTarget(null)
      },
    )
  return (
    <Panel className="mt-5">
      <h2 className="font-bold">Thay đổi vai trò người dùng</h2>
      <p className="my-3 text-sm leading-6 text-muted-foreground">
        Chỉ hỗ trợ Người thuê → Chủ trọ và Quản lý → Người thuê. Vai trò có hiệu lực ngay ở lần
        truy cập tiếp theo của người dùng.
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="input w-auto"
          aria-label="Luồng đổi vai trò"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value as Flow)
            setPage(1)
            setDone('')
          }}
        >
          {(Object.keys(flows) as Flow[]).map((k) => (
            <option key={k} value={k}>
              {flows[k].label}
            </option>
          ))}
        </select>
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
                <p className="mt-1 text-xs text-muted-foreground">{u.phone || 'Chưa có điện thoại'}</p>
              </>
            ),
          },
          { label: 'Trạng thái', render: (u) => <AdminStatus value={u.status} /> },
          {
            label: 'Thao tác',
            render: (u) => (
              <Button
                variant="outline"
                onClick={() => {
                  mutation.reset()
                  setDone('')
                  setTarget(u)
                }}
              >
                {flow.action}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!target}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setTarget(null)
        }}
        title={`${flow.action}?`}
      >
        {target && (
          <>
            <p className="mb-1 text-sm font-bold">{target.fullName}</p>
            <p className="mb-5 break-all text-sm text-muted-foreground">
              {target.email || target.phone}
            </p>
            <Notice>{`Đổi vai trò: ${flow.label}.`}</Notice>
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
