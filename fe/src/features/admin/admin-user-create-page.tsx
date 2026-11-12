import { Panel } from '@/components/common/page'
import { ManagerForm } from '@/features/manager/components'
import { userCreateSchema } from '@/interfaces/admin'
import { adminApi } from '@/services/admin'
import { useNavigate } from 'react-router'
import { AdminLink, AdminPage } from './components'
import { useAdminMutation } from './context'

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
