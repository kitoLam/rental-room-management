import type { TenantService } from '@/interfaces/tenant'

const labels: Record<string, string> = {
  AVAILABLE: 'Chưa đăng ký',
  STOP_PENDING: 'Chờ ngừng',
  ACTIVE: 'Đang hiệu lực',
  LEFT: 'Đã rời đi',
  DRAFT: 'Bản nháp',
  ENDED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
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
  OPEN: 'Mới gửi',
  ACCEPTED: 'Đã tiếp nhận',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Đã hoàn tất',
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
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
