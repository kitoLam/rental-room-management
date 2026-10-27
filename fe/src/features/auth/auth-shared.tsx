import { InlineError } from '@/components/common/page'
import { safeRedirect } from '@/lib/validation'
import { provider } from '@/services/config'
import { authService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

export function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="mb-8 sm:mb-10">
      <p className="mb-3 text-sm sm:text-base font-bold tracking-[0.18em] text-primary uppercase">
        CHÀO MỪNG ĐẾN TROPRO
      </p>
      <h1 className="text-3xl sm:text-4xl lg:text-page-title font-extrabold tracking-tight text-balance text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-base sm:text-lg leading-relaxed text-muted-foreground">
        {children}
      </p>
    </header>
  )
}
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} className="input min-h-12 text-base px-4 py-3 pr-12" type={visible ? 'text' : 'password'} />
      <button
        type="button"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        className="absolute top-0 right-0 flex size-12 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}
export function DemoMailbox({ email, feature }: { email: string; feature: 'auth' | 'recovery' }) {
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
