import { Navigate, useParams } from 'react-router'

export function CreateAppointmentPage() {
  const { roomId = '' } = useParams()
  return <Navigate to={`/rooms/${roomId}/viewing`} replace />
}