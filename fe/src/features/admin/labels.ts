export const statusNames: Record<string, string> = {
  INVITED: 'Đã mời',
  PENDING_VERIFICATION: 'Chờ xác minh liên hệ',
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Đã khóa',
  DISABLED: 'Ngừng kích hoạt',
  NOT_SUBMITTED: 'Chưa nộp hồ sơ',
  PENDING: 'Chờ xét duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  DRAFT: 'Nháp',
  INACTIVE: 'Ngừng hoạt động',
}
export const roleNames: Record<string, string> = {
  USER: 'Người dùng',
  TENANT: 'Người thuê',
  MANAGER: 'Quản lý',
  OWNER: 'Chủ trọ',
  ADMIN: 'Quản trị viên',
}
export const eventNames: Record<string, string> = {
  USER_INVITED: 'Mời tài khoản',
  USER_ACTIVATED: 'Kích hoạt tài khoản',
  USER_DISABLED: 'Ngừng kích hoạt',
  OWNER_APPROVED: 'Duyệt chủ trọ',
  OWNER_REJECTED: 'Từ chối hồ sơ',
  MANAGER_ASSIGNMENT: 'Phân công quản lý',
}
