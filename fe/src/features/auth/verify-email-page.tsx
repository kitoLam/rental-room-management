import { Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { safeRedirect } from '@/lib/validation'
import { authService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { Mail, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DemoMailbox, Heading } from './auth-shared'
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
