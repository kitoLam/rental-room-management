import { Page } from '@/components/common/page'
import { ContractsTab } from './profile-tabs'

export default function MyContractsPage() {
  return (
    <Page wide eyebrow="TÀI KHOẢN CÁ NHÂN" title="Hợp đồng" description="Ký và nộp bản ký cho từng hợp đồng; quản lý duyệt xong bạn vào được không gian thuê.">
      <ContractsTab />
    </Page>
  )
}
