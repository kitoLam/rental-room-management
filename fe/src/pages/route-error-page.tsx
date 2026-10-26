import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Page, Notice } from '@/components/common/page'
export function RouteErrorPage() {
  return (
    <Page title="Trang này chưa tải được." narrow>
      <Notice tone="warning">
        Có thể kết nối đã bị gián đoạn. Tải lại trang hoặc trở về trang chủ để tiếp tục.
      </Notice>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
        <Button asChild variant="outline">
          <Link to="/">Về trang chủ</Link>
        </Button>
      </div>
    </Page>
  )
}
