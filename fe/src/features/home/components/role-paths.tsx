import { Link } from 'react-router'
import { Bell, DoorOpen, Receipt, Wrench, Zap, type LucideIcon } from 'lucide-react'

import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Feature = { icon: LucideIcon; text: string }

const ownerFeatures: Feature[] = [
  { icon: DoorOpen, text: 'Phòng, chỗ ở và người thuê' },
  { icon: Zap, text: 'Chốt điện nước mỗi tháng' },
  { icon: Wrench, text: 'Nhận và giao việc sửa chữa' },
]

const tenantFeatures: Feature[] = [
  { icon: Receipt, text: 'Xem tiền phòng, điện nước' },
  { icon: Wrench, text: 'Báo hỏng và theo dõi tiến độ' },
  { icon: Bell, text: 'Nhận thông báo từ chủ trọ' },
]

function FeatureList({ items, inverted }: { items: Feature[]; inverted?: boolean }) {
  return (
    <ul className="mt-6 grid gap-3">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-sm">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              inverted ? 'bg-white/15 text-white' : 'bg-surface text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {text}
        </li>
      ))}
    </ul>
  )
}

export function RolePaths() {
  return (
    <section aria-labelledby="roles-title" className="py-16 sm:py-20">
      <Container>
        <h2 id="roles-title" className="text-xl font-bold">
          Đã thuê hoặc đang cho thuê?
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-6">
          <article className="flex flex-col rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
            <h3 className="text-xl font-bold">Chủ trọ</h3>
            <p className="mt-1 text-sm text-white">Quản lý cả dãy trọ ở một nơi.</p>
            <FeatureList items={ownerFeatures} inverted />
            <Button asChild variant="inverse" className="mt-8 self-start">
              <Link to="/owner-onboarding">Tìm hiểu dành cho chủ trọ</Link>
            </Button>
          </article>

          <article className="flex flex-col rounded-2xl bg-primary-soft p-6 sm:p-8">
            <h3 className="text-xl font-bold">Người thuê</h3>
            <p className="mt-1 text-sm text-foreground">Mọi thứ về phòng của bạn.</p>
            <FeatureList items={tenantFeatures} />
            <Button asChild className="mt-8 self-start">
              <Link to="/user/dashboard">Vào không gian cá nhân</Link>
            </Button>
          </article>
        </div>
      </Container>
    </section>
  )
}
