import { Field, InlineError, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { resetSchema } from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { queryClient } from '@/services/query-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Heading, PasswordInput } from './auth-shared'
import { useSession } from './session-store'
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const isSetup = params.get('mode') === 'setup'
  const navigate = useNavigate()
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const reset = useMutation({
    mutationFn: (values: { password: string; confirmPassword: string }) =>
      isSetup
        ? authService.setupPassword({
            token,
            password: values.password,
            confirmPassword: values.confirmPassword,
          })
        : authService.reset(token, values.password),
    onSuccess: () => {
      useSession.getState().clear()
      queryClient.clear()
      navigate('/login?reset=success', { replace: true })
    },
  })
  return (
    <>
      <Heading title={isSetup ? 'Thiết lập mật khẩu tài khoản.' : 'Chọn mật khẩu mới.'}>
        {isSetup
          ? 'Email đã được xác thực. Hãy đặt mật khẩu riêng (Quản lý/Chủ cơ sở không biết mật khẩu này).'
          : 'Dùng mật khẩu riêng cho TroPro để bảo vệ tài khoản của bạn.'}
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
          onSubmit={form.handleSubmit((v) => reset.mutate(v))}
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
            {isSetup ? 'Lưu mật khẩu & Kích hoạt' : 'Đổi mật khẩu'}
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
