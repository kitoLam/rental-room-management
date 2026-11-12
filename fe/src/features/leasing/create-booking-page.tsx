import { Notice, Page, QueryState } from '@/components/common/page'
import { uuid } from '@/lib/validation'
import { catalogService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { BookingForm } from './create-shared'
export function CreateBookingPage() {
  const { roomId = '' } = useParams()
  const room = useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => catalogService.room(roomId),
    enabled: uuid(roomId),
  })
  if (!uuid(roomId))
    return (
      <Page title="Liên kết phòng không hợp lệ" back="/rooms">
        <Notice>Chọn lại phòng trước khi giữ chỗ.</Notice>
      </Page>
    )
  return (
    <Page
      title="Giữ chỗ cho kế hoạch mới."
      eyebrow="YÊU CẦU GIỮ CHỖ"
      back={`/rooms/${roomId}`}
      description="Kiểm tra ngày thuê và chính sách chi nhánh. Bạn không cần có lịch xem phòng trước đó."
    >
      <QueryState
        pending={room.isPending}
        error={room.error}
        retry={room.refetch}
      >
        {room.data && <BookingForm room={room.data} />}
      </QueryState>
    </Page>
  )
}
