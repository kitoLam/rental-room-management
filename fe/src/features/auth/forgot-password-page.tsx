import { Field, InlineError, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { emailField } from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { DemoMailbox, Heading } from './auth-shared'
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
