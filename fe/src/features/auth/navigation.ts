import { safeRedirect } from '@/lib/validation'

const workspaceRoles = new Map<string, readonly string[]>([
  ['owner', ['OWNER']],
  // Old manager links remain valid for owners; RouteGuard moves them to /owner.
  ['manager', ['OWNER', 'MANAGER']],
  ['admin', ['ADMIN']],
  ['tenant', ['TENANT']],
])

export function dashboardPath(roles: readonly string[]) {
  if (roles.includes('ADMIN')) return '/admin/dashboard'
  if (roles.includes('OWNER')) return '/owner/dashboard'
  if (roles.includes('MANAGER')) return '/manager/dashboard'
  return '/tenant/dashboard'
}

export function accountPath(roles: readonly string[], section: string, branchId?: string | null) {
  const root = dashboardPath(roles).replace('/dashboard', '')
  if (
    root === '/admin' &&
    ![
      'profile',
      'notifications',
      'dashboard',
      'manager-invitations',
      'owner-onboarding',
      'owner-verification',
    ].includes(section.split('/')[0])
  )
    return '/admin/dashboard'
  const query =
    branchId && (root === '/owner' || root === '/manager')
      ? `?${new URLSearchParams({ branchId })}`
      : ''
  const resource =
    root === '/tenant' && /^(contracts|payments)(\/|$)/.test(section)
      ? `account/${section}`
      : section
  return `${root}/${resource}${query}`
}

export function postLoginPath(requested: string | null, roles: readonly string[]) {
  const isStaff = roles.includes('ADMIN') || roles.includes('OWNER') || roles.includes('MANAGER')
  const home = isStaff ? dashboardPath(roles) : '/'
  const target = safeRedirect(requested, home)
  const pathname = new URL(target, 'https://tropro.local').pathname
  if (!isStaff && /^\/(user(\/dashboard)?|profile)\/?$/.test(pathname)) return '/'
  if (/^\/(user|tenant|owner|manager|admin)(\/dashboard)?\/?$/.test(pathname) && pathname !== home)
    return home
  const allowed = workspaceRoles.get(pathname.split('/')[1])
  return allowed && !allowed.some((role) => roles.includes(role)) ? home : target
}
