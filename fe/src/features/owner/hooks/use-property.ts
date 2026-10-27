import { useSession } from '@/features/auth/session-store'
import { databaseIdSchema } from '@/interfaces/domain'
import { ownerProperties } from '@/services/owner-properties'
import { useQuery } from '@tanstack/react-query'

export function useProperty(id: string) {
  const userId = useSession((s) => s.user?.id)
  return useQuery({
    queryKey: ['owner-property', userId, id],
    queryFn: () => ownerProperties.get(id),
    enabled: databaseIdSchema.safeParse(id).success,
    retry: false,
  })
}
