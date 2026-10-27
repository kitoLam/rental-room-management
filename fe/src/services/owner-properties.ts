import { z } from 'zod'
import { databaseIdSchema } from '@/interfaces/domain'
import { request, write } from './http'

export const propertyTypes = { APARTMENT: 'Căn hộ', BOARDING_HOUSE: 'Nhà trọ', HOUSE: 'Nhà nguyên căn' } as const
export const propertyInputSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên chi nhánh.').max(255),
  address: z.string().trim().min(1, 'Nhập địa chỉ.').max(2000),
  propertyType: z.enum(['APARTMENT', 'BOARDING_HOUSE', 'HOUSE']),
  declaredRoomCount: z.number().int().min(1).max(10000),
  description: z.string().max(4000),
})
export const propertySchema = propertyInputSchema.extend({
  id: databaseIdSchema, propertyType: propertyInputSchema.shape.propertyType.nullable(),
  declaredRoomCount: z.number().int().nullable(), description: z.string().nullable(),
  roomCount: z.number(), status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
})
export type OwnerProperty = z.infer<typeof propertySchema>
export type PropertyInput = z.infer<typeof propertyInputSchema>
export const propertyRoomInputSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, 'Mã phòng chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.'),
  roomTypeName: z.string().trim().min(1).max(100),
  rentalMode: z.enum(['ROOM', 'SLOT']), capacity: z.number().int().min(1).max(100),
  areaSqm: z.number().min(0.01).max(10000).nullable(), floorNumber: z.number().int().min(0).max(200).nullable(),
  referencePrice: z.number().int().min(0).max(1000000000000), description: z.string().max(4000), isPublic: z.boolean(),
})
export type PropertyRoomInput = z.infer<typeof propertyRoomInputSchema>
const propertyRoomSchema = z.object({
  id: databaseIdSchema, branchId: databaseIdSchema, code: z.string(),
  rentalMode: z.enum(['ROOM', 'SLOT']), capacity: z.number(), areaSqm: z.number().nullable(),
  floorNumber: z.number().nullable(), referencePrice: z.number(), isPublic: z.boolean(),
  operationalStatus: z.string(), description: z.string().nullable(),
})
const root = '/api/owner/properties'
export const ownerProperties = {
  list: () => request('owner', root, z.array(propertySchema)),
  get: (id: string) => request('owner', `${root}/${encodeURIComponent(id)}`, propertySchema),
  save: (input: PropertyInput, id?: string) => request('owner', id ? `${root}/${encodeURIComponent(id)}` : root, propertySchema, write(id ? 'PUT' : 'POST', input)),
  rooms: (id: string) => request('owner', `${root}/${encodeURIComponent(id)}/rooms`, z.array(propertyRoomSchema)),
  createRoom: (id: string, input: PropertyRoomInput) => request('owner', `${root}/${encodeURIComponent(id)}/rooms`, propertyRoomSchema, write('POST', input)),
}
