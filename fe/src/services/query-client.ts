import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './http'
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20000,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})
export function invalidateActivity() {
  return Promise.all(
    [
      'appointments',
      'bookings',
      'payments',
      'notifications',
      'rooms',
      'availability',
      'policy',
    ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  )
}
