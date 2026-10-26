import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useSession } from '@/features/auth/session-store'
import { queryClient } from '@/services/query-client'
export function useAdminQuery<T>(resource: string, fn: () => Promise<T>, extra: unknown[] = []) {
  const user = useSession((s) => s.user!),
    [params] = useSearchParams()
  return useQuery({
    queryKey: ['admin', user.id, resource, ...extra, params.get('demo')],
    queryFn: fn,
    retry: false,
    refetchInterval: 5000,
  })
}
export function useAdminMutation<T, V>(fn: (value: V) => Promise<T>, done?: (data: T) => void) {
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      void queryClient.invalidateQueries()
      done?.(data)
    },
  })
}
export function useAdminFilters(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams()
  const filters: Record<string, string> = {
    page: '0',
    size: '8',
    q: '',
    ...defaults,
    ...Object.fromEntries(params),
  }
  const page = Math.max(1, Number(params.get('page') || 1) || 1)
  filters.page = String(page - 1)
  const change = (key: string, value: string) =>
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
      p.delete('page')
      return p
    })
  return {
    filters,
    page,
    change,
    onPage: (value: number) =>
      setParams((p) => {
        p.set('page', String(value))
        return p
      }),
    clear: () => setParams({}),
  }
}
