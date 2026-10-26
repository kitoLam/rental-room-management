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
    TENANT_BRANCH: '/tenant/my-room',
  }
  if (id && type && routes[type] && tenancyId)
    return `${routes[type]}?tenancyId=${encodeURIComponent(tenancyId)}${type === 'TENANT_PAYMENT' ? `&paymentId=${encodeURIComponent(id)}` : ''}`
  return id && type === 'APPOINTMENT'
    ? `/user/appointments/${id}`
    : id && type === 'BOOKING'
      ? `/user/bookings/${id}`
      : null
}
