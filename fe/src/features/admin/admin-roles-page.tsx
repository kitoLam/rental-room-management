import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { useState } from 'react'
import { AdminLink, AdminPage } from './components'
import { useAdminQuery } from './context'
import { RoleChangePanel } from './role-change-panel'

export function AdminRoles() {
  const query = useAdminQuery('roles', adminApi.roles),
    [selected, setSelected] = useState<string | null>(null),
    role = query.data?.find((r) => r.id === selected)
  return (
    <AdminPage
      title="Vai trò & quyền truy cập"
      description="Các vai trò chính thức, phạm vi tài nguyên và đổi vai trò người dùng."
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
      {provider('adminUsers') === 'real' ? (
        <RoleChangePanel />
      ) : (
        <Notice>Đổi vai trò người dùng cần chế độ API thật (provider adminUsers = real).</Notice>
      )}
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
            <Notice>Chỉ cho phép Người thuê → Chủ trọ và Quản lý → Người thuê.</Notice>
          </div>
        )}
      </Modal>
    </AdminPage>
  )
}
