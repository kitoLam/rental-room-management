import { useState } from 'react'
import { Link } from 'react-router'
import { ImageOff, MapPin, Ruler, Users } from 'lucide-react'

import { StatusBadge } from '@/components/common/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVnd } from '@/lib/format'
import { routes } from '@/lib/routes'

import { getPriceUnit, getRoomBadge } from '../lib/room-display'
import type { RoomListing } from '../types'

type RoomCardProps = { room: RoomListing }

export function RoomCard({ room }: RoomCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const badge = getRoomBadge(room)

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-primary-soft">
        {imageFailed ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-6" aria-hidden="true" />
            <span className="text-xs">Chưa tải được ảnh</span>
          </div>
        ) : (
          <img
            src={room.imageUrl}
            alt={room.imageAlt}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        )}
        <StatusBadge tone={badge.tone} className="absolute top-3 left-3 bg-surface shadow-sm">
          {badge.label}
        </StatusBadge>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-1 text-base font-bold">
          {/* Cả thẻ bấm được nhờ ::after phủ lên article, nhưng chỉ có một link cho trình đọc màn hình */}
          <Link
            to={routes.roomDetail(room.id)}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl group-hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-4 focus-visible:after:ring-offset-background"
          >
            {room.title}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{room.address}</span>
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1">
            <Ruler className="size-3.5" aria-hidden="true" />
            {room.sizeM2 === null ? 'Chưa có diện tích' : `${room.sizeM2} m²`}
          </li>
          <li className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            {room.capacity} người
          </li>
          <li>{room.rentalMode === 'SLOT' ? 'Ở ghép' : 'Nguyên phòng'}</li>
        </ul>
        <p className="mt-1 text-base">
          <span className="font-bold">{formatVnd(room.price)}</span>
          <span className="text-sm text-muted-foreground">{getPriceUnit(room)}</span>
        </p>
      </div>
    </article>
  )
}

export function RoomCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[4/3] rounded-xl" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-5 w-2/5" />
    </div>
  )
}
