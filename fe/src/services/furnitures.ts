import { z } from 'zod'
import { pageSchema } from '@/interfaces/domain'
import { request, write } from './http'

/** Cơ sở vật chất (staff only): grouped by name, one document per room. Real backend only. */

export const conditions = ['NEW', 'GOOD', 'WORN', 'DAMAGED', 'BROKEN'] as const
export type FurnitureCondition = (typeof conditions)[number]
export const conditionLabel: Record<FurnitureCondition, string> = {
  NEW: 'Mới',
  GOOD: 'Tốt',
  WORN: 'Cũ',
  DAMAGED: 'Hư hỏng nhẹ',
  BROKEN: 'Hỏng',
}

export const furnitureRoomSchema = z.object({
  furnitureId: z.string(),
  roomId: z.string(),
  roomNumber: z.string().nullish(),
  roomTitle: z.string().nullish(),
  quantity: z.number().nullish(),
  condition: z.enum(conditions).nullish(),
  reportCount: z.number(),
})
export type FurnitureRoom = z.infer<typeof furnitureRoomSchema>

export const furnitureGroupSchema = z.object({
  branchId: z.string(),
  name: z.string(),
  totalQuantity: z.number(),
  rooms: z.array(furnitureRoomSchema),
})
export type FurnitureGroup = z.infer<typeof furnitureGroupSchema>

export type FurnitureInput = {
  branchId: string
  name: string
  quantity: number
  condition: FurnitureCondition
  roomIds: string[]
}

const branchRoomSchema = z.object({
  id: z.string(),
  roomNumber: z.string().nullish(),
  title: z.string().nullish(),
})

const base = '/api/v1/furnitures'

export const furnitureApi = {
  groups: (branchId: string) =>
    request('manager', `${base}/groups?${new URLSearchParams({ branchId })}`, z.array(furnitureGroupSchema)),
  create: (value: FurnitureInput) => request('manager', base, furnitureGroupSchema, write('POST', value)),
  update: (current: FurnitureGroup, value: FurnitureInput) =>
    request(
      'manager',
      `${base}/groups`,
      furnitureGroupSchema,
      write('PATCH', {
        branchId: value.branchId,
        name: current.name,
        newName: value.name,
        quantity: value.quantity,
        condition: value.condition,
        roomIds: value.roomIds,
      }),
    ),
  remove: (group: FurnitureGroup) =>
    request(
      'manager',
      `${base}/groups?${new URLSearchParams({ branchId: group.branchId, name: group.name })}`,
      z.unknown(),
      write('DELETE'),
    ),
  rooms: async (branchId: string) =>
    (
      await request(
        'manager',
        `/api/v1/rooms?${new URLSearchParams({ branchId, page: '1', size: '100' })}`,
        pageSchema(branchRoomSchema),
      )
    ).content,
}

export const roomLabel = (r: { roomNumber?: string | null; title?: string | null; roomTitle?: string | null; id?: string }) =>
  [r.roomNumber, r.title ?? r.roomTitle].filter(Boolean).join(' · ') || r.id || ''
