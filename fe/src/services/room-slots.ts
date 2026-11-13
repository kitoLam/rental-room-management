import { z } from 'zod'
import { request, write } from './http'

/** Slots of a room for staff: status, rentable-from date and whether someone holds them. */
export const roomSlotUsageSchema = z.object({
  id: z.string(),
  slotCode: z.string().nullish(),
  slotNumber: z.number().nullish(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']),
  availableFrom: z.string().nullish(),
  busy: z.boolean(),
  busyReason: z.string().nullish(),
})
export type RoomSlotUsage = z.infer<typeof roomSlotUsageSchema>

export const roomSlotsApi = {
  list: (roomId: string) =>
    request('manager', `/api/v1/rooms/${encodeURIComponent(roomId)}/slots`, z.array(roomSlotUsageSchema)),
  /** Refused by the backend while the slot is busy or for a past date. */
  setAvailableFrom: (roomId: string, slotId: string, availableFrom: string) =>
    request(
      'manager',
      `/api/v1/rooms/${encodeURIComponent(roomId)}/slots/${encodeURIComponent(slotId)}/available-from`,
      roomSlotUsageSchema,
      write('PATCH', { availableFrom }),
    ),
}
