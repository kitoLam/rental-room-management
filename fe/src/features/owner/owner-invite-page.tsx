import { Notice, Panel } from '@/components/common/page'
import { ManagerForm } from '@/features/manager/components'
import { invitationInputSchema } from '@/interfaces/owner'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { OwnerPage } from './components'
import { useOwner, useOwnerMutation } from './context'

export function OwnerInvite() {
  const { branches } = useOwner(),
    [selected, setSelected] = useState<string[]>([]),
    navigate = useNavigate(),
    mutation = useOwnerMutation(() => navigate('/owner/managers'))
  return (
    <OwnerPage
      title="Mời quản lý"
      description="Người nhận đăng nhập bằng email đã xác minh và tự xác nhận tham gia."
    >
      <Panel>
        <Notice>
          Lời mời chưa cấp quyền truy cập chi nhánh. Phân công cần được xác nhận riêng sau khi người
          nhận chấp thuận. Trong demo, lời mời được lưu tại tài khoản và không gửi email thật.
        </Notice>
        <div className="mt-6">
          <ManagerForm
            schema={invitationInputSchema.omit({ branchIds: true })}
            defaults={{ fullName: '', email: '', phone: '', note: '' }}
            fields={[
              { name: 'fullName', label: 'Họ tên người nhận' },
              { name: 'email', label: 'Email người nhận' },
              { name: 'phone', label: 'Điện thoại (không bắt buộc)' },
              { name: 'note', label: 'Lời nhắn', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Gửi lời mời"
            onSubmit={(v) =>
              mutation.mutate({ path: '/invitations', value: { ...v, branchIds: selected } })
            }
          >
            <fieldset>
              <legend className="mb-3 text-sm font-bold">Dự kiến phụ trách</legend>
              <div className="grid gap-2">
                {branches.map((b) => (
                  <label key={b.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      disabled={mutation.isPending}
                      checked={selected.includes(b.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, b.id] : s.filter((id) => id !== b.id),
                        )
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </ManagerForm>
        </div>
      </Panel>
    </OwnerPage>
  )
}
