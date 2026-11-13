export const statusLabel: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã hoàn tất',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
  REQUESTED: 'Đã yêu cầu',
  AWAITING_PAYMENT: 'Chờ thanh toán',
  CONVERTED: 'Đã chuyển hợp đồng',
  EXPIRED: 'Đã hết hạn',
  VERIFIED: 'Đã xác minh',
  FAILED: 'Không thành công',
  REVIEW: 'Cần đối soát',
}
export const dateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
export const dateOnly = (value: string) =>
  new Date(`${value}T00:00:00+07:00`).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
export const vnDateKey = (value?: string | null) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
/** Cộng tháng theo đúng quy tắc LocalDate.plusMonths của Java: giữ ngày, kẹp về cuối tháng nếu tháng đích ngắn hơn. */
export const addMonths = (date: string, months: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const firstOfTarget = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate()
  firstOfTarget.setUTCDate(Math.min(day, lastDay))
  return firstOfTarget.toISOString().slice(0, 10)
}
/** Ngày hiệu lực thật của booking. Backend duyệt evidence dùng expectedMoveInDate, booking cũ chưa có thì lùi 1 ngày sau
 * lúc nộp evidence; mock không mang expectedMoveInDate nên rơi về startDate đã gán sẵn. */
export const bookingMoveInDate = (booking?: { expectedMoveInDate?: string | null; startDate?: string }) =>
  booking
    ? booking.expectedMoveInDate === undefined
      ? booking.startDate
      : booking.expectedMoveInDate ?? undefined
    : undefined
/** Ngày kế tiếp (giờ Việt Nam) của một mốc instant; backend dùng quy tắc này khi booking cũ thiếu ngày dọn vào. */
export const dayAfterVietnamDate = (instant: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  const next = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}
export const firstBillingStartDate = (evidenceSubmittedAt: string, _now?: Date, moveInDate?: string | null) => {
  const startDate = moveInDate || dayAfterVietnamDate(evidenceSubmittedAt)
  return addMonths(`${startDate.slice(0, 7)}-01`, 1)
}
export function referenceLink(type: string | null, id: string | null, tenancyId?: string, branchId?:string) {
  if(type==='ADMIN_VERIFICATION'&&id)return `/admin/owner-verifications/${encodeURIComponent(id)}`
  if(type==='ADMIN_USER'&&id)return `/admin/users/${encodeURIComponent(id)}`
  if(type==='ACCOUNT_STATUS')return '/profile'
  if(type==='OWNER_VERIFICATION')return '/owner/verification'
  if(type==='MANAGER_INVITATION')return '/manager-invitations'
  if(type==='OWNER_MANAGER' && id)return `/owner/managers/${encodeURIComponent(id)}`
  if(type==='OWNER_APPROVAL' && branchId)return `/owner/approvals/invoices?branchId=${encodeURIComponent(branchId)}`
  if(type==='OWNER_BRANCH' && branchId)return `/owner/branches/${encodeURIComponent(branchId)}`
  if(type==='MANAGER_ASSIGNMENT' && branchId)return `/manager/dashboard?branchId=${encodeURIComponent(branchId)}`
  if(type==='MANAGER_INVOICE' && branchId && id)return `/manager/invoices/${encodeURIComponent(id)}?branchId=${encodeURIComponent(branchId)}`
  const managerRoutes:Record<string,string>={MANAGER_APPOINTMENT:`/manager/appointments/${id}`,MANAGER_BOOKING:`/manager/bookings/${id}`,MANAGER_SERVICE:'/manager/service-requests',MANAGER_ALLOCATION:'/manager/cost-allocations',MANAGER_MAINTENANCE:`/manager/maintenance/${id}`,MANAGER_PAYMENT:`/manager/payments/${id}`}
  if(type&&id&&branchId&&managerRoutes[type])return `${managerRoutes[type]}?branchId=${encodeURIComponent(branchId)}`
  const routes: Record<string, string> = {
    TENANT_CONTRACT: `/tenant/contracts/${id}`,
    TENANT_INVOICE: `/tenant/invoices/${id}`,
    TENANT_PAYMENT: '/tenant/payments',
    TENANT_SERVICE: '/tenant/services',
    TENANT_ALLOCATION: '/tenant/utilities/allocations',
    TENANT_UTILITY:'/tenant/utilities',
    TENANT_MAINTENANCE: `/tenant/maintenance/${id}`,
    TENANT_BRANCH: '/tenant/dashboard',
  }
  if (id && type && routes[type] && tenancyId)
    return `${routes[type]}?tenancyId=${encodeURIComponent(tenancyId)}${type === 'TENANT_PAYMENT' ? `&paymentId=${encodeURIComponent(id)}` : ''}`
  return id && type === 'APPOINTMENT'
    ? `/tenant/appointments/${id}`
    : id && type === 'BOOKING'
      ? `/tenant/bookings/${id}`
      : null
}
