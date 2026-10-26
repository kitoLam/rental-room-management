import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react'
import { catalogService, defaultFilters } from '@/services/guest-user'
import { Button } from '@/components/ui/button'
import { Notice, Page, Panel, QueryState } from '@/components/common/page'
import { RoomCard } from './components/room-card'
import { uuid } from '@/lib/validation'
import { heroMedia } from '@/features/home/data/hero-media'
export default function BranchDetailPage() {
  const { branchId = '' } = useParams()
  const branch = useQuery({
    queryKey: ['branch', branchId],
    queryFn: () => catalogService.branch(branchId),
    enabled: uuid(branchId),
  })
  const rooms = useQuery({
    queryKey: ['rooms', 'branch', branchId],
    queryFn: () => catalogService.rooms({ ...defaultFilters, branchId }),
    enabled: uuid(branchId),
  })
  const b = branch.data
  const validLocation =
    b?.latitude !== null &&
    b?.longitude !== null &&
    Math.abs(b?.latitude || 1000) <= 90 &&
    Math.abs(b?.longitude || 1000) <= 180
  if (!uuid(branchId))
    return (
      <Page title="Không tìm thấy chi nhánh" back="/rooms">
        <Notice>Liên kết chi nhánh không hợp lệ.</Notice>
      </Page>
    )
  return (
    <Page
      eyebrow="KHÔNG GIAN & CỘNG ĐỒNG"
      title={b?.name || 'Chi nhánh'}
      description={b?.address}
      back="/rooms"
    >
      <QueryState pending={branch.isPending} error={branch.error} retry={branch.refetch}>
        {b && (
          <>
            <img
              className="mb-9 aspect-[2/1] w-full rounded-2xl object-cover"
              src={b.images[0] || heroMedia.poster}
              onError={(e) => {
                e.currentTarget.src = heroMedia.poster
              }}
              alt={`Không gian tại ${b.name}`}
            />
            <div className="grid items-start gap-8 md:grid-cols-[2fr_1fr]">
              <div>
                <h2 className="mb-4 text-xl font-bold">Một nơi ở, nhiều kết nối</h2>
                <p className="max-w-prose text-sm leading-7 text-muted-foreground">
                  {b.description}
                </p>
                <h2 className="mt-8 mb-4 text-xl font-bold">Nội quy chung</h2>
                <ul className="list-inside list-disc space-y-3 text-sm text-muted-foreground">
                  {b.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
              <Panel>
                <h2 className="mb-4 font-bold">Thông tin liên hệ công khai</h2>
                <p className="flex gap-3 text-sm leading-relaxed">
                  <MapPin size={18} className="shrink-0 text-primary" />
                  {b.address}
                </p>
                <div className="mt-5 grid gap-3">
                  {b.publicPhone && (
                    <a
                      className="flex min-h-11 items-center gap-3 text-sm text-primary"
                      href={`tel:${b.publicPhone}`}
                    >
                      <Phone size={16} />
                      {b.publicPhone}
                    </a>
                  )}
                  {b.publicEmail && (
                    <a
                      className="flex min-h-11 items-center gap-3 text-sm text-primary"
                      href={`mailto:${b.publicEmail}`}
                    >
                      <Mail size={16} />
                      {b.publicEmail}
                    </a>
                  )}
                  {!b.publicPhone && !b.publicEmail && (
                    <p className="text-xs text-muted-foreground">
                      Chi nhánh chưa công bố số điện thoại hoặc email. Bạn có thể đặt lịch từ trang
                      phòng.
                    </p>
                  )}
                  {validLocation && (
                    <Button asChild variant="outline">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem vị trí
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                </div>
              </Panel>
            </div>
            <section className="mt-12">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Phòng tại chi nhánh</h2>
                <Button asChild variant="link">
                  <Link to={`/rooms?branchId=${b.id}`}>Xem tất cả phòng</Link>
                </Button>
              </div>
              <QueryState
                pending={rooms.isPending}
                error={rooms.error}
                retry={rooms.refetch}
                empty={rooms.data?.content.length === 0}
                emptyMessage="Chi nhánh chưa có phòng được công khai. Bạn có thể khám phá các chi nhánh khác."
              >
                <ul className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.data?.content.map((room) => (
                    <li key={room.id}>
                      <RoomCard room={room} />
                    </li>
                  ))}
                </ul>
              </QueryState>
            </section>
          </>
        )}
      </QueryState>
    </Page>
  )
}
