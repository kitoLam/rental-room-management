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
import { reportRequestService } from './report-request'
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
  branches: async () => {
    if (provider('manager') === 'mock') return request('manager', '/api/manager/branches', z.array(branchAssignmentSchema))
    const branches = await request('manager', '/api/v1/branches/managed', z.array(z.object({
      id: z.string(), ownerAccountId: z.string(), name: z.string(), address: z.string().nullable(), status: z.enum(['ACTIVE','INACTIVE']),
    })))
    return branches.map(branch => branchAssignmentSchema.parse({
      id: branch.id, ownerId: branch.ownerAccountId, name: branch.name, address: branch.address ?? '', status: branch.status,
      managerId: null, managerName: '', zaloUrl: null, zaloEnabled: false,
    }))
  },
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
    if (resource === 'maintenance') {
      if (provider('manager') === 'real') {
        try {
          const pageIndex = Number(filters.page || 0)
          const p = await reportRequestService.search(
            {
              branchId,
              status: (filters.status || undefined) as any,
              keyword: filters.q || undefined,
              page: pageIndex,
              size: 8,
            },
            'manager',
          )
          if (p && Array.isArray(p.content)) {
            const seen = new Set<string>()
            const deduped = p.content.filter((item) => {
              if (!item.id || seen.has(item.id)) return false
              seen.add(item.id)
              return true
            })
            const content = deduped.map((item) => ({
              id: item.id,
              contractTenantId: item.tenantId,
              roomId: item.roomId,
              roomName: 'Phòng ' + (item.roomId?.slice(0, 6) || ''),
              tenantName: 'Khách thuê',
              assetId: item.roomId,
              category: item.type as any,
              title: item.title,
              description: item.content,
              priority: (item.priority === 'MEDIUM' ? 'NORMAL' : item.priority) as any,
              attachments: (item.attachments || []).map((url, i) => ({
                id: `${item.id}-att-${i}`,
                name: `Ảnh ${i + 1}`,
                mime: 'image/jpeg' as const,
                size: 100000,
                url,
              })),
              assetName:
                item.type === 'FURNITURE'
                  ? 'Nội thất'
                  : item.type === 'SERVICE'
                    ? 'Dịch vụ'
                    : item.type === 'CONTRACT'
                      ? 'Hợp đồng'
                      : item.type === 'REPAIR'
                        ? 'Sửa chữa'
                        : item.type === 'MAINTENANCE'
                          ? 'Bảo trì'
                          : item.type === 'COMPLAINT'
                            ? 'Khiếu nại'
                            : 'Yêu cầu hỗ trợ',
              status: item.status as any,
              createdAt: item.createdAt,
              assignedTo: item.managerId ? 'Quản lý' : null,
              solutionResult: item.solutionResult,
              rejectReason: item.rejectReason,
              requestedInfoNote: item.requestedInfoNote,
              disputeReason: item.disputeReason,
              adminConclusion: item.adminConclusion,
              records: (item.timeline || []).map((rec) => ({
                id: rec.id,
                at: rec.createdAt,
                status: rec.statusTo || rec.action,
                description: rec.note || rec.action,
                performedBy: rec.actorName || rec.actorRole || 'Hệ thống',
                evidence: rec.attachments || [],
                cost: 0,
                responsibleParty: null,
                approvalStatus: null,
              })),
            }))
            return {
              content,
              number: p.number,
              size: p.size,
              totalElements: p.totalElements,
              totalPages: p.totalPages,
            } as unknown as Page<ManagerRecord<K>>
          }
        } catch (err) {
          console.warn('Real report-requests list failed, falling back to mock:', err)
        }
      }
      const { managerDb } = await import('@/mocks/manager-engine')
      const { useSession } = await import('@/features/auth/session-store')
      const actor =
        useSession.getState().user || (await import('@/mocks/manager-fixtures')).managerUser
      const rows = managerDb.list(
        actor,
        branchId,
        resource,
        new URLSearchParams(filters),
      )
      const page = Number(filters.page || 0)
      const size = Number(filters.size || 8)
      return {
        content: rows.slice(page * size, (page + 1) * size),
        number: page + 1,
        size,
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size) || 1,
      } as unknown as Page<ManagerRecord<K>>
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
      const rows = managerDb.list(
        actor,
        branchId,
        resource,
        new URLSearchParams(filters),
      )
      const page = Number(filters.page || 0)
      const size = Number(filters.size || 8)
      return {
        content: rows.slice(page * size, (page + 1) * size),
        number: page + 1,
        size,
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size) || 1,
      } as unknown as Page<ManagerRecord<K>>
    }
  },
  get: async <K extends ManagerResource>(
    branchId: string,
    resource: K,
    id: string,
  ): Promise<ManagerRecord<K>> => {
    if (resource === 'maintenance') {
      if (provider('manager') === 'real') {
        try {
          const item = await reportRequestService.getById(id)
          if (item) {
            return {
              id: item.id,
              contractTenantId: item.tenantId,
              roomId: item.roomId,
              roomName: 'Phòng ' + (item.roomId?.slice(0, 6) || ''),
              tenantName: 'Khách thuê',
              assetId: item.roomId,
              category: item.type as any,
              title: item.title,
              description: item.content,
              priority: (item.priority === 'MEDIUM' ? 'NORMAL' : item.priority) as any,
              attachments: (item.attachments || []).map((url, i) => ({
                id: `${item.id}-att-${i}`,
                name: `Ảnh ${i + 1}`,
                mime: 'image/jpeg' as const,
                size: 100000,
                url,
              })),
              assetName:
                item.type === 'FURNITURE'
                  ? 'Nội thất'
                  : item.type === 'SERVICE'
                    ? 'Dịch vụ'
                    : item.type === 'CONTRACT'
                      ? 'Hợp đồng'
                      : item.type === 'REPAIR'
                        ? 'Sửa chữa'
                        : item.type === 'MAINTENANCE'
                          ? 'Bảo trì'
                          : item.type === 'COMPLAINT'
                            ? 'Khiếu nại'
                            : 'Yêu cầu hỗ trợ',
              status: item.status as any,
              createdAt: item.createdAt,
              assignedTo: item.managerId ? 'Quản lý' : null,
              solutionResult: item.solutionResult,
              rejectReason: item.rejectReason,
              requestedInfoNote: item.requestedInfoNote,
              disputeReason: item.disputeReason,
              adminConclusion: item.adminConclusion,
              records: (item.timeline || []).map((rec) => ({
                id: rec.id,
                at: rec.createdAt,
                status: rec.statusTo || rec.action,
                description: rec.note || rec.action,
                performedBy: rec.actorName || rec.actorRole || 'Hệ thống',
                evidence: rec.attachments || [],
                cost: 0,
                responsibleParty: null,
                approvalStatus: null,
              })),
            } as unknown as ManagerRecord<K>
          }
        } catch (err) {
          console.warn('Real report-request getById failed, falling back to mock:', err)
        }
      }
      const { managerDb } = await import('@/mocks/manager-engine')
      const { useSession } = await import('@/features/auth/session-store')
      const actor =
        useSession.getState().user || (await import('@/mocks/manager-fixtures')).managerUser
      return managerDb.get(actor, branchId, resource, id) as unknown as ManagerRecord<K>
    }
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
    if (resource === 'maintenance' && provider('manager') === 'real' && id) {
      try {
        const v = (value || {}) as Record<string, any>
        const extractAttachments = (val: any): string[] => {
          if (!val) return []
          if (Array.isArray(val.attachments))
            return val.attachments.map((a: any) => (typeof a === 'string' ? a : a.url))
          if (Array.isArray(val.evidence))
            return val.evidence.map((a: any) => (typeof a === 'string' ? a : a.url))
          return []
        }
        const atts = extractAttachments(v)
        if (action === 'request-info') {
          const item = await reportRequestService.requestInfo(
            id,
            v.note || v.reason || 'Yêu cầu bổ sung thông tin',
          )
          return { id: item.id }
        }
        if (action === 'reject') {
          const item = await reportRequestService.reject(id, v.reason || 'Từ chối yêu cầu')
          return { id: item.id }
        }
        if (action === 'progress' || action === 'start' || action === 'record' || action === 'accept') {
          const note = v.progressNote || v.description || v.note || 'Cập nhật tiến độ xử lý'
          const item = await reportRequestService.updateProgress(id, note, atts)
          return { id: item.id }
        }
        if (action === 'resolve' || action === 'complete') {
          const solutionResult =
            v.solutionResult ||
            v.solutionNote ||
            v.description ||
            v.note ||
            'Đã xử lý và khắc phục xong'
          const item = await reportRequestService.resolve(id, solutionResult, atts)
          return { id: item.id }
        }
        if (action === 'reopen') {
          const item = await reportRequestService.reopen(
            id,
            v.reason || 'Mở lại yêu cầu để xử lý thêm',
          )
          return { id: item.id }
        }
        if (action === 'escalate-admin') {
          const item = await reportRequestService.escalateAdmin(
            id,
            v.disputeReason || v.reason || 'Chuyển Admin phân xử tranh chấp',
          )
          return { id: item.id }
        }
        if (action === 'admin-resolve') {
          const item = await reportRequestService.adminResolve(
            id,
            v.adminConclusion || v.resolutionNote || 'Admin đã giải quyết tranh chấp',
          )
          return { id: item.id }
        }
      } catch (err) {
        console.warn('Real report-request manager action failed, falling back to mock:', err)
      }
    }
    if (resource === 'maintenance' && id && action === 'start') {
      try {
        const { managerDb } = await import('@/mocks/manager-engine')
        const row = managerDb.tenant.state.reports.find((x) => x.id === id)
        if (row && (row.status === 'OPEN' || (row.status as string) === 'PENDING')) {
          row.status = 'ACCEPTED' as any
          row.assignedTo = 'Quản lý'
        }
      } catch {
        // ignore
      }
    }
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
