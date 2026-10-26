import { Link } from 'react-router'
import { ArrowRight, Building2 } from 'lucide-react'
import { Page, Panel, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
export default function OwnerOnboardingPage() {
  const user = useSession(s=>s.user)
  return (
    <Page title="Cùng xây dựng một nơi ở tốt hơn." eyebrow="DÀNH CHO CHỦ TRỌ" back="/" narrow>
      <Panel>
        <Building2 className="mb-5 size-10 text-primary" />
        <h2 className="text-xl font-bold">Một tài khoản, một bước khởi đầu</h2>
        <p className="my-5 text-sm leading-7 text-muted-foreground">
          Bạn có thể tạo tài khoản người dùng để khám phá TroPro. Quyền chủ trọ cần được xét duyệt
          và cấp bởi hệ thống sau bước xác minh; đăng ký thông thường chưa tạo quyền quản lý tài
          sản.
        </p>
        <Notice>
          Gửi hồ sơ xác minh bằng tài khoản đã xác minh email. Quyền vận hành chỉ được mở khi hồ sơ và phân quyền đều hợp lệ.
        </Notice>
        <div className="mt-6 flex flex-wrap gap-3">
          {user && <Button asChild><Link to="/owner/onboarding">Tiếp tục hồ sơ chủ trọ</Link></Button>}
          <Button asChild>
            <Link to="/register">
              Tạo tài khoản người dùng
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Đã có tài khoản</Link>
          </Button>
        </div>
      </Panel>
    </Page>
  )
}
