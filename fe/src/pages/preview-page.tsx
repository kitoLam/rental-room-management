import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/common/page'
import { apiMode } from '@/services/config'
import { authService } from '@/services/guest-user'
import { queryClient } from '@/services/query-client'
import { useSession } from '@/features/auth/session-store'

const workspaces = [
  { role: 'admin', name: 'Quản trị viên', detail: 'Thống kê phòng, chi nhánh, tài khoản và xét duyệt.' },
  { role: 'owner', name: 'Chủ trọ', detail: 'Chi nhánh sở hữu, đăng ký phòng, quản lý và doanh thu.' },
  { role: 'manager', name: 'Quản lý trọ', detail: 'Phòng, hợp đồng, điện nước, hóa đơn và bảo trì.' },
  { role: 'tenant', name: 'Người thuê', detail: 'Chỗ ở, hợp đồng, thanh toán và các dịch vụ.' },
]

export default function PreviewPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  if (apiMode !== 'mock') return <Navigate to="/" replace />
  async function preview(role: string) {
    setPending(role)
    setError(null)
    try {
      await queryClient.cancelQueries()
      const session = await authService.login({ email: `${role}@tropro.demo`, password: 'TroPro@123' })
      queryClient.clear()
      useSession.getState().setSession(session)
      navigate(`/${role}/dashboard`)
    } catch (err) {
      setError(err)
    } finally {
      setPending(null)
    }
  }
  return (
    <Container wide className="py-12">
      <p className="text-sm font-bold text-primary">BẢN DEMO · KHÔNG CẦN BACKEND</p>
      <h1 className="mt-3 text-page-title font-bold">Xem thử giao diện</h1>
      <p className="mt-3 text-muted-foreground">Chọn vai trò để khám phá bằng dữ liệu mẫu, không cần nhập tài khoản. Bạn có thể quay lại đây để đổi vai trò.</p>
      {error != null && <InlineError error={error} />}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {workspaces.map(({ role, name, detail }) => (
          <section key={role} className="flex flex-col rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold">{name}</h2>
            <p className="mt-3 mb-6 flex-1 text-sm text-muted-foreground">{detail}</p>
            <Button disabled={pending !== null} onClick={() => void preview(role)}>
              {pending === role ? 'Đang mở…' : `Xem ${name.toLowerCase()}`}
            </Button>
          </section>
        ))}
      </div>
      <Link to="/rooms" className="mt-8 inline-block font-bold text-primary underline">Khám phá phòng dành cho khách</Link>
    </Container>
  )
}
