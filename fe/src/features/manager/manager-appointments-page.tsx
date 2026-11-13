import { AppointmentsPage } from '@/features/leasing/viewing-appointment-pages'

import { Navigate, useLocation, useSearchParams } from 'react-router'
import { useManager } from './context'

export function ManagerAppointments() {
  const { branch } = useManager()
  const location = useLocation()
  const [params] = useSearchParams()
  if (!params.get('branchId')) {
    const search = new URLSearchParams(params)
    search.set('branchId', branch.id)
    return <Navigate replace to={{ pathname: location.pathname, search: search.toString() }} />
  }
  return <AppointmentsPage management />
}
