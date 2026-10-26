import { create } from 'zustand'
import { useOutletContext, useSearchParams } from 'react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-store'
import { queryClient } from '@/services/query-client'
import type { Tenancy } from '@/interfaces/tenant'

function stored(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem('tropro-active-tenancy') || '{}')
  } catch {
    return {}
  }
}
export const useTenancySelection = create<{
  byUser: Record<string, string>
  select: (userId: string, id: string) => void
}>((set) => ({
  byUser: stored(),
  select: (userId, id) =>
    set((state) => {
      const byUser = { ...state.byUser, [userId]: id }
      sessionStorage.setItem('tropro-active-tenancy', JSON.stringify(byUser))
      return { byUser }
    }),
}))
export type TenantContext = { tenancy: Tenancy; tenancies: Tenancy[] }
export const useTenant = () => useOutletContext<TenantContext>()
export const isActive = (t: Tenancy) =>
  t.status === 'ACTIVE' &&
  t.contractStatus === 'ACTIVE' &&
  t.startDate <= new Date().toISOString().slice(0, 10) &&
  t.endDate > new Date().toISOString().slice(0, 10)
export function tenantLink(path: string, t: Tenancy) {
  return `${path}?tenancyId=${encodeURIComponent(t.id)}`
}
export function useTenantQuery<T>(
  feature: string,
  fn: (id: string) => Promise<T>,
  suffix: unknown[] = [],
  poll = false,
) {
  const { tenancy } = useTenant(),
    user = useSession((s) => s.user),
    [params] = useSearchParams()
  return useQuery({
    queryKey: ['tenant', user!.id, tenancy.id, feature, ...suffix, params.get('demo')],
    queryFn: () => fn(tenancy.id),
    refetchInterval: poll ? 3000 : false,
  })
}
export function useTenantMutation<T, V>(
  fn: (id: string, value: V) => Promise<T>,
  onSuccess?: (data: T) => void,
) {
  const { tenancy } = useTenant(),
    userId = useSession((s) => s.user!.id)
  return useMutation({
    mutationFn: (value: V) => fn(tenancy.id, value),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['tenant', userId, tenancy.id] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      onSuccess?.(data)
    },
  })
}
