import { z } from 'zod'
import { pageSchema } from '@/interfaces/domain'
import { request, write } from './http'

/**
 * Room services (fixed per room, staff only) and slot services (optional, tenant can request),
 * plus slot service requests. Always talks to the real backend.
 */

const money = z.coerce.number()

export const catalogKinds = {
  room: { path: 'room-services', label: 'Dịch vụ theo phòng' },
  slot: { path: 'slot-services', label: 'Dịch vụ tự chọn' },
} as const
export type CatalogKind = keyof typeof catalogKinds

export const catalogItemSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  name: z.string(),
  unit: z.string(),
  unitPrice: money,
  calculationType: z.enum(['PER_ROOM', 'PER_PERSON']).nullish(),
  description: z.string().nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})
export type CatalogItem = z.infer<typeof catalogItemSchema>

export type CatalogInput = {
  branchId?: string
  name: string
  unit: string
  unitPrice: number
  calculationType?: 'PER_ROOM' | 'PER_PERSON'
  description?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export const requestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
export type RequestStatus = z.infer<typeof requestStatusSchema>

export const slotServiceRequestSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  contractNumber: z.string().nullish(),
  tenantName: z.string().nullish(),
  branchId: z.string().nullish(),
  slotServiceId: z.string(),
  serviceName: z.string().nullish(),
  unit: z.string().nullish(),
  unitPrice: money.nullish(),
  quantity: z.number().nullish(),
  action: z.enum(['ADD', 'CANCEL']),
  status: requestStatusSchema,
  note: z.string().nullish(),
  rejectReason: z.string().nullish(),
  effectiveDate: z.string().nullish(),
  createdAt: z.string().nullish(),
})
export type SlotServiceRequest = z.infer<typeof slotServiceRequestSchema>

export const activeSlotServiceSchema = z.object({
  slotServiceId: z.string(),
  name: z.string().nullish(),
  unit: z.string().nullish(),
  unitPrice: money.nullish(),
  quantity: z.number().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
})
export type ActiveSlotService = z.infer<typeof activeSlotServiceSchema>

const tenantContractSchema = z.object({
  id: z.string(),
  contractNumber: z.string().nullish(),
  roomId: z.string().nullish(),
  roomAddress: z.string().nullish(),
  status: z.string(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  activeSlotServices: z.array(activeSlotServiceSchema).nullish(),
})
export type TenantContract = z.infer<typeof tenantContractSchema>

const roomSchema = z.object({ id: z.string(), branchId: z.string() })

export const serviceCatalogApi = {
  // ----- staff
  list: async (kind: CatalogKind, branchId: string) =>
    (
      await request(
        'manager',
        `/api/v1/${catalogKinds[kind].path}?${new URLSearchParams({ branchId, page: '1', size: '100' })}`,
        pageSchema(catalogItemSchema),
      )
    ).content,
  create: (kind: CatalogKind, value: CatalogInput) =>
    request('manager', `/api/v1/${catalogKinds[kind].path}`, catalogItemSchema, write('POST', value)),
  update: (kind: CatalogKind, id: string, value: CatalogInput) =>
    request('manager', `/api/v1/${catalogKinds[kind].path}/${encodeURIComponent(id)}`, catalogItemSchema, write('PATCH', value)),
  remove: (kind: CatalogKind, id: string) =>
    request('manager', `/api/v1/${catalogKinds[kind].path}/${encodeURIComponent(id)}`, z.unknown(), write('DELETE')),
  requests: async (branchId: string, status?: RequestStatus) => {
    const params = new URLSearchParams({ branchId, page: '1', size: '100' })
    if (status) params.set('status', status)
    return (await request('manager', `/api/v1/slot-service-requests?${params}`, pageSchema(slotServiceRequestSchema))).content
  },
  approve: (id: string, effectiveDate?: string) =>
    request('manager', `/api/v1/slot-service-requests/${encodeURIComponent(id)}/approve`, slotServiceRequestSchema,
      write('POST', { effectiveDate: effectiveDate || null })),
  reject: (id: string, reason: string) =>
    request('manager', `/api/v1/slot-service-requests/${encodeURIComponent(id)}/reject`, slotServiceRequestSchema,
      write('POST', { reason })),

  // ----- public / tenant
  activeOfBranch: (kind: CatalogKind, branchId: string) =>
    request('catalog', `/api/v1/public/branches/${encodeURIComponent(branchId)}/${catalogKinds[kind].path}`, z.array(catalogItemSchema)),
  myContracts: async () =>
    (await request('tenant', '/api/v1/contracts?page=1&size=100', pageSchema(tenantContractSchema))).content,
  roomOf: (roomId: string) => request('tenant', `/api/v1/rooms/${encodeURIComponent(roomId)}`, roomSchema),
  myRequests: async () =>
    (await request('tenant', '/api/v1/slot-service-requests/mine?page=1&size=100', pageSchema(slotServiceRequestSchema))).content,
  createRequest: (value: { contractId: string; slotServiceId: string; action: 'ADD' | 'CANCEL'; quantity?: number; note?: string }) =>
    request('tenant', '/api/v1/slot-service-requests', slotServiceRequestSchema, write('POST', value)),
  cancelRequest: (id: string) =>
    request('tenant', `/api/v1/slot-service-requests/${encodeURIComponent(id)}/cancel`, slotServiceRequestSchema, write('POST')),
}

export const requestStatusLabel: Record<RequestStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã rút',
}

export const requestStatusTone: Record<RequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
}

/** Service still in use today (no end date or ending later). */
export function isInUse(service: ActiveSlotService, today = new Date().toISOString().slice(0, 10)) {
  return !service.endDate || service.endDate > today
}
