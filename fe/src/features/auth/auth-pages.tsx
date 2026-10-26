import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Eye, EyeOff, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, InlineError, Notice, QueryState } from '@/components/common/page'
import {
  emailField,
  loginSchema,
  registerSchema,
  resetSchema,
  safeRedirect,
} from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { provider } from '@/services/config'
import { queryClient } from '@/services/query-client'
import { useSession } from './session-store'

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="mb-8">
      <p className="mb-3 text-xs font-bold tracking-[0.15em] text-primary">CHÀO MỪNG ĐẾN TROPRO</p>
      <h1 className="text-page-title font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </header>
  )
}
function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} className="input pr-12" type={visible ? 'text' : 'password'} />
      <button
        type="button"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        className="absolute top-0 right-0 flex size-11 items-center justify-center text-muted-foreground"
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
function DemoMailbox({ email, feature }: { email: string; feature: 'auth' | 'recovery' }) {
  const [params] = useSearchParams()
  const mailbox = useQuery({
    queryKey: ['demo-mailbox', feature, email],
    queryFn: () => authService.mailbox(email, feature),
    enabled: provider(feature) === 'mock' && !!email,
    retry: false,
  })
  if (provider(feature) !== 'mock' || !email) return null
  return (
    <div className="mt-6 rounded-lg border border-dashed border-border p-4">
      <p className="text-xs font-bold text-primary">HỘP THƯ DEMO</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Bản mô phỏng không gửi email thật. Mở liên kết bên dưới để tiếp tục thử luồng.
      </p>
      {mailbox.isPending ? (
        <p className="mt-3 text-sm">Đang tải thư…</p>
      ) : mailbox.error ? (
        <InlineError error={mailbox.error} />
      ) : mailbox.data ? (
        <Link
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary underline"
          to={`${mailbox.data.href}&redirect=${encodeURIComponent(safeRedirect(params.get('redirect')))}`}
        >
          Mở thư {mailbox.data.purpose === 'verify' ? 'xác minh email' : 'đặt lại mật khẩu'}
          <ArrowRight size={16} />
        </Link>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Chưa có liên kết còn hiệu lực.</p>
      )}
    </div>
  )
}
export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const user = useSession((s) => s.user)
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: (session) => {
      queryClient.clear()
      useSession.getState().setSession(session)
      navigate(redirect, { replace: true })
    },
  })
  if (user) return <Navigate to={redirect} replace />
  return (
    <>
      <Heading title="Chào bạn trở lại.">
        Tiếp tục tìm phòng, theo dõi lịch hẹn và yêu cầu giữ chỗ.
      </Heading>
      {params.get('reset') === 'success' && (
        <div className="mb-5">
          <Notice tone="success">Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.</Notice>
        </div>
      )}
      <form
        className="grid gap-5"
        onSubmit={form.handleSubmit((value) => login.mutate(value))}
        noValidate
      >
        <Field label="Email" id="login-email" error={form.formState.errors.email?.message}>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            aria-invalid={!!form.formState.errors.email}
            {...form.register('email')}
          />
        </Field>
        <Field label="Mật khẩu" id="login-password" error={form.formState.errors.password?.message}>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register('password')}
          />
        </Field>
        <Link to="/forgot-password" className="justify-self-end text-sm text-primary underline">
          Quên mật khẩu?
        </Link>
        <InlineError error={login.error} />
        <Button type="submit" loading={login.isPending} className="w-full">
          Đăng nhập
          <ArrowRight />
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{' '}
        <Link
          className="font-bold text-primary underline"
          to={`/register?redirect=${encodeURIComponent(redirect)}`}
        >
          Đăng ký
        </Link>
      </p>
      {provider('auth') === 'mock' && (
        <div className="mt-8 rounded-lg bg-background p-4 text-xs leading-6 text-muted-foreground">
          <p className="font-bold text-foreground">Tài khoản trải nghiệm</p>
          <p>an@tropro.demo · TroPro@123</p>
          <button
            className="mt-2 min-h-11 font-bold text-primary underline"
            type="button"
            onClick={() => {
              form.setValue('email', 'an@tropro.demo')
              form.setValue('password', 'TroPro@123')
            }}
          >
            Điền tài khoản demo
          </button>
          <button
            className="ml-4 min-h-11 font-bold text-primary underline"
            type="button"
            onClick={() => {
              form.setValue('email', 'tenant@tropro.demo')
              form.setValue('password', 'TroPro@123')
            }}
          >
            Điền tài khoản Tenant demo
          </button>
          <button className="ml-4 min-h-11 font-bold text-primary underline" type="button" onClick={()=>{form.setValue('email','manager@tropro.demo');form.setValue('password','TroPro@123')}}>Điền tài khoản Manager demo</button>
          <button className="ml-4 min-h-11 font-bold text-primary underline" type="button" onClick={()=>{form.setValue('email','owner@tropro.demo');form.setValue('password','TroPro@123')}}>Điền tài khoản Owner demo</button>
          <button className="ml-4 min-h-11 font-bold text-primary underline" type="button" onClick={()=>{form.setValue('email','admin@tropro.demo');form.setValue('password','TroPro@123')}}>Điền tài khoản Admin demo</button>
        </div>
      )}
    </>
  )
}
export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })
  const register = useMutation({
    mutationFn: authService.register,
    onSuccess: (_, input) =>
      navigate(`/verify-email?${new URLSearchParams({ email: input.email, redirect })}`, {
        replace: true,
      }),
  })
  return (
    <>
      <Heading title="Bắt đầu hành trình tìm phòng.">
        Một tài khoản để đặt lịch xem, giữ chỗ và theo dõi mọi cập nhật.
      </Heading>
      <form
        className="grid gap-5"
        noValidate
        onSubmit={form.handleSubmit(({ fullName, email, password }) =>
          register.mutate({ fullName, email, password }),
        )}
      >
        <Field label="Họ và tên" id="register-name" error={form.formState.errors.fullName?.message}>
          <input
            id="register-name"
            className="input"
            autoComplete="name"
            {...form.register('fullName')}
            aria-invalid={!!form.formState.errors.fullName}
          />
        </Field>
        <Field label="Email" id="register-email" error={form.formState.errors.email?.message}>
          <input
            id="register-email"
            className="input"
            type="email"
            autoComplete="email"
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
          />
        </Field>
        <Field
          label="Mật khẩu"
          id="register-password"
          error={form.formState.errors.password?.message}
          hint="Ít nhất 8 ký tự, tối đa 72 byte."
        >
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            {...form.register('password')}
            aria-invalid={!!form.formState.errors.password}
          />
        </Field>
        <Field
          label="Nhập lại mật khẩu"
          id="register-confirm"
          error={form.formState.errors.confirmPassword?.message}
        >
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            {...form.register('confirmPassword')}
            aria-invalid={!!form.formState.errors.confirmPassword}
          />
        </Field>
        <InlineError error={register.error} />
        <Button type="submit" loading={register.isPending}>
          Tạo tài khoản
          <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link
          to={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="font-bold text-primary underline"
        >
          Đăng nhập
        </Link>
      </p>
      <Link
        to="/owner-onboarding"
        className="mt-6 block text-center text-xs text-muted-foreground underline"
      >
        Bạn là chủ trọ? Tìm hiểu cách tham gia TroPro
      </Link>
    </>
  )
}
export function VerifyEmailPage() {
  const [params, setParams] = useSearchParams()
  const [finishedToken, setFinishedToken] = useState('')
  const token = params.get('token') || finishedToken
  const email = params.get('email') || ''
  const redirect = safeRedirect(params.get('redirect'))
  const verify = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      try {
        return await authService.verify(token)
      } finally {
        setFinishedToken(token)
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  useEffect(() => {
    if (token && params.has('token') && (verify.isSuccess || verify.isError)) {
      const next = new URLSearchParams(params)
      next.delete('token')
      setParams(next, { replace: true })
    }
  }, [token, params, setParams, verify.isSuccess, verify.isError])
  return (
    <>
      <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {verify.isSuccess ? <MailCheck size={26} /> : <Mail size={26} />}
      </div>
      <Heading
        title={
          token
            ? verify.isSuccess
              ? 'Email đã được xác minh.'
              : 'Xác minh email của bạn.'
            : 'Kiểm tra hộp thư nhé.'
        }
      >
        {token
          ? 'TroPro sẽ kiểm tra liên kết và cập nhật trạng thái tài khoản.'
          : `Mở liên kết xác minh trong email${email ? ` gửi đến ${email}` : ' đăng ký'} để hoàn tất tài khoản.`}
      </Heading>
      {token && (
        <QueryState pending={verify.isPending} error={verify.error} retry={verify.refetch}>
          {verify.isSuccess && (
            <Notice tone="success">Tài khoản đã sẵn sàng. Bạn có thể đăng nhập.</Notice>
          )}
        </QueryState>
      )}
      <Button asChild className="mt-6 w-full">
        <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>Về đăng nhập</Link>
      </Button>
      {!token && <DemoMailbox email={email} feature="auth" />}
    </>
  )
}
export function ForgotPasswordPage() {
  const form = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: emailField })),
    defaultValues: { email: '' },
  })
  const [email, setEmail] = useState('')
  const forgot = useMutation({
    mutationFn: authService.forgot,
    onSuccess: (_, value) => setEmail(value),
  })
  return (
    <>
      <Heading title="Lấy lại quyền truy cập.">
        Nhập email đã đăng ký. Nếu tài khoản tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu.
      </Heading>
      {forgot.isSuccess ? (
        <>
          <Notice tone="success">Yêu cầu đã được tiếp nhận. Kiểm tra hộp thư và thư rác.</Notice>
          <DemoMailbox email={email} feature="recovery" />
        </>
      ) : (
        <form
          className="grid gap-5"
          noValidate
          onSubmit={form.handleSubmit((v) => forgot.mutate(v.email))}
        >
          <Field
            label="Email đăng ký"
            id="forgot-email"
            error={form.formState.errors.email?.message}
          >
            <input
              id="forgot-email"
              className="input"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              aria-invalid={!!form.formState.errors.email}
            />
          </Field>
          <InlineError error={forgot.error} />
          <Button type="submit" loading={forgot.isPending}>
            Gửi liên kết khôi phục
            <ArrowRight />
          </Button>
        </form>
      )}
      <Link
        to="/login"
        className="mt-6 block min-h-11 py-3 text-center text-sm text-primary underline"
      >
        Quay lại đăng nhập
      </Link>
    </>
  )
}
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const reset = useMutation({
    mutationFn: (password: string) => authService.reset(token, password),
    onSuccess: () => {
      useSession.getState().clear()
      queryClient.clear()
      navigate('/login?reset=success', { replace: true })
    },
  })
  return (
    <>
      <Heading title="Chọn mật khẩu mới.">
        Dùng mật khẩu riêng cho TroPro để bảo vệ tài khoản của bạn.
      </Heading>
      {!token ? (
        <Notice tone="warning">
          Liên kết thiếu token.{' '}
          <Link to="/forgot-password" className="underline">
            Yêu cầu liên kết mới
          </Link>
          .
        </Notice>
      ) : (
        <form
          className="grid gap-5"
          noValidate
          onSubmit={form.handleSubmit((v) => reset.mutate(v.password))}
        >
          <Field
            label="Mật khẩu mới"
            id="reset-password"
            error={form.formState.errors.password?.message}
          >
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              {...form.register('password')}
            />
          </Field>
          <Field
            label="Nhập lại mật khẩu"
            id="reset-confirm"
            error={form.formState.errors.confirmPassword?.message}
          >
            <PasswordInput
              id="reset-confirm"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
          </Field>
          <InlineError error={reset.error} />
          <Button type="submit" loading={reset.isPending}>
            <ShieldCheck />
            Đổi mật khẩu
          </Button>
        </form>
      )}
      <Link
        to="/login"
        className="mt-6 block min-h-11 py-3 text-center text-sm text-primary underline"
      >
        Về đăng nhập
      </Link>
    </>
  )
}
