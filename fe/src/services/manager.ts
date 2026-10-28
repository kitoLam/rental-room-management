import { z } from 'zod'
import { request, write } from './http'
import { provider } from './config'
import { pageSchema, type Page } from '@/interfaces/domain'
import {
  branchAssignmentSchema,
  managerSchemas,
  reportSummarySchema,
  invoiceSourcesSchema,
  invoiceInputSchema,
  type ManagerResource,
  type ManagerRecord,
} from '@/interfaces/manager'
import { utilitiesService } from './utilities'
import { bookingService } from './guest-user'
const scope = (branchId: string) => `/api/manager/branches/${encodeURIComponent(branchId)}`
const result = z.object({ id: z.string().uuid().optional() }).passthrough().nullable()
const roomDto = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  code: z.string(),
  rentalMode: z.enum(['ROOM', 'SLOT']),
  capacity: z.number(),
  areaSqm: z.number().nullable(),
  floorNumber: z.number().nullable(),
  referencePrice: z.number(),
  description: z.string().nullable(),
  amenities: z.array(z.string()).nullable(),
  imageRefs: z.unknown(),
  operationalStatus: z.enum(['AVAILABLE', 'MAINTENANCE', 'INACTIVE']),
  isPublic: z.boolean(),
})
const roomTypeDto = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  defaultCapacity: z.number(),
  description: z.string().nullable(),
  active: z.boolean(),
})
const slotDto = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'INACTIVE']),
})
const apiPage = <T extends z.ZodType>(item: T) =>
  z.object({
    content: z.array(item),
    number: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
  })
const normalizePage = <T>(page: {
  content: T[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}) => ({ ...page, number: page.number - 1 })
const roomImageRefs = (images: unknown) => (Array.isArray(images) ? images : [])
function roomView(r: z.infer<typeof roomDto>, typeName: string) {
  const images = roomImageRefs(r.imageRefs).filter(
    (x): x is string => typeof x === 'string' && /^https?:\/\//.test(x),
  )
  const status = r.operationalStatus === 'AVAILABLE' ? 'ACTIVE' : r.operationalStatus
  return {
    id: r.id,
    code: r.code,
    title: `${typeName} ${r.code}`,
    branchId: r.branchId,
    branchName: '',
    address: '',
    areaKey: '',
    price: r.referencePrice,
    capacity: r.capacity,
    sizeM2: r.areaSqm,
    availableSlots: null,
    floor: r.floorNumber,
    rentalMode: r.rentalMode,
    roomTypeId: r.roomTypeId,
    roomTypeName: typeName,
    operationalStatus: status,
    status:
      r.operationalStatus === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : r.operationalStatus === 'INACTIVE'
          ? 'INACTIVE'
          : 'UNKNOWN',
    isPublic: r.isPublic,
    availability: null,
    occupiedResources: null,
    heldResources: null,
    imageUrl: images[0] || '',
    imageAlt: `${typeName} ${r.code}`,
    images,
    description: r.description || '',
    amenities: r.amenities || [],
    services: [],
  }
}
function typeView(t: z.infer<typeof roomTypeDto>) {
  return { ...t, name: t.name, description: t.description || '' }
}
function slotView(s: z.infer<typeof slotDto>) {
  return {
    id: s.id,
    roomId: s.roomId,
    branchId: '',
    code: s.code,
    name: s.name,
    operationalStatus: s.status === 'AVAILABLE' ? 'ACTIVE' : s.status,
    availability: null,
    occupancy: null,
  }
}
function roomPayload(value: Record<string, unknown>, branchId: string) {
  return {
    branchId,
    roomTypeId: value.roomTypeId,
    roomCode: value.code,
    rentalMode: value.rentalMode,
    capacity: value.capacity,
    areaSqm: value.sizeM2,
    floorNumber: value.floor,
    referencePrice: value.price,
    description: value.description,
    amenities: value.amenities,
    imageRefs: value.images,
    operationalStatus: value.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : value.operationalStatus,
    isPublic: value.isPublic,
  }
}
const slotListPage = (slots: z.infer<typeof slotDto>[]) => ({
  content: slots.map(slotView),
  number: 0,
  size: slots.length,
  totalElements: slots.length,
  totalPages: slots.length ? 1 : 0,
})
export const managerApi = {
  previewCharge: (branchId: string, value: unknown) =>
    request(
      'manager',
      `${scope(branchId)}/charge-preview`,
      managerSchemas['utility-charges'],
      write('POST', value),
    ),
  invoiceEditor: (branchId: string, id: string) =>
    request(
      'manager',
      `${scope(branchId)}/invoices/${encodeURIComponent(id)}/editor`,
      invoiceInputSchema,
    ),
  branches: () => request('manager', '/api/manager/branches', z.array(branchAssignmentSchema)),
  list: async <K extends ManagerResource>(
    branchId: string,
    resource: K,
    filters: Record<string, string> = {},
  ): Promise<Page<ManagerRecord<K>>> => {
    if (resource === 'bookings' && provider('manager') === 'real') {
      const result = await bookingService.managerList(filters.status || '', Number(filters.page || 0) + 1)
      return result as unknown as Page<ManagerRecord<K>>
    }
    if (resource === 'services' && provider('utilities') === 'real') {
      const raw = await utilitiesService.catalog.list(branchId, {
        page: Number(filters.page || 0),
        size: Number(filters.size || 8),
      })
      return {
        ...raw,
        number: Math.max(0, raw.number - 1),
        content: raw.content.map((item) => ({
          id: item.id,
          branchId: item.branchId,
          code: item.code,
          name: item.name,
          unit: item.unit,
          type: item.serviceType,
          billingMethod: item.billingMethod,
          unitPrice: item.referencePrice,
          mandatory: item.mandatory,
          active: item.active,
        })) as unknown as ManagerRecord<K>[],
      }
    }
    if (resource === 'service-requests' && provider('utilities') === 'real') {
      const page = Number(filters.page || 0)
      const size = Number(filters.size || 8)
      const res = await utilitiesService.contractServices.list({
        branchId,
        status: filters.status,
      })
      const filtered = filters.q
        ? res.filter((item) => item.serviceName.toLowerCase().includes(filters.q.toLowerCase()))
        : res
      const content = filtered.slice(page * size, (page + 1) * size).map((item) => ({
        id: item.id,
        serviceId: item.roomServiceId,
        contractTenantId: item.contractTenantId || item.contractId,
        roomId: item.roomId,
        tenantName: 'Khách thuê',
        roomName: 'Phòng',
        name: item.serviceName,
        mandatory: false,
        unit: 'tháng',
        unitPrice: item.agreedUnitPrice,
        subscriptionId: item.id,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.reason || '',
        history: item.processedAt
          ? [
              {
                status: item.status,
                at: item.processedAt,
                note: item.reason || 'Đã xử lý',
              },
            ]
          : [],
      }))
      return {
        content: content as unknown as ManagerRecord<K>[],
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size) || (filtered.length ? 1 : 0),
      }
    }
    if (resource === 'room-services' && provider('utilities') === 'real') {
      const page = Number(filters.page || 0)
      const size = Number(filters.size || 8)
      const res = await utilitiesService.roomServices.listByBranch(branchId)
      const filtered = filters.q
        ? res.filter((item) => item.serviceName.toLowerCase().includes(filters.q.toLowerCase()))
        : res
      const content = filtered.slice(page * size, (page + 1) * size).map((item) => ({
        id: item.id,
        branchId: item.branchId || branchId,
        roomId: item.roomId,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        roomName: 'Phòng',
        startDate: item.startDate,
        endDate: item.endDate,
        unitPrice: item.unitPrice,
        status: item.status === 'ACTIVE' ? ('ACTIVE' as const) : ('ENDED' as const),
      }))
      return {
        content: content as unknown as ManagerRecord<K>[],
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size) || (filtered.length ? 1 : 0),
      }
    }
    if (provider('manager') === 'real' && ['rooms', 'room-types', 'slots'].includes(resource)) {
      const page = Number(filters.page || 0),
        size = Number(filters.size || 8)
      if (resource === 'rooms') {
        const params = new URLSearchParams({ branchId, page: String(page), size: String(size) })
        if (filters.roomTypeId) params.set('roomTypeId', filters.roomTypeId)
        if (filters.minPrice) params.set('minPrice', filters.minPrice)
        if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
        if (filters.capacity) params.set('minCapacity', filters.capacity)
        if (filters.operationalStatus)
          params.set(
            'status',
            filters.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : filters.operationalStatus,
          )
        return request('manager', `/api/v1/rooms?${params}`, apiPage(roomDto)).then(async (p) => {
          const types = await request(
            'manager',
            `/api/v1/room-types?${new URLSearchParams({ page: '0', size: '100' })}`,
            apiPage(roomTypeDto),
          )
          const names = new Map(types.content.map((t) => [t.id, t.name]))
          return normalizePage({
            ...p,
            content: p.content.map((r) => roomView(r, names.get(r.roomTypeId) || 'Phòng')),
          })
        }) as Promise<Page<ManagerRecord<K>>>
      }
      if (resource === 'room-types') {
        const params = new URLSearchParams({ page: '0', size: '1000' })
        return request('manager', `/api/v1/room-types?${params}`, apiPage(roomTypeDto)).then(
          (p) => {
            const filtered = p.content.filter(
              (t) =>
                t.branchId === branchId &&
                (!filters.q ||
                  `${t.code} ${t.name}`.toLowerCase().includes(filters.q.toLowerCase())),
            )
            return {
              content: filtered.slice(page * size, (page + 1) * size).map(typeView),
              number: page,
              size,
              totalElements: filtered.length,
              totalPages: Math.ceil(filtered.length / size),
            }
          },
        ) as Promise<Page<ManagerRecord<K>>>
      }
      const roomId = filters.roomId
      if (!roomId) return Promise.resolve(slotListPage([])) as Promise<Page<ManagerRecord<K>>>
      return request(
        'manager',
        `/api/v1/rooms/${encodeURIComponent(roomId)}/slots`,
        z.array(slotDto),
      ).then(slotListPage) as Promise<Page<ManagerRecord<K>>>
    }
    try {
      return await request(
        'manager',
        `${scope(branchId)}/${resource}?${new URLSearchParams({ page: '0', size: '8', ...filters })}`,
        pageSchema(managerSchemas[resource]) as z.ZodType<Page<ManagerRecord<K>>>,
      )
    } catch {
      const { managerDb } = await import('@/mocks/manager-engine')
      const { useSession } = await import('@/features/auth/session-store')
      const actor =
        useSession.getState().user || (await import('@/mocks/manager-fixtures')).managerUser
      return managerDb.list(
        actor,
        branchId,
        resource,
        new URLSearchParams(filters),
      ) as unknown as Page<ManagerRecord<K>>
    }
  },
  get: async <K extends ManagerResource>(
    branchId: string,
    resource: K,
    id: string,
  ): Promise<ManagerRecord<K>> => {
    if (resource === 'bookings' && provider('manager') === 'real')
      return bookingService.managerGet(id) as unknown as Promise<ManagerRecord<K>>
    if (resource === 'services' && provider('utilities') === 'real') {
      const item = await utilitiesService.catalog.get(id)
      return {
        id: item.id,
        branchId: item.branchId,
        code: item.code,
        name: item.name,
        unit: item.unit,
        type: item.serviceType,
        billingMethod: item.billingMethod,
        unitPrice: item.referencePrice,
        mandatory: item.mandatory,
        active: item.active,
      } as unknown as ManagerRecord<K>
    }
    if (provider('manager') === 'real' && resource === 'rooms')
      return request('manager', `/api/v1/rooms/${encodeURIComponent(id)}`, roomDto).then(
        async (r) => {
          const type = await request(
            'manager',
            `/api/v1/room-types/${encodeURIComponent(r.roomTypeId)}`,
            roomTypeDto,
          )
          return roomView(r, type.name)
        },
      ) as Promise<ManagerRecord<K>>
    if (provider('manager') === 'real' && resource === 'room-types')
      return request('manager', `/api/v1/room-types/${encodeURIComponent(id)}`, roomTypeDto).then(
        typeView,
      ) as Promise<ManagerRecord<K>>
    if (provider('manager') === 'real' && resource === 'slots')
      return request('manager', `/api/v1/room-slots/${encodeURIComponent(id)}`, slotDto).then(
        slotView,
      ) as Promise<ManagerRecord<K>>
    return request(
      'manager',
      `${scope(branchId)}/${resource}/${encodeURIComponent(id)}`,
      managerSchemas[resource] as unknown as z.ZodType<ManagerRecord<K>>,
    )
  },
  action: async (
    branchId: string,
    resource: ManagerResource,
    id: string | null,
    action: string,
    value: unknown,
    method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  ) => {
    if (resource === 'bookings' && provider('manager') === 'real' && id) {
      if (action === 'reconcile') {
        const v = value as { paymentId: string; successful: boolean; reason: string }
        return bookingService.reconcile(id, v.paymentId, v.successful, v.reason)
      }
      if (action === 'refund') return bookingService.approveRefund(id)
      return bookingService.review(id, value)
    }
    if (resource === 'services' && provider('utilities') === 'real') {
      if (method === 'DELETE' && id) {
        await utilitiesService.catalog.delete(id)
        return { id }
      }
      if (method === 'POST') {
        const v = value as {
          code: string
          name: string
          unit: string
          type: 'ELECTRICITY' | 'WATER' | 'INTERNET' | 'PARKING' | 'CLEANING' | 'SECURITY' | 'OTHER'
          billingMethod: 'METERED' | 'PER_PERSON' | 'PER_ROOM' | 'FIXED' | 'PER_USE'
          unitPrice: number
          mandatory?: boolean
        }
        const created = await utilitiesService.catalog.create(branchId, {
          code: v.code,
          name: v.name,
          unit: v.unit,
          serviceType: v.type,
          billingMethod: v.billingMethod,
          referencePrice: v.unitPrice,
          mandatory: v.mandatory ?? false,
        })
        return { id: created.id }
      }
      if (method === 'PATCH') {
        const v = value as {
          name?: string
          unit?: string
          billingMethod?: 'METERED' | 'PER_PERSON' | 'PER_ROOM' | 'FIXED' | 'PER_USE'
          unitPrice?: number
          active?: boolean
        }
        const updated = await utilitiesService.catalog.update(id!, {
          name: v.name,
          unit: v.unit,
          billingMethod: v.billingMethod,
          referencePrice: v.unitPrice,
          active: v.active,
        })
        return { id: updated.id }
      }
    }
    if (resource === 'room-services' && provider('utilities') === 'real') {
      if (method === 'POST') {
        const v = value as {
          roomId: string
          serviceId: string
          startDate: string
          endDate: string
          unitPrice: number
          billingConfig?: unknown
        }
        const created = await utilitiesService.roomServices.configure(branchId, v)
        return { id: created.id }
      }
      if (method === 'PATCH' && id) {
        const v = value as {
          endDate?: string
          unitPrice?: number
          billingConfig?: unknown
          status?: 'ACTIVE' | 'ENDED'
        }
        const updated = await utilitiesService.roomServices.update(id, v)
        return { id: updated.id }
      }
    }
    if (resource === 'service-requests' && provider('utilities') === 'real' && id) {
      const v = value as { decision: string; reason?: string }
      const decision =
        v.decision === 'approve'
          ? 'APPROVED'
          : v.decision === 'reject'
            ? 'REJECTED'
            : (v.decision as 'APPROVED' | 'REJECTED')
      const updated = await utilitiesService.contractServices.process(id, {
        decision,
        reason: v.reason,
      })
      return { id: updated.id }
    }
    if (resource === 'utility-charges' && provider('utilities') === 'real') {
      if (action === 'finalize') {
        const chargeIds = id ? [id] : (value as { chargeIds?: string[] })?.chargeIds || []
        await utilitiesService.charges.finalize(chargeIds)
        return null
      }
      if (method === 'POST') {
        const v = value as {
          serviceId?: string
          roomServiceId: string
          billingMonth: string
          startDate: string
          endDate: string
          segments?: {
            startDate?: string
            endDate?: string
            meterReference?: string
            reason?: Parameters<typeof utilitiesService.charges.create>[0]['segmentReason']
            previousReading?: number
            currentReading?: number
            quantity?: number
            unitPrice?: number
          }[]
        }
        const first = v.segments?.[0]
        const created = await utilitiesService.charges.create({
          roomServiceId: v.serviceId || v.roomServiceId,
          billingMonth: v.billingMonth,
          startDate: first?.startDate || v.startDate,
          endDate: first?.endDate || v.endDate,
          segmentNumber: 1,
          meterReference: first?.meterReference,
          segmentReason: first?.reason || 'NORMAL',
          startReading: first?.previousReading,
          endReading: first?.currentReading,
          quantity: first?.quantity,
          unitPrice: first?.unitPrice || 0,
        })
        return { id: created.id }
      }
    }
    if (resource === 'cost-allocations' && provider('utilities') === 'real' && id) {
      const v = value as { decision: 'APPROVED' | 'REJECTED'; reason?: string }
      const updated = await utilitiesService.costAllocation.process(id, v)
      return { id: updated.id }
    }
    if (provider('manager') === 'real' && ['rooms', 'room-types', 'slots'].includes(resource)) {
      const isRoom = resource === 'rooms',
        isType = resource === 'room-types'
      const path = isRoom
        ? `/api/v1/rooms${id ? `/${encodeURIComponent(id)}` : ''}`
        : isType
          ? `/api/v1/room-types${id ? `/${encodeURIComponent(id)}` : ''}`
          : `/api/v1/room-slots${id ? `/${encodeURIComponent(id)}` : ''}`
      if (method === 'DELETE') return request('manager', path, z.null(), write('DELETE'))
      const input = value as Record<string, unknown>
      const payload = isRoom
        ? roomPayload(input, branchId)
        : isType
          ? {
              branchId,
              code: input.code,
              typeName: input.name,
              defaultCapacity: input.defaultCapacity,
              description: input.description,
              active: input.active,
            }
          : {
              roomId: input.roomId,
              slotCode: input.code,
              slotName: input.name,
              status: input.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : input.operationalStatus,
            }
      if (isRoom)
        return request('manager', path, roomDto, write(id ? 'PUT' : 'POST', payload)).then(
          async (r) =>
            roomView(
              r,
              (
                await request(
                  'manager',
                  `/api/v1/room-types/${encodeURIComponent(r.roomTypeId)}`,
                  roomTypeDto,
                )
              ).name,
            ),
        )
      if (isType)
        return request('manager', path, roomTypeDto, write(id ? 'PUT' : 'POST', payload)).then(
          typeView,
        )
      return request('manager', path, slotDto, write(id ? 'PUT' : 'POST', payload)).then(slotView)
    }
    return request(
      'manager',
      `${scope(branchId)}/${resource}${id ? `/${encodeURIComponent(id)}` : ''}${action ? `/${action}` : ''}`,
      result,
      write(method, value),
    )
  },
  users: (branchId: string) =>
    request(
      'manager',
      `${scope(branchId)}/eligible-users`,
      z.array(
        z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          email: z.string(),
          phone: z.string().nullable(),
        }),
      ),
    ),
  sources: (branchId: string, tenancyId: string, month: string, invoiceId?: string) =>
    request(
      'manager',
      `${scope(branchId)}/invoice-sources?${new URLSearchParams({ contractTenantId: tenancyId, month, ...(invoiceId ? { invoiceId } : {}) })}`,
      invoiceSourcesSchema,
    ),
  summary: (branchId: string, month: string) =>
    request(
      'manager',
      `${scope(branchId)}/summary?month=${encodeURIComponent(month)}`,
      reportSummarySchema,
    ),
  zalo: (branchId: string, value: unknown) =>
    request(
      'manager',
      `${scope(branchId)}/settings/zalo`,
      branchAssignmentSchema,
      write('PUT', value),
    ),
  demo: (scenario: 'reset' | 'revoke', branchId: string) =>
    request(
      'manager',
      '/api/manager/demo/scenario',
      z.null(),
      write('POST', { scenario, branchId }),
    ),
}
