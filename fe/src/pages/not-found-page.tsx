import { Link } from 'react-router'
import { MapPinOff } from 'lucide-react'

import { Container } from '@/components/common/container'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { routes } from '@/lib/routes'

export function NotFoundPage() {
  return (
    <Container className="py-16">
      <h1 className="text-xl font-bold">Không tìm thấy trang</h1>
      <EmptyState
        className="mt-8"
        icon={MapPinOff}
        title="Đường dẫn này không tồn tại hoặc đã bị đổi."
        action={
          <Button asChild>
            <Link to={routes.home}>Về trang chủ</Link>
          </Button>
        }
      />
    </Container>
  )
}
