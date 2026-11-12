import { Page } from '@/components/common/page'
import { PaymentsTab } from './profile-tabs'

export default function MyPaymentsPage() {
  return (
    <Page wide eyebrow="TÀI KHOẢN CÁ NHÂN" title="Thanh toán" description="Các khoản cần thanh toán và lịch sử giao dịch của bạn.">
      <PaymentsTab />
    </Page>
  )
}
