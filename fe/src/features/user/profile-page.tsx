import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Save,
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
import { formatProfileDate } from '@/lib/format'
import { profileSchema, changePasswordSchema, today } from '@/lib/validation'
import { profileService, authService } from '@/services/guest-user'
import { useSession } from '@/features/auth/session-store'
import type { User } from '@/interfaces/domain'

type ProfileFormData = z.infer<typeof profileSchema>
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

function ProfileInfoForm({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const form = useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) })

  const update = useMutation({
    mutationFn: profileService.update,
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', user.id], data)
      form.reset()
      setEditing(false)
      setSaved(true)
    },
  })

  function startEditing() {
    update.reset()
    setSaved(false)
    form.reset({
      fullName: user.fullName || '',
      phone: user.phone || '',
      dateOfBirth: user.dateOfBirth || '',
      gender: user.gender === 'MALE' || user.gender === 'FEMALE' || user.gender === 'OTHER' ? user.gender : '',
      permanentAddress: user.permanentAddress || '',
      cccdNumber: '',
      cccdIssueDate: user.cccdIssueDate || '',
      cccdIssuePlace: user.cccdIssuePlace || '',
    })
    setEditing(true)
  }

  const genderLabel = user.gender === 'MALE' ? 'Nam' : user.gender === 'FEMALE' ? 'Nữ' : user.gender === 'OTHER' ? 'Khác' : ''
  const maskedCccd = user.cccdNumber
    ? (/^[0-9]{9,12}$/.test(user.cccdNumber) ? `•••• ${user.cccdNumber.slice(-4)}` : /^•••• [0-9]{4}$/.test(user.cccdNumber) ? user.cccdNumber : '••••')
    : ''
  const personal = [
    ['Họ và tên', user.fullName],
    ['Email tài khoản', user.email],
    ['Số điện thoại', user.phone],
    ['Ngày sinh', formatProfileDate(user.dateOfBirth).replace(/-/g, '/')],
    ['Giới tính', genderLabel],
  ]
  const identity = [
    ['Địa chỉ thường trú', user.permanentAddress],
    ['Số CCCD', maskedCccd],
    ['Ngày cấp CCCD', formatProfileDate(user.cccdIssueDate)],
    ['Nơi cấp CCCD', user.cccdIssuePlace],
  ]
  const facts = (rows: (string | null | undefined)[][]) => (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-words font-medium">{value || 'Chưa cập nhật'}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <Panel className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Thông tin cá nhân</h2>
        {!editing && <Button variant="outline" onClick={startEditing}>Chỉnh sửa</Button>}
      </div>
      {editing ? (
        <form className="grid gap-6" noValidate onSubmit={form.handleSubmit((values) => {
          const changed = form.formState.dirtyFields
          update.mutate({
            fullName: values.fullName,
            phone: values.phone,
            dateOfBirth: changed.dateOfBirth ? values.dateOfBirth : undefined,
            gender: changed.gender ? values.gender : undefined,
            permanentAddress: changed.permanentAddress ? values.permanentAddress : undefined,
            cccdNumber: values.cccdNumber || undefined,
            cccdIssueDate: changed.cccdIssueDate ? values.cccdIssueDate : undefined,
            cccdIssuePlace: changed.cccdIssuePlace ? values.cccdIssuePlace : undefined,
          })
        })}>
          <fieldset disabled={update.isPending} className="grid gap-4 sm:grid-cols-2">
            <Field id="profile-fullname" label="Họ và tên" error={form.formState.errors.fullName?.message}>
              <input id="profile-fullname" className="input" autoComplete="name" {...form.register('fullName')} />
            </Field>
            <Field id="profile-email" label="Email tài khoản">
              <input id="profile-email" className="input" type="email" value={user.email} readOnly />
            </Field>
            <Field id="profile-phone" label="Số điện thoại" error={form.formState.errors.phone?.message}>
              <input id="profile-phone" className="input" type="tel" autoComplete="tel" {...form.register('phone')} />
            </Field>
            <Field id="profile-birth" label="Ngày sinh" hint="Định dạng dd/mm/yyyy" error={form.formState.errors.dateOfBirth?.message}>
              <Controller control={form.control} name="dateOfBirth" render={({ field }) => (
                <input
                  {...field}
                  id="profile-birth"
                  className="input"
                  placeholder="dd/mm/yyyy"
                  autoComplete="bday"
                  value={(field.value ?? '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')}
                  onChange={(event) => field.onChange(event.target.value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1'))}
                />
              )} />
            </Field>
            <Field id="profile-gender" label="Giới tính" error={form.formState.errors.gender?.message}>
              <select id="profile-gender" className="input" {...form.register('gender')}>
                <option value="">Không cung cấp</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>
          </fieldset>
          <fieldset disabled={update.isPending} className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <legend className="pr-2 font-bold">Thông tin định danh</legend>
            <Field id="profile-address" label="Địa chỉ thường trú" error={form.formState.errors.permanentAddress?.message}>
              <input id="profile-address" className="input" {...form.register('permanentAddress')} />
            </Field>
            <Field id="profile-cccd" label="Số CCCD" hint={maskedCccd ? `Đang lưu ${maskedCccd}. Để trống nếu giữ số hiện tại.` : undefined} error={form.formState.errors.cccdNumber?.message}>
              <input id="profile-cccd" className="input" inputMode="numeric" maxLength={12} autoComplete="off" {...form.register('cccdNumber')} />
            </Field>
            <Field id="profile-cccd-date" label="Ngày cấp CCCD" error={form.formState.errors.cccdIssueDate?.message}>
              <input id="profile-cccd-date" className="input" type="date" max={today()} {...form.register('cccdIssueDate')} />
            </Field>
            <Field id="profile-cccd-place" label="Nơi cấp CCCD" error={form.formState.errors.cccdIssuePlace?.message}>
              <input id="profile-cccd-place" className="input" {...form.register('cccdIssuePlace')} />
            </Field>
          </fieldset>
          <InlineError error={update.error} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}><Save /> Lưu thay đổi</Button>
            <Button type="button" variant="outline" disabled={update.isPending} onClick={() => {
              form.reset()
              setEditing(false)
            }}>Hủy</Button>
          </div>
        </form>
      ) : (
        <>
          {facts(personal)}
          <section className="space-y-4 border-t border-border pt-5">
            <h3 className="font-bold">Thông tin định danh</h3>
            {facts(identity)}
          </section>
        </>
      )}
      {saved && <Notice tone="success">Đã cập nhật hồ sơ.</Notice>}
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
          <div className="grid gap-6">
            <div>
              {profile.data ? (
                <ProfileInfoForm key={profile.data.id} user={profile.data} />
              ) : profile.error ? (
                <Panel><InlineError error={profile.error} /><Button variant="outline" onClick={() => void profile.refetch()}>Thử lại</Button></Panel>
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

            <div>
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
