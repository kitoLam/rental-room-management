import type { Feature } from './config'

/** Only contracts verified against the current backend are enabled for real requests.
 * See docs/frontend/real-api-integration-audit.md for pending contracts and decisions.
 */
export function realApiIssue(feature: Feature, path: string, method = 'GET'): string | null {
  const pathname = path.split('?')[0]
  const verb = method.toUpperCase()
  const id = '(?:[0-9a-fA-F-]{36}|[0-9a-fA-F]{24})'
  const matches = (pattern: string) => new RegExp(`^${pattern}$`).test(pathname)
  if (feature === 'manager' && matches(`/api/v1/(rooms|branches)/${id}/utility-rates`) && ['GET', 'PUT'].includes(verb)) return null
  if (feature === 'manager' && pathname === '/api/v1/branches/managed' && verb === 'GET') return null
  if (
    feature === 'viewing' &&
    ((pathname === '/api/v1/appointments/notifications' && verb === 'GET') ||
      (matches('/api/v1/appointments/notifications/([0-9a-f]{64}/read|read-all)') &&
        verb === 'POST'))
  )
    return null
  if (
    feature === 'viewing' &&
    ((pathname === '/api/v1/appointments' && ['GET', 'POST'].includes(verb)) ||
      (matches('/api/v1/appointments/[0-9a-fA-F]{24}(/history)?') && verb === 'GET') ||
      (matches(
        '/api/v1/appointments/[0-9a-fA-F]{24}/(approval|rejection|cancellation|completion|no-show|result-corrections)',
      ) &&
        verb === 'POST'))
  )
    return null
  if (
    feature === 'viewing' &&
    matches('/api/v1/shifts/branches/[0-9a-fA-F]{24}') &&
    ['GET', 'PATCH'].includes(verb)
  )
    return null
  if (
    feature === 'viewing' &&
    ((matches('/api/v1/shifts/rooms/[0-9a-fA-F]{24}') && ['GET', 'PUT'].includes(verb)) ||
      (matches('/api/v1/shifts/rooms/[0-9a-fA-F]{24}/availability') && verb === 'GET'))
  )
    return null
  if (
    feature === 'viewing' &&
    verb === 'GET' &&
    (pathname === '/api/v1/appointments/context' ||
      matches('/api/v1/appointments/rooms/[0-9a-fA-F]{24}/eligibility'))
  )
    return null
  if (
    feature === 'auth' &&
    ((pathname === '/api/v1/auth/signup' && verb === 'POST') ||
      (pathname === '/api/v1/auth/login' && verb === 'POST') ||
      (pathname === '/api/v1/auth/refresh' && verb === 'POST') ||
      (pathname === '/api/v1/auth/logout' && verb === 'POST') ||
      (pathname === '/api/v1/auth/change-password' && verb === 'POST') ||
      (pathname === '/api/v1/auth/me' && ['GET', 'PATCH'].includes(verb)) ||
      (pathname === '/api/v1/auth/resend-verification' && verb === 'POST') ||
      (pathname === '/api/v1/auth/verify-email' && ['GET', 'POST'].includes(verb)))
  )
    return null
  if (
    feature === 'owner' &&
    ((matches('/api/owner/properties') && ['GET', 'POST'].includes(verb)) ||
      (matches(`/api/owner/properties/${id}`) && ['GET', 'PUT'].includes(verb)) ||
      (matches(`/api/owner/properties/${id}/rooms`) && ['GET', 'POST'].includes(verb)))
  )
    return null

  if (feature === 'catalog' && verb === 'GET' && (matches(`/api/v1/public/rooms(/${id})?`) ||
      matches(`/api/v1/public/branches(/${id})?`) ||
      pathname === '/api/v1/public/room-types'))
    return null

  if (
    feature === 'leasing' &&
    ((pathname === '/api/v1/room-slots' && verb === 'GET') ||
      (matches('/api/v1/bookings') && ['GET', 'POST'].includes(verb)) ||
      (matches(`/api/v1/bookings/${id}`) && verb === 'GET') ||
      (matches('/api/v1/bookings/availability(/batch)?') && verb === 'GET') ||
      (matches(`/api/v1/bookings/${id}/(cancel|terms|payments)`) && ['POST', 'GET'].includes(verb)) ||
      (matches(`/api/v1/bookings/${id}/payments/${id}/(reconcile)`) && verb === 'POST') ||
      (matches(`/api/v1/bookings/${id}/refund/approve`) && verb === 'POST'))
  )
    return null
  if (
    feature === 'leasing' &&
    ((matches(`/api/v1/contracts/${id}`) && verb === 'GET') ||
      (matches(`/api/v1/contracts/${id}/services`) && verb === 'PATCH'))
  )
    return null

  if (
    feature === 'manager' &&
    ((matches('/api/v1/(rooms|room-types)') && verb === 'GET') ||
      (matches('/api/v1/bookings') && verb === 'GET') ||
      (matches(`/api/v1/bookings/${id}`) && verb === 'GET') ||
      (matches(`/api/v1/bookings/${id}/review`) && verb === 'POST') ||
      (matches(`/api/v1/bookings/${id}/payments`) && verb === 'GET') ||
      (matches(`/api/v1/bookings/${id}/payments/${id}/reconcile`) && verb === 'POST') ||
      (matches(`/api/v1/bookings/${id}/refund/approve`) && verb === 'POST') ||
      (matches('/api/v1/contracts') && verb === 'GET') ||
      (matches(`/api/v1/contracts/${id}`) && verb === 'GET') ||
      (matches(`/api/v1/contracts/from-booking/${id}`) && verb === 'POST') ||
      (matches(`/api/v1/contracts/${id}/check-in`) && verb === 'POST'))
  )
    return null

  if (feature === 'adminUsers') {
    if (pathname === '/api/users' && ['GET', 'POST'].includes(verb)) return null
    if (matches(`/api/users/${id}`) && verb === 'GET') return null
    if (matches(`/api/users/${id}/active-status`) && verb === 'PATCH') return null
  }

  if (feature === 'notifications') {
    if (verb === 'GET' && matches(`/api/notifications(/unread-count|/${id})?`)) return null
    if (verb === 'PUT' && matches('/api/notifications/(mark-read|mark-all-read)')) return null
  }

  if (feature === 'utilities') {
    if (
      verb === 'GET' &&
      (matches(`/api/branches/${id}/services`) ||
        matches(`/api/services/${id}`) ||
        matches(`/api/rooms/${id}/services`) ||
        matches(`/api/branches/${id}/room-services`) ||
        matches(`/api/room-services/${id}`) ||
        matches(`/api/contracts/${id}/services`) ||
        matches('/api/contract-services'))
    )
      return null
    if (
      verb === 'POST' &&
      (matches(`/api/branches/${id}/services`) ||
        matches(`/api/branches/${id}/room-services`) ||
        matches('/api/contract-services/register'))
    )
      return null
    if (verb === 'DELETE' && matches(`/api/services/${id}`)) return null
    if (
      verb === 'PUT' &&
      (matches(`/api/services/${id}`) ||
        matches(`/api/room-services/${id}`) ||
        matches(`/api/contract-services/${id}/cancel`) ||
        matches(`/api/contract-services/${id}/process`))
    )
      return null
  }

  return 'Chức năng này hiện chưa khả dụng. Vui lòng thử lại khi có thông báo cập nhật.'
}
