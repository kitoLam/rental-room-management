import { Navigate, useLocation } from 'react-router'
import { useSession } from './session-store'
import { accountPath } from './navigation'
import { useManagerSelection } from '@/features/manager/context'

/** Keep old bookmarks and notification links while using the account's workspace. */
export function LegacyAccountRedirect() {
  const user = useSession((s) => s.user!)
  const location = useLocation()
  const selected = useManagerSelection((s) => s.byUser[user.id])
  const section =
    location.pathname === '/manager-invitations'
      ? 'manager-invitations'
      : location.pathname.startsWith('/rooms/')
        ? location.pathname.slice(1)
        : location.pathname === '/profile'
          ? 'profile'
          : location.pathname.startsWith('/notifications')
            ? 'notifications'
            : location.pathname.replace(/^\/user\/?/, '') || 'dashboard'
  const target = accountPath(user.roles, section)
  const query = new URLSearchParams(location.search)
  if (
    (target.startsWith('/manager/') || target.startsWith('/owner/')) &&
    !query.has('branchId') &&
    selected
  )
    query.set('branchId', selected)
  return (
    <Navigate
      replace
      to={{ pathname: target, search: query.toString(), hash: location.hash }}
      state={location.state}
    />
  )
}

export function LegacyManagementSettingsRedirect() {
  const user = useSession((s) => s.user!)
  const location = useLocation()
  const selected = useManagerSelection((s) => s.byUser[user.id])
  const section = user.roles.some((r) => r === 'OWNER' || r === 'MANAGER')
    ? location.pathname.slice(1)
    : 'dashboard'
  const query = new URLSearchParams(location.search)
  if (selected && !query.has('branchId')) query.set('branchId', selected)
  return (
    <Navigate
      replace
      to={{
        pathname: accountPath(user.roles, section),
        search: query.toString(),
        hash: location.hash,
      }}
    />
  )
}
