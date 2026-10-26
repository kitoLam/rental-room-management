import type { StatusTone } from '@/components/common/status-badge'

import type { RoomListing } from '../types'

/** Quy đổi trạng thái phòng sang huy hiệu hiển thị cho khách. */
export function getRoomBadge(room: RoomListing): { tone: StatusTone; label: string } {
  if (room.status === 'INACTIVE') return { tone: 'neutral', label: 'Tạm ngừng cho thuê' }
  if (room.status === 'HELD') return { tone: 'warning', label: 'Đang được giữ' }
  if (room.status === 'OCCUPIED') return { tone: 'neutral', label: 'Đã cho thuê' }
  if (room.status === 'MAINTENANCE') return { tone: 'danger', label: 'Đang sửa chữa' }
  if (room.status === 'UNKNOWN' || room.availableSlots === null)
    return { tone: 'neutral', label: 'Cần kiểm tra lịch trống' }
  if (room.availableSlots === 0) return { tone: 'neutral', label: 'Hết chỗ' }
  if (room.rentalMode === 'SLOT' && room.availableSlots === 1) {
    return { tone: 'warning', label: `Còn ${room.availableSlots} chỗ` }
  }
  if (room.rentalMode === 'SLOT')
    return { tone: 'success', label: `Còn ${room.availableSlots} chỗ` }
  return { tone: 'success', label: 'Còn trống' }
}

export function getPriceUnit(room: RoomListing): string {
  return room.rentalMode === 'SLOT' ? '/chỗ/tháng' : '/tháng'
}
