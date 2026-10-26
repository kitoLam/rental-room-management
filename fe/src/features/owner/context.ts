import { create } from 'zustand'
import { useOutletContext, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-store'
import { ownerApi, type OwnerResource } from '@/services/owner'
import { queryClient } from '@/services/query-client'
import type { OwnedBranch } from '@/interfaces/owner'
export const useOwnerSelection = create<{
  selected: Record<string, string>
  select: (user: string, branch: string) => void
}>((set) => ({
  selected: {},
  select: (user, branch) => set((s) => ({ selected: { ...s.selected, [user]: branch } })),
}))
export const useOwner = () => useOutletContext<{ branches: OwnedBranch[]; scope: string }>()
export function useOwnerQuery<T>(key: string, fn: () => Promise<T>, extra: unknown[] = []) {
  const user = useSession((s) => s.user!),
    { scope } = useOwner()
  return useQuery({
    queryKey: ['owner', user.id, scope, key, ...extra],
    queryFn: fn,
    retry: false,
    refetchInterval: 5000,
  })
}
export function useOwnerList<K extends OwnerResource>(
  resource: K,
  filters: Record<string, string> = {},
) {
  const { scope } = useOwner()
  return useOwnerQuery(
    resource,
    () => ownerApi.list(resource, { ...filters, ...(scope ? { branchId: scope } : {}) }),
    [filters],
  )
}
export function useOwnerMutation(done?: (data: { id?: string } | null) => void) {
  return useMutation({
    mutationFn: ({
      path,
      value,
      method,
    }: {
      path: string
      value: unknown
      method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    }) => ownerApi.mutate(path, value, method),
    onSuccess: (data) => {
      void queryClient.invalidateQueries()
      done?.(data)
    },
  })
}
export const operationsLink = (branch: string, page = 'dashboard') =>
  `/manager/${page}?${new URLSearchParams({ branchId: branch, workspace: 'owner' })}`
export function useOwnerFilters(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams()
  const filters: Record<string, string> = {
    ...defaults,
    ...Object.fromEntries(
      Object.keys({ ...defaults, q: '', status: '', page: '' }).map((k) => [
        k,
        params.get(k) ?? defaults[k] ?? '',
      ]),
    ),
  }
  const page = Math.max(1, Number(params.get('page') || 1) || 1)
  const change = (key: string, value: string) =>
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
      p.delete('page')
      return p
    })
  return {
    filters: { ...filters, page: String(page - 1) } as Record<string, string>,
    page,
    change,
    onPage: (value: number) =>
      setParams((p) => {
        p.set('page', String(value))
        return p
      }),
  }
}
