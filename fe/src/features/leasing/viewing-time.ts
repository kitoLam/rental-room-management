export const shiftLabels = { MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều', EVENING: 'Ca tối' }
export const viewingCancellationLabels = {
  TENANT_REQUEST: 'Người xem yêu cầu hủy',
  LANDLORD_UNAVAILABLE: 'Phía cho thuê không thể tiếp khách',
  OFFICIAL_BOOKING: 'Không còn chỗ thuê do quyền giữ chỗ chính thức',
  ROOM_UNAVAILABLE: 'Phòng hoặc chi nhánh không còn đủ điều kiện tiếp khách',
}

export const viewingStatusLabels = {
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn duyệt',
  COMPLETED: 'Đã xem phòng',
  NO_SHOW: 'Không đến xem',
}

export function viewingDateTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(value))
    : 'Chưa xác định giờ hẹn'
}

export function viewingToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
