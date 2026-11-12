import { Navigate, useLocation } from 'react-router'

/** Preserve old bookmarks, notification links and payment return query parameters. */
export function LegacyTenantRedirect() {
  const location = useLocation()
  const pathname = location.pathname.replace(
    /^\/user\/(appointments|bookings)(?=\/|$)/,
    '/tenant/$1',
  )
  return (
    <Navigate
      replace
      to={{ pathname, search: location.search, hash: location.hash }}
      state={location.state}
    />
  )
}
