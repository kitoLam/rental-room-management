import { Field, InlineError, Modal, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { type AdminUser } from '@/interfaces/admin'
import { adminApi } from '@/services/admin'
import { provider } from '@/services/config'
import { useState } from 'react'
import { useAdminMutation } from './context'

export function StatusAction({ target }: { target: AdminUser }) {
  const self = useSession((s) => s.user!.id) === target.id,
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    active = target.status === 'DISABLED',
    mutation = useAdminMutation(
      (value: { active: boolean; reason: string }) =>
        adminApi.status(target.id, value.active, target.version, value.reason),
      () => setOpen(false),
    )
  const canAct =
    (target.status === 'ACTIVE' && !self) ||
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
