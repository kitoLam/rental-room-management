import { safeRedirect } from '@/lib/validation'

const workspaceRoles = new Map<string, readonly string[]>([
  ['owner', ['OWNER']],
  ['manager', ['OWNER', 'MANAGER']],
  ['admin', ['ADMIN']],
  ['tenant', ['TENANT']],
])

export function dashboardPath(roles: readonly string[]) {
  if (roles.includes('ADMIN')) return '/admin/dashboard'
  if (roles.includes('OWNER') || roles.includes('MANAGER')) return '/manager/dashboard'
  return '/user/dashboard'
}

export function postLoginPath(requested: string | null, roles: readonly string[]) {
  const isStaff = roles.includes('ADMIN') || roles.includes('OWNER') || roles.includes('MANAGER')
  const home = isStaff ? dashboardPath(roles) : '/'
  const target = safeRedirect(requested, home)
  const pathname = new URL(target, 'https://tropro.local').pathname
  if (!isStaff && /^\/(user(\/dashboard)?|profile)\/?$/.test(pathname)) return '/'
  if (
    /^\/(user|owner|manager|admin)(\/dashboard)?\/?$/.test(pathname)
    && pathname !== home
  ) return home
  const allowed = workspaceRoles.get(pathname.split('/')[1])
  return allowed && !allowed.some((role) => roles.includes(role)) ? home : target
}
