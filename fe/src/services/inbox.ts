import { z } from 'zod'
import { request } from './http'

const inboxItemSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string(),
  message: z.string(),
  detailPath: z.string().regex(/^\/(?:user\/contracts|tenant\/services)$/),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullish(),
})
const inboxPageSchema = z.object({
  content: z.array(inboxItemSchema),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
})
export type InboxItem = z.infer<typeof inboxItemSchema>

export const inboxService = {
  list(read?: boolean, page = 1, size = 20) {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (read !== undefined) params.set('read', String(read))
    return request('notifications', `/api/v1/notifications?${params}`, inboxPageSchema)
  },
  read: (id: string) =>
    request('notifications', `/api/v1/notifications/${id}/read`, inboxItemSchema, { method: 'POST' }),
  readAll: () =>
    request('notifications', '/api/v1/notifications/read-all', z.number().int().nonnegative(), { method: 'POST' }),
}
