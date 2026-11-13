import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Phone,
  Save,
  User as UserIcon,
  ArrowRight,
} from 'lucide-react'
import {
  Page,
  Panel,
  Field,
  InlineError,
  Notice,
} from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { profileSchema, changePasswordSchema, today } from '@/lib/validation'
import { profileService, authService } from '@/services/guest-user'
import { useSession } from '@/features/auth/session-store'
import type { User } from '@/interfaces/domain'

type ProfileFormData = z.infer<typeof profileSchema>
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

/* =========================================================================
   2. FORM: SỬA HỌ TÊN, SỐ ĐIỆN THOẠI & EMAIL KHÓA CỨNG (MỞ RỘNG)
   ========================================================================= */
function ProfileInfoForm({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const defaultValues: ProfileFormData = {
    fullName: user.fullName || '',
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: (['MALE', 'FEMALE', 'OTHER'].includes(user.gender || '') ? user.gender : '') as ProfileFormData['gender'],
  }

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset({
        fullName: user.fullName || '',
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth || '',
        gender: (['MALE', 'FEMALE', 'OTHER'].includes(user.gender || '') ? user.gender : '') as ProfileFormData['gender'],
      })
    }
  }, [user.fullName, user.phone, user.dateOfBirth, user.gender, form])

  const update = useMutation({
    mutationFn: profileService.update,
    onSuccess: (data) => {
      useSession.getState().updateUser(data)
      queryClient.setQueryData(['profile', user.id], data)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      form.reset({
        fullName: data.fullName,
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        gender: (data.gender || '') as ProfileFormData['gender'],
      })
    },
  })

  return (
    <Panel className="p-6">
      <form
        className="grid gap-5"
        noValidate
        onChange={() => setSaved(false)}
        onSubmit={form.handleSubmit((values) => update.mutate(values))}
      >
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <UserIcon className="size-5 text-primary" />
          <h2 className="font-bold text-base text-foreground">Thông tin cá nhân</h2>
        </div>

        {/* EMAIL KHÓA CỨNG - CHỈ ĐƯỢC XEM */}
        <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" />
              Email tài khoản (Khóa cố định)
            </label>
            <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Chỉ xem
            </span>
          </div>
          <input
            id="profile-email-readonly"
            className="input mt-1.5 bg-muted/60 text-muted-foreground cursor-not-allowed select-none font-medium"
            value={user.email}
            type="email"
            readOnly
            disabled
            aria-readonly="true"
          />
          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1">
            <Lock className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
            <span>
              Email là định danh tài khoản chính và được sử dụng để xác thực hợp đồng thuê. Trường này được khóa cứng để đảm bảo tính an toàn.
            </span>
          </p>
        </div>

        {/* HỌ VÀ TÊN - CÓ THỂ SỬA */}
        <Field
          id="profile-fullname"
          label="Họ và tên"
          error={form.formState.errors.fullName?.message}
          hint="Tên hiển thị trên hồ sơ thuê phòng và thông tin liên hệ."
        >
          <div className="relative">
            <UserIcon className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <input
              id="profile-fullname"
              className="input pl-10"
              autoComplete="name"
              placeholder="Nhập họ và tên đầy đủ"
              {...form.register('fullName')}
              aria-invalid={!!form.formState.errors.fullName}
            />
          </div>
        </Field>

        {/* SỐ ĐIỆN THOẠI - CÓ THỂ SỬA */}
        <Field
          id="profile-phone"
          label="Số điện thoại"
          error={form.formState.errors.phone?.message}
          hint="Số điện thoại liên hệ để quản lý liên lạc khi xem phòng."
        >
          <div className="relative">
            <Phone className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <input
              id="profile-phone"
              className="input pl-10"
              type="tel"
              autoComplete="tel"
              placeholder="VD: 0912345678"
              {...form.register('phone')}
              aria-invalid={!!form.formState.errors.phone}
            />
          </div>
        </Field>

        {/* NGÀY SINH & GIỚI TÍNH */}
        <div className="grid gap-4 sm:grid-cols-2">
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

        {(user.permanentAddress || user.cccdNumber || user.cccdIssueDate || user.cccdIssuePlace) && (
          <div className="rounded-lg border border-border/80 bg-muted/30 p-4 grid gap-3">
            <p className="text-xs font-bold text-foreground">Thông tin thường trú & CCCD đã đăng ký</p>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="sm:col-span-2">
                <span className="text-xs text-muted-foreground block">Địa chỉ thường trú</span>
                <span className="font-medium text-foreground">{user.permanentAddress || 'Chưa cập nhật'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Số CCCD</span>
                <span className="font-medium text-foreground">{user.cccdNumber || 'Chưa cập nhật'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Ngày cấp CCCD</span>
                <span className="font-medium text-foreground">{user.cccdIssueDate || 'Chưa cập nhật'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs text-muted-foreground block">Nơi cấp CCCD</span>
                <span className="font-medium text-foreground">{user.cccdIssuePlace || 'Chưa cập nhật'}</span>
              </div>
            </div>
          </div>
        )}

        <InlineError error={update.error} />
        {saved && <Notice tone="success">Đã cập nhật thông tin cá nhân thành công!</Notice>}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="submit"
            loading={update.isPending}
            disabled={!form.formState.isDirty}
          >
            <Save />
            Lưu thông tin cá nhân
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={update.isPending || !form.formState.isDirty}
            onClick={() => {
              form.reset(defaultValues)
              setSaved(false)
            }}
          >
            Hủy thay đổi
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/* =========================================================================
   3. FORM: ĐỔI MẬT KHẨU (THU NHỎ GỌN GÀNG)
   ========================================================================= */
function ChangePasswordForm() {
  const [success, setSuccess] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormData) => authService.changePassword(values),
    onSuccess: () => {
      setSuccess(true)
      form.reset()
    },
  })

  return (
    <Panel className="p-6">
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setSuccess(false)
          mutation.mutate(values)
        })}
      >
        <div className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <h2 className="font-bold text-base text-foreground">Đổi mật khẩu tài khoản</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bắt buộc phải nhập chính xác mật khẩu cũ thì mới được phép đổi sang mật khẩu mới.
          </p>
        </div>

        {/* MẬT KHẨU CŨ - BẮT BUỘC */}
        <Field
          id="pwd-old"
          label="Mật khẩu cũ (Hiện tại)"
          error={form.formState.errors.oldPassword?.message}
          hint="Mật khẩu hiện tại của tài khoản."
        >
          <div className="relative">
            <input
              id="pwd-old"
              className="input pr-10"
              type={showOld ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu hiện tại"
              {...form.register('oldPassword')}
              aria-invalid={!!form.formState.errors.oldPassword}
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowOld(!showOld)}
              tabIndex={-1}
              aria-label={showOld ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* MẬT KHẨU MỚI */}
        <Field
          id="pwd-new"
          label="Mật khẩu mới"
          error={form.formState.errors.newPassword?.message}
          hint="Tối thiểu 8 ký tự, gồm chữ hoa, thường, số & ký tự đặc biệt."
        >
          <div className="relative">
            <input
              id="pwd-new"
              className="input pr-10"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mới"
              {...form.register('newPassword')}
              aria-invalid={!!form.formState.errors.newPassword}
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(!showNew)}
              tabIndex={-1}
              aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* XÁC NHẬN MẬT KHẨU MỚI */}
        <Field
          id="pwd-confirm"
          label="Xác nhận mật khẩu mới"
          error={form.formState.errors.confirmPassword?.message}
        >
          <div className="relative">
            <input
              id="pwd-confirm"
              className="input pr-10"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              {...form.register('confirmPassword')}
              aria-invalid={!!form.formState.errors.confirmPassword}
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <InlineError error={mutation.error} />
        {success && <Notice tone="success">Đã cập nhật mật khẩu mới thành công!</Notice>}

        <div className="pt-1">
          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            disabled={!form.watch('oldPassword') || !form.watch('newPassword')}
          >
            <KeyRound />
            Cập nhật mật khẩu
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/* =========================================================================
   4. TRANG CHÍNH: PROFILE & DASHBOARD
   ========================================================================= */
export default function ProfilePage() {
  const navigate = useNavigate()
  const sessionUser = useSession((s) => s.user)

  const profile = useQuery({
    queryKey: ['profile', sessionUser?.id],
    queryFn: profileService.get,
    enabled: !!sessionUser,
  })

  // Sử dụng dữ liệu profile mới nhất nếu có, hoặc dùng thông tin sessionUser có sẵn
  const activeUser = profile.data || sessionUser

  const logout = useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      useSession.getState().clear()
      navigate('/login', { replace: true, flushSync: true })
    },
  })

  return (
    <Page
      wide
      title="Hồ sơ tài khoản"
      eyebrow="TÀI KHOẢN CÁ NHÂN"
      description="Quản lý thông tin liên lạc và bảo mật đăng nhập."
    >
      <div className="space-y-8">
        {/* KHU VỰC CHÍNH: HÀNG TRÊN CÙNG GỒM THÔNG TIN CÁ NHÂN + ĐỔI MẬT KHẨU (NGANG NHAU) VÀ ASIDE */}
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* CỘT CHÍNH: HÀNG NGANG CHỨA FORM THÔNG TIN (MỞ RỘNG) & FORM ĐỔI MẬT KHẨU (THU NHỎ) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* THÔNG TIN CÁ NHÂN - MỞ RỘNG (7/12 CỘT) */}
            <div className="md:col-span-7">
              {activeUser ? (
                <ProfileInfoForm user={activeUser} />
              ) : (
                <Panel className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 w-1/3 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                  </div>
                </Panel>
              )}
            </div>

            {/* ĐỔI MẬT KHẨU - THU NHỎ (5/12 CỘT) */}
            <div className="md:col-span-5">
              <ChangePasswordForm />
            </div>
          </div>

          {/* ASIDE: TÀI KHOẢN & LIÊN KẾT NHANH */}
          <aside className="space-y-5">
            <Panel className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary">
                  {activeUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground truncate">{activeUser?.fullName}</h3>
                  <p className="text-xs text-muted-foreground truncate">{activeUser?.email}</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-4 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <StatusBadge tone={activeUser?.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {activeUser?.status === 'ACTIVE' ? 'Đang hoạt động' : activeUser?.status}
                  </StatusBadge>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Vai trò:</span>
                  <span className="font-medium text-foreground">
                    {activeUser?.roles?.join(', ') || 'Khách thuê (TENANT)'}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Lối tắt nhanh
                </p>
                <Link
                  to="/manager-invitations"
                  className="flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1.5"
                >
                  <span>Lời mời làm quản lý</span>
                  <ArrowRight size={13} />
                </Link>
                {!activeUser?.roles?.includes('OWNER') && (
                  <Link
                    to="/owner/onboarding"
                    className="flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1.5"
                  >
                    <span>Đăng ký làm chủ trọ</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>

              <InlineError error={logout.error} />

              <Button
                variant="outline"
                loading={logout.isPending}
                className="mt-6 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => logout.mutate()}
              >
                <LogOut size={14} />
                Đăng xuất tài khoản
              </Button>
            </Panel>
          </aside>
        </div>

      </div>
    </Page>
  )
}
