import type { TenantService } from '@/interfaces/tenant'

const labels: Record<string, string> = {
  AVAILABLE: 'Chưa đăng ký',
  STOP_PENDING: 'Chờ ngừng',
  ACTIVE: 'Đang hiệu lực',
  LEFT: 'Đã rời đi',
  DRAFT: 'Bản nháp',
  ENDED: 'Đã kết thúc',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
  TERMINATED: 'Đã chấm dứt',
  ISSUED: 'Đã phát hành',
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Đã trả một phần',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
  PENDING: 'Chờ xử lý',
  VERIFIED: 'Đã xác minh',
  REVIEW: 'Cần đối soát',
  FAILED: 'Không thành công',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  CANCEL_REQUESTED: 'Chờ duyệt hủy',
  SUPERSEDED: 'Đã thay thế',
  OPEN: 'Chờ xử lý',
  ACCEPTED: 'Đang xử lý',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Đã hoàn tất',
  WAITING_INFO: 'Chờ bổ sung',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  CREATED: 'Tạo yêu cầu',
  ASSIGNED: 'Gán phụ trách',
  STATUS_CHANGED: 'Chuyển trạng thái',
  COMMENTED: 'Ghi chú',
  REQUESTED_INFO: 'Yêu cầu bổ sung',
  INFO_SUPPLEMENTED: 'Đã bổ sung thông tin',
  PROGRESS_UPDATED: 'Cập nhật tiến độ',
  REOPENED: 'Mở lại yêu cầu',
  REPAIR: 'Sửa chữa',
  MAINTENANCE: 'Bảo trì',
  COMPLAINT: 'Khiếu nại',
  FURNITURE: 'Nội thất',
  SERVICE: 'Dịch vụ',
  CONTRACT: 'Gia hạn / Hợp đồng',
  OTHER: 'Khác',
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  NORMAL: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
}
export const tenantStatusLabel = (s: string) => labels[s] || s

/** Thao tác dịch vụ được phép: API thật trả allowedActions; dữ liệu mock suy ra từ trạng thái cũ. */
export function serviceActions(s: TenantService): string[] {
  if (s.allowedActions) return s.allowedActions
  if (s.mandatory) return []
  if (!s.subscriptionId || ['REJECTED', 'CANCELLED'].includes(s.status || '')) return ['REGISTER']
  return s.status === 'APPROVED' ? ['STOP'] : []
}
