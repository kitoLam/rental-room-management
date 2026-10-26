import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut, Save, ShieldCheck } from 'lucide-react'
import { Page, Panel, Field, InlineError, Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { profileSchema, today } from '@/lib/validation'
import { profileService, authService } from '@/services/guest-user'
import { queryClient } from '@/services/query-client'
import { useSession } from '@/features/auth/session-store'
import type { User } from '@/interfaces/domain'
function ProfileForm({ user }: { user: User }) {
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()
  const values = {
    fullName: user.fullName,
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: (['MALE', 'FEMALE', 'OTHER'].includes(user.gender || '') ? user.gender : '') as z.infer<
      typeof profileSchema
    >['gender'],
  }
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: values,
  })
  const update = useMutation({
    mutationFn: profileService.update,
    onSuccess: (data) => {
      useSession.getState().updateUser(data)
      queryClient.setQueryData(['profile', user.id], data)
      setSaved(true)
      form.reset({
        fullName: data.fullName,
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        gender: (data.gender || '') as z.infer<typeof profileSchema>['gender'],
      })
    },
  })
  const logout = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      navigate('/', { replace: true, flushSync: true })
      useSession.getState().clear()
      queryClient.clear()
    },
  })
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <form
          className="grid gap-5"
          noValidate
          onChange={() => setSaved(false)}
          onSubmit={form.handleSubmit((value) => update.mutate(value))}
        >
          <h2 className="mb-1 font-bold">Thông tin cá nhân</h2>
          <Field
            id="profile-name"
            label="Họ và tên"
            error={form.formState.errors.fullName?.message}
          >
            <input
              id="profile-name"
              className="input"
              autoComplete="name"
              {...form.register('fullName')}
              aria-invalid={!!form.formState.errors.fullName}
            />
          </Field>
          <Field
            id="profile-email"
            label="Email"
            hint="Thay đổi email cần quy trình xác minh riêng."
          >
            <input id="profile-email" className="input" value={user.email} type="email" readOnly />
          </Field>
          <Field
            id="profile-phone"
            label="Số điện thoại"
            error={form.formState.errors.phone?.message}
          >
            <input
              id="profile-phone"
              className="input"
              type="tel"
              autoComplete="tel"
              {...form.register('phone')}
              aria-invalid={!!form.formState.errors.phone}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="profile-birth"
              label="Ngày sinh (tùy chọn)"
              error={form.formState.errors.dateOfBirth?.message}
            >
              <input
                id="profile-birth"
                className="input"
                type="date"
                max={today()}
                {...form.register('dateOfBirth')}
              />
            </Field>
            <Field id="profile-gender" label="Giới tính (tùy chọn)">
              <select id="profile-gender" className="input" {...form.register('gender')}>
                <option value="">Không cung cấp</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>
          </div>
          <InlineError error={update.error} />
          {saved && <Notice tone="success">Đã lưu thông tin cá nhân.</Notice>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
              <Save />
              Lưu thay đổi
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => {
                form.reset(values)
                setSaved(false)
              }}
            >
              Hủy thay đổi
            </Button>
          </div>
        </form>
      </Panel>
      <aside className="space-y-5">
        <Panel>
          <ShieldCheck className="mb-4 size-7 text-primary" />
          <h2 className="font-bold">Tài khoản & bảo mật</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {user.status === 'ACTIVE' ? 'Tài khoản đang hoạt động' : user.status}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Vai trò được máy chủ cung cấp: {user.roles.join(', ')}
          </p>
          <Link
            to="/forgot-password"
            className="mt-5 inline-flex min-h-11 items-center text-sm text-primary underline"
          >
            Khôi phục / đặt lại mật khẩu
          </Link>
          <InlineError error={logout.error} />
          <div className="mt-4 grid gap-3 text-sm font-bold text-primary"><Link to="/manager-invitations">Lời mời quản lý</Link><Link to={user.roles.includes('OWNER')?'/owner/dashboard':'/owner/onboarding'}>{user.roles.includes('OWNER')?'Không gian chủ trọ':'Đăng ký làm chủ trọ'}</Link></div>
          <Button
            variant="outline"
            loading={logout.isPending}
            className="mt-4 w-full"
            onClick={() => logout.mutate()}
          >
            <LogOut />
            Đăng xuất
          </Button>
        </Panel>
      </aside>
    </div>
  )
}
export default function ProfilePage() {
  const user = useSession((s) => s.user)
  const profile = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: profileService.get,
    enabled: !!user,
  })
  return (
    <Page
      title="Thông tin của bạn."
      eyebrow="HỒ SƠ CÁ NHÂN"
      description="Cập nhật thông tin liên hệ để chi nhánh có thể trao đổi về lịch hẹn và yêu cầu giữ chỗ."
    >
      <QueryState pending={profile.isPending} error={profile.error} retry={profile.refetch}>
        {profile.data && <ProfileForm user={profile.data} />}
      </QueryState>
    </Page>
  )
}
