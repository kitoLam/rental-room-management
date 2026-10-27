import { Field, InlineError, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { loginSchema, safeRedirect } from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { queryClient } from '@/services/query-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Heading, PasswordInput } from './auth-shared'
import { useSession } from './session-store'
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
    </>
  )
}
