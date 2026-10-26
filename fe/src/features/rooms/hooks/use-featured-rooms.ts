import { useQuery } from '@tanstack/react-query'
import { getFeaturedRooms } from '../api/rooms.service'
export function useFeaturedRooms() {
  const result = useQuery({
    queryKey: ['rooms', 'featured', new URLSearchParams(window.location.search).get('demo')],
    queryFn: getFeaturedRooms,
  })
  return {
    status: result.isPending ? 'loading' : result.isError ? 'error' : 'success',
    rooms: result.data || [],
    retry: () => {
      void result.refetch()
    },
  }
}
