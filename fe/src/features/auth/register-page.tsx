import { Field, InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { registerSchema, safeRedirect } from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Heading, PasswordInput } from './auth-shared'
export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
    },
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
        className="grid gap-6"
        noValidate
        onSubmit={form.handleSubmit((input) => register.mutate(input))}
      >
        <Field label="Họ và tên" id="register-name" error={form.formState.errors.fullName?.message}>
          <input
            id="register-name"
            className="input min-h-12 text-base px-4 py-3"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            {...form.register('fullName')}
            aria-invalid={!!form.formState.errors.fullName}
          />
        </Field>
        <Field label="Email" id="register-email" error={form.formState.errors.email?.message}>
          <input
            id="register-email"
            className="input min-h-12 text-base px-4 py-3"
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
          />
        </Field>
        <Field
          label="Số điện thoại"
          id="register-phone"
          error={form.formState.errors.phone?.message}
        >
          <input
            id="register-phone"
            className="input min-h-12 text-base px-4 py-3"
            type="tel"
            autoComplete="tel"
            placeholder="0912345678"
            {...form.register('phone')}
            aria-invalid={!!form.formState.errors.phone}
          />
        </Field>
        <Field
          label="Mật khẩu"
          id="register-password"
          error={form.formState.errors.password?.message}
          hint="Ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; tối đa 72 byte."
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
        <div>
          <label className="flex min-h-11 items-center gap-3 text-base cursor-pointer" htmlFor="register-terms">
            <input
              id="register-terms"
              type="checkbox"
              className="size-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
              {...form.register('termsAccepted')}
              aria-invalid={!!form.formState.errors.termsAccepted}
              aria-describedby={
                form.formState.errors.termsAccepted ? 'register-terms-error' : undefined
              }
            />
            Tôi đồng ý với điều khoản sử dụng.
          </label>
          {form.formState.errors.termsAccepted && (
            <p id="register-terms-error" role="alert" className="text-sm text-danger mt-1">
              {form.formState.errors.termsAccepted.message}
            </p>
          )}
        </div>
        <InlineError error={register.error} />
        <Button type="submit" size="lg" loading={register.isPending} className="w-full min-h-12 text-base font-bold">
          Tạo tài khoản
          <ArrowRight size={18} />
        </Button>
      </form>
      <p className="mt-8 text-center text-base text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link
          to={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="font-bold text-primary underline"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  )
}
