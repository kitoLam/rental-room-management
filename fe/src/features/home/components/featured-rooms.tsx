import { Link } from 'react-router'
import { SearchX } from 'lucide-react'

import { Container } from '@/components/common/container'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { RoomCard, RoomCardSkeleton } from '@/features/rooms/components/room-card'
import { useFeaturedRooms } from '@/features/rooms/hooks/use-featured-rooms'
import { routes } from '@/lib/routes'
import { provider } from '@/services/config'

export function FeaturedRooms() {
  const { status, rooms, retry } = useFeaturedRooms()

  return (
    <section aria-labelledby="featured-title" className="py-16 sm:py-20">
      <Container>
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 id="featured-title" className="text-xl font-bold">
            {provider('catalog') === 'real' ? 'Khám phá các phòng' : 'Phòng đang cho thuê'}
          </h2>
          <Button asChild variant="link" className="px-0">
            <Link to={routes.rooms}>Xem tất cả</Link>
          </Button>
        </div>

        <div aria-live="polite" aria-busy={status === 'loading'}>
          {status === 'loading' && (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <RoomCardSkeleton key={i} />
              ))}
              <span className="sr-only">Đang tải danh sách phòng</span>
            </div>
          )}

          {status === 'error' && (
            <ErrorState
              message="Không tải được danh sách phòng. Kiểm tra kết nối mạng rồi thử lại."
              onRetry={retry}
            />
          )}

          {status === 'success' && rooms.length === 0 && (
            <EmptyState
              icon={SearchX}
              title="Chưa có phòng phù hợp. Thử tìm theo khu vực khác."
              action={
                <Button asChild variant="outline">
                  <Link to={routes.rooms}>Xem tất cả phòng</Link>
                </Button>
              }
            />
          )}

          {status === 'success' && rooms.length > 0 && (
            <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <li key={room.id}>
                  <RoomCard room={room} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  )
}
