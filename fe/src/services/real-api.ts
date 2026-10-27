import type { Feature } from './config'

/** Only contracts verified against the current backend are enabled for real requests.
 * See docs/frontend/real-api-integration-audit.md for pending contracts and decisions.
 */
export function realApiIssue(feature: Feature, path: string, method = 'GET'): string | null {
  const pathname = path.split('?')[0]
  const verb = method.toUpperCase()
  const id = '[0-9a-fA-F-]{36}'
  const matches = (pattern: string) => new RegExp(`^${pattern}$`).test(pathname)
  if (feature === 'owner' && (
    (matches('/api/owner/properties') && ['GET', 'POST'].includes(verb)) ||
    (matches(`/api/owner/properties/${id}`) && ['GET', 'PUT'].includes(verb)) ||
    (matches(`/api/owner/properties/${id}/rooms`) && ['GET', 'POST'].includes(verb))
  )) return null

  if (feature === 'auth' && verb === 'POST' &&
      matches('/api/auth/(login|register|verify-email|refresh|logout)')) return null

  if (feature === 'catalog' && verb === 'GET' &&
      matches(`/api/v1/public/rooms(/${id})?`)) return null

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
    if (verb === 'GET' && (
      matches(`/api/branches/${id}/services`) ||
      matches(`/api/services/${id}`) ||
      matches(`/api/rooms/${id}/services`) ||
      matches(`/api/branches/${id}/room-services`) ||
      matches(`/api/room-services/${id}`) ||
      matches(`/api/contracts/${id}/services`) ||
      matches('/api/contract-services')
    )) return null
    if (verb === 'POST' && (
      matches(`/api/branches/${id}/services`) ||
      matches(`/api/branches/${id}/room-services`) ||
      matches('/api/contract-services/register')
    )) return null
    if (verb === 'DELETE' && matches(`/api/services/${id}`)) return null
    if (verb === 'PUT' && (
      matches(`/api/services/${id}`) ||
      matches(`/api/room-services/${id}`) ||
      matches(`/api/contract-services/${id}/cancel`) ||
      matches(`/api/contract-services/${id}/process`)
    )) return null
  }

  return 'Chức năng này hiện chưa khả dụng. Vui lòng thử lại khi có thông báo cập nhật.'
}
