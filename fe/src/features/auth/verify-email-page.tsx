import { Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { safeRedirect } from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { Mail, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Heading } from './auth-shared'

interface VerifyEmailResult {
  message?: string
  requiresPasswordSetup?: boolean
  setupToken?: string
}

export function VerifyEmailPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [finishedToken, setFinishedToken] = useState('')
  const token = params.get('token') || finishedToken
  const email = params.get('email') || ''
  const redirect = safeRedirect(params.get('redirect'))
  const verify = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      try {
        const res = await authService.verify(token)
        return (res ?? true) as VerifyEmailResult | boolean
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
  const setupToken =
    typeof verify.data === 'object' &&
    verify.data !== null &&
    verify.data.requiresPasswordSetup &&
    verify.data.setupToken
      ? verify.data.setupToken
      : null
  useEffect(() => {
    if (setupToken) {
      navigate(`/reset-password?token=${encodeURIComponent(setupToken)}&mode=setup`, {
        replace: true,
      })
      return
    }
    if (token && params.has('token') && (verify.isSuccess || verify.isError)) {
      const next = new URLSearchParams(params)
      next.delete('token')
      setParams(next, { replace: true })
    }
  }, [token, params, setParams, verify.isSuccess, verify.isError, setupToken, navigate])
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
            <Notice tone="success">
              {setupToken
                ? 'Xác thực email thành công. Vui lòng tiếp tục đặt mật khẩu cho tài khoản của bạn.'
                : 'Tài khoản đã sẵn sàng. Bạn có thể đăng nhập.'}
            </Notice>
          )}
        </QueryState>
      )}
      {setupToken ? (
        <Button asChild className="mt-6 w-full">
          <Link to={`/reset-password?token=${encodeURIComponent(setupToken)}&mode=setup`}>
            Tiếp tục đặt mật khẩu
          </Link>
        </Button>
      ) : (
        <Button asChild className="mt-6 w-full">
          <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>Về đăng nhập</Link>
        </Button>
      )}
    </>
  )
}
