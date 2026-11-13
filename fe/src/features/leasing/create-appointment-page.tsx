import { Navigate, useLocation, useParams } from 'react-router'

export function CreateAppointmentPage() {
  const { roomId = '' } = useParams()
  const location = useLocation()
  return (
    <Navigate
      to={{ pathname: `/rooms/${roomId}/viewing`, search: location.search, hash: location.hash }}
      replace
    />
  )
}
