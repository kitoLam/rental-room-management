import { create } from 'zustand'
import { useOutletContext, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-store'
import { queryClient } from '@/services/query-client'
import { managerApi } from '@/services/manager'
import type { ManagerBranch, ManagerResource } from '@/interfaces/manager'
function stored() {
  try {
    return JSON.parse(sessionStorage.getItem('tropro-manager-branch') || '{}') as Record<
      string,
      string
    >
  } catch {
    return {}
  }
}
export const useManagerSelection = create<{
  byUser: Record<string, string>
  denied: string[]
  select: (userId: string, id: string) => void
  deny: (id: string) => void
  clearDenied: () => void
}>((set) => ({
  byUser: stored(),
  denied: [],
  clearDenied: () => set({ denied: [] }),
  select: (userId, id) =>
    set((s) => {
      const byUser = { ...s.byUser, [userId]: id }
      sessionStorage.setItem('tropro-manager-branch', JSON.stringify(byUser))
      return { byUser, denied: s.denied.filter((v) => v !== id) }
    }),
  deny: (id) => set((s) => ({ denied: [...s.denied, id] })),
}))
export const useManager = () =>
  useOutletContext<{ branch: ManagerBranch; branches: ManagerBranch[] }>()
export function managerLink(path: string, branchId: string, params: Record<string, string> = {}) {
  const workspace: Record<string,string> = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('workspace') === 'owner' ? {workspace:'owner'} : {}
  return `${path}?${new URLSearchParams({ branchId, ...workspace, ...params })}`
}
export function useManagerQuery<T>(
  key: string,
  fn: (branchId: string) => Promise<T>,
  extra: unknown[] = [],
  poll = false,
) {
  const { branch } = useManager(),
    userId = useSession((s) => s.user!.id),
    [params] = useSearchParams()
  return useQuery({
    queryKey: ['manager', userId, branch.id, params.get('workspace') || 'manager', key, ...extra, params.get('demo')],
    queryFn: () => fn(branch.id),
    refetchInterval: poll ? 4000 : false,
  })
}
export function useManagerList<K extends ManagerResource>(
  resource: K,
  filters: Record<string, string> = {},
  poll = false,
) {
  return useManagerQuery(resource, (b) => managerApi.list(b, resource, filters), [filters], poll)
}
export function useManagerAction(onSuccess?: (result: { id?: string } | null) => void) {
  const { branch } = useManager()
  return useMutation({
    mutationFn: (args: {
      resource: ManagerResource
      id?: string | null
      action?: string
      value: unknown
      method?: 'POST' | 'PATCH' | 'DELETE'
    }) =>
      managerApi.action(
        branch.id,
        args.resource,
        args.id || null,
        args.action || '',
        args.value,
        args.method || 'POST',
      ),
    onSuccess: (data) => {
      void queryClient.invalidateQueries()
      onSuccess?.(data)
    },
  })
}
