import { z } from 'zod'
import { vnDateKey } from '@/lib/activity'
import { request, write } from './http'
import { provider } from './config'
import { databaseIdSchema, pageSchema, type Page } from '@/interfaces/domain'
import {
  branchAssignmentSchema,
  managerSchemas,
  reportSummarySchema,
  invoiceSourcesSchema,
  invoiceInputSchema,
  type ManagerResource,
  type ManagerRecord,
  contractSchema,
  contractTenantSchema,
  eligibleContractTenantSchema,
} from '@/interfaces/manager'
import { utilitiesService } from './utilities'
import { bookingService, contractService } from './guest-user'
import { reportRequestService } from './report-request'
const scope = (branchId: string) => `/api/manager/branches/${encodeURIComponent(branchId)}`
const result = z.object({ id: z.string().uuid().optional() }).passthrough().nullable()
const roomDto = z.object({
  id: databaseIdSchema,
  branchId: databaseIdSchema,
  title: z.string().nullable().optional(),
  roomNumber: z.string(),
  floor: z.number().nullable(),
  area: z.number().nullable(),
  maxOccupants: z.number().nullable().optional(),
  listedRentPrice: z.number(),
  listedDepositAmount: z.number().nullable(),
  amenities: z.array(z.string()).nullable(),
  images: z.array(z.string()).nullable(),
  roomServiceIds: z.array(z.string()).nullish(),
  rules: z.string().nullable(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']),
})
const backendContractDto = z.object({
  id: z.string(), roomId: z.string(), roomSlotId: z.string().nullable().optional(), roomSlotIds: z.array(z.string()).optional(), bookingId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(), managerId: z.string().nullish(), contractNumber: z.string().nullable(), startDate: z.string().nullable(),
  endDate: z.string().nullable(), rentPrice: z.number().nullable().optional(), contractDepositAmount: z.number().nullable().optional(), paymentDueDay: z.number().nullable().optional(),
  terms: z.string().nullable(), status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
  tenantName: z.string().nullable(), signedFileUrl: z.string().nullable(), signedEvidenceUrl: z.string().nullable().optional(),
  termMonths: z.number().nullable().optional(), signedDate: z.string().nullable().optional(), firstBillingStartDate: z.string().nullable().optional(),
  evidenceSubmittedAt: z.string().nullable().optional(), evidenceDeadline: z.string().nullable().optional(), evidenceResubmissionCount: z.number().nullable().optional(), evidenceNote: z.string().nullable().optional(), contractUrl: z.string().nullable().optional(), generatedPdf: z.boolean().optional(),
  evidenceHistory: z.array(z.object({ action: z.string(), at: z.string(), note: z.string().nullish() })).nullish(),
  landlordName: z.string().nullable().optional(), landlordIdNumber: z.string().nullable().optional(), landlordAddress: z.string().nullable().optional(),
  tenantIdNumber: z.string().nullable().optional(), tenantAddress: z.string().nullable().optional(), roomAddress: z.string().nullable().optional(),
  roomName: z.string().nullish(),
  maxOccupants: z.number().nullable().optional(),
  expiringSoon: z.boolean().optional(), renewedFromContractId: z.string().nullable().optional(), renewedToContractId: z.string().nullable().optional(),
  services: z.array(z.object({ serviceId: z.string(), name: z.string(), unit: z.string().nullish().transform((v) => v ?? ''), unitPrice: z.number(), mandatory: z.boolean(), selected: z.boolean(), quantity: z.number().nullable().optional(), calculationType: z.string().nullable().optional() })).optional(),
}).passthrough()
function managerContract(value: z.infer<typeof backendContractDto>, branchId: string) {
  const historyLabels: Record<string, { actor: string; note: string }> = {
    SUBMITTED: { actor: 'Khách thuê', note: 'Đã nộp bản hợp đồng đã ký.' },
    APPROVED: { actor: 'Quản lý', note: 'Đã duyệt bản ký và kích hoạt hợp đồng.' },
    RESUBMISSION_REQUESTED: { actor: 'Quản lý', note: 'Yêu cầu nộp lại bản ký.' },
    EXPIRED: { actor: 'Hệ thống', note: 'Đã quá hạn nộp bản ký.' },
    CONTRACT_EXPIRED: { actor: 'Hệ thống', note: 'Hợp đồng đã hết hạn.' },
    CONTRACT_TERMINATED: { actor: 'Quản lý', note: 'Hợp đồng đã hủy trước hạn.' },
  }
  return contractSchema.parse({
    id: value.id, branchId, code: value.contractNumber, roomId: value.roomId, roomName: value.roomName ?? undefined,
    // Nháp chưa duyệt evidence không có ngày hiệu lực; giữ null để trang tự lấy ngày bắt đầu thuê từ booking gốc.
    startDate: value.startDate || null, endDate: value.endDate || null, terms: value.terms || '',
    landlordName: value.landlordName, landlordIdNumber: value.landlordIdNumber, landlordAddress: value.landlordAddress,
    tenantName: value.tenantName, tenantIdNumber: value.tenantIdNumber, tenantAddress: value.tenantAddress,
    roomAddress: value.roomAddress, paymentDueDay: value.paymentDueDay, rentPrice: value.rentPrice,
    contractDepositAmount: value.contractDepositAmount,
    maxOccupants: value.maxOccupants, services: value.services, roomSlotIds: value.roomSlotIds,
    signedEvidenceUrl: value.signedEvidenceUrl, termMonths: value.termMonths, signedDate: value.signedDate,
    firstBillingStartDate: value.firstBillingStartDate, evidenceSubmittedAt: value.evidenceSubmittedAt,
    evidenceDeadline: value.evidenceDeadline, evidenceResubmissionCount: value.evidenceResubmissionCount,
    evidenceNote: value.evidenceNote, contractUrl: value.contractUrl, generatedPdf: value.generatedPdf,
    expiringSoon: value.expiringSoon, renewedFromContractId: value.renewedFromContractId, renewedToContractId: value.renewedToContractId,
    signedFileUrl: value.signedFileUrl,
    rentalMode: 'SLOT', status: value.status === 'TERMINATED' ? 'CANCELLED' : value.status,
    sourceBookingId: value.bookingId || null, representativeName: value.tenantName, tenantCount: value.tenantId ? 1 : 0,
    history: (value.evidenceHistory ?? []).map((entry) => ({
      at: entry.at,
      actor: historyLabels[entry.action]?.actor ?? 'Hệ thống',
      note: entry.note ?? historyLabels[entry.action]?.note ?? entry.action,
    })),
  })
}
const slotDto = z.object({
  id: databaseIdSchema,
  roomId: databaseIdSchema,
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
function roomView(r: z.infer<typeof roomDto>) {
  const images = roomImageRefs(r.images).filter(
    (x): x is string => typeof x === 'string' && /^https?:\/\//.test(x),
  )
  const title = r.title?.trim() || `Phòng ${r.roomNumber}`
  return {
    id: r.id,
    code: r.roomNumber,
    title,
    branchId: r.branchId,
    branchName: '',
    address: '',
    areaKey: '',
    price: r.listedRentPrice,
    deposit: r.listedDepositAmount,
    capacity: r.maxOccupants ?? 0,
    sizeM2: r.area,
    availableSlots: null,
    floor: r.floor,
    rentalMode: 'SLOT',
    operationalStatus: r.status === 'MAINTENANCE' ? 'MAINTENANCE' : r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    status:
      r.status === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : r.status === 'INACTIVE'
          ? 'INACTIVE'
          : r.status === 'OCCUPIED' ? 'OCCUPIED' : 'AVAILABLE',
    isPublic: true,
    availability: null,
    occupiedResources: null,
    heldResources: null,
    imageUrl: images[0] || '',
    imageAlt: title,
    images,
    description: r.rules || '',
    amenities: r.amenities || [],
    roomServiceIds: r.roomServiceIds || [],
    services: [],
  }
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
    title: value.title,
    roomNumber: value.code,
    area: value.sizeM2,
    floor: value.floor,
    maxOccupants: value.capacity,
    listedRentPrice: value.price,
    listedDepositAmount: value.deposit ?? value.price,
    rules: value.description,
    amenities: value.amenities,
    images: value.images,
    roomServiceIds: value.roomServiceIds ?? [],
    status: value.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : value.operationalStatus,
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
  roomFilterOptions: async (branchId: string) => {
    const params = new URLSearchParams({ branchId, page: '0', size: '100' })
    const page = await request(
      'manager',
      `/api/v1/rooms?${params}`,
      z.object({
        content: z.array(z.object({ id: databaseIdSchema, roomNumber: z.string() }).passthrough()),
        number: z.number(),
        size: z.number(),
        totalElements: z.number(),
        totalPages: z.number(),
      }),
    )
    return {
      ...page,
      content: page.content.map(({ id, roomNumber }) => ({ id, code: roomNumber, title: roomNumber })),
    }
  },
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
      id: z.string(), ownerAccountId: z.string().nullable().optional(), name: z.string(), address: z.string().nullable(), status: z.string(),
    })))
    return branches.map(branch => branchAssignmentSchema.parse({
      id: branch.id, ownerId: branch.ownerAccountId || branch.id, name: branch.name || 'Chi nhánh', address: branch.address ?? '',
      status: (['DRAFT', 'ACTIVE', 'INACTIVE'].includes(branch.status) ? branch.status : 'ACTIVE') as any,
      managerId: null, managerName: '', zaloUrl: null, zaloEnabled: false,
    }))
  },
  list: async <K extends ManagerResource>(
    branchId: string,
    resource: K,
    filters: Record<string, string> = {},
  ): Promise<Page<ManagerRecord<K>>> => {
    if (resource === 'invoices' && filters.debtOnly === 'true' && provider('manager') === 'real') {
      const query = new URLSearchParams({
        branchId,
        page: String(Number(filters.page || 0) + 1),
        size: filters.size || '8',
      })
      if (filters.q) query.set('keyword', filters.q)
      if (filters.roomId) query.set('roomId', filters.roomId)
      if (filters.contractTenantId) query.set('contractTenantId', filters.contractTenantId)
      if (filters.financialStatus === 'OVERDUE') query.set('overdueOnly', 'true')
      const page = await request(
        'manager',
        `/api/v1/dashboard/debts?${query}`,
        pageSchema(
          z.object({
            invoiceId: z.string(),
            contractTenantId: z.string(),
            tenantName: z.string(),
            roomId: z.string(),
            roomNumber: z.string().nullable(),
            invoiceNumber: z.string().nullable(),
            period: z.string().nullable(),
            dueDate: z.string().nullable(),
            totalAmount: z.number(),
            remainingAmount: z.number(),
            status: z.enum(['UNPAID', 'PARTIAL', 'OVERDUE']),
            overdueDays: z.number().int().nonnegative(),
          }),
        ),
      )
      return {
        ...page,
        number: Math.max(0, page.number - 1),
        content: page.content.map((d) => ({
          id: d.invoiceId,
          contractTenantId: d.contractTenantId,
          tenantName: d.tenantName,
          roomId: d.roomId,
          roomName: d.roomNumber ? `Phòng ${d.roomNumber}` : '',
          code: d.invoiceNumber ?? '',
          billingMonth: d.period ?? '',
          dueDate: d.dueDate ?? '',
          totalAmount: d.totalAmount,
          outstanding: d.remainingAmount,
          financialStatus: d.status,
          overdueDays: d.overdueDays,
        })),
      } as unknown as Page<ManagerRecord<K>>
    }
    if (resource === 'bookings' && provider('manager') === 'real') {
      const result = await bookingService.managerList(filters.status || '', Number(filters.page || 0) + 1, filters)
      return result as unknown as Page<ManagerRecord<K>>
    }
    if (resource === 'contracts' && provider('manager') === 'real') {
      const query = new URLSearchParams({
        page: String(Number(filters.page || '0') + 1),
        size: filters.size || '8',
      })
      if (!filters.status) query.append('sort', 'status,asc')
      query.append('sort', 'createdAt,desc')
      query.append('sort', 'id,desc')
      if (filters.status) query.set('status', filters.status === 'ENDED' ? 'EXPIRED' : filters.status === 'CANCELLED' ? 'TERMINATED' : filters.status)
      if (filters.q) query.set('keyword', filters.q)
      const page = await request('manager', `/api/v1/contracts?${query}`, pageSchema(backendContractDto))
      return { ...page, number: Math.max(0, page.number - 1), content: page.content.map((item) => managerContract(item, branchId)) } as unknown as Page<ManagerRecord<K>>
    }
    if (resource === 'contract-tenants' && provider('manager') === 'real') {
      const query = new URLSearchParams({ page: filters.page || '0', size: filters.size || '8' })
      if (filters.contractId) query.set('contractId', filters.contractId)
      if (filters.status) query.set('status', filters.status)
      const page = await request('manager', `/api/v1/contract-tenants?${query}`, pageSchema(contractTenantSchema))
      return { ...page, number: Math.max(0, page.number - 1) } as unknown as Page<ManagerRecord<K>>
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
      // BE phân trang từ 1, FE từ 0; lọc / tìm kiếm thực hiện ở server.
      const res = await utilitiesService.serviceRequests.list({
        branchId,
        status: filters.status,
        action: filters.action,
        keyword: filters.q,
        page: Number(filters.page || 0) + 1,
        size: Number(filters.size || 8),
      })
      const items = filters.contractTenantId
        ? res.content.filter((item) => item.contractTenantId === filters.contractTenantId)
        : res.content
      const content = items.map((item) => ({
        id: item.id,
        serviceId: item.serviceId,
        contractTenantId: item.contractTenantId ?? '',
        roomId: item.roomId,
        tenantName: item.tenantName || 'Người thuê',
        roomName: item.slotCode ? `Chỗ ${item.slotCode}` : `Phòng ${item.roomNumber ?? ''}`,
        name: item.serviceName || 'Dịch vụ',
        mandatory: false,
        unit: item.scope === 'SLOT' ? 'chỗ' : 'phòng',
        unitPrice: item.unitPrice ?? 0,
        subscriptionId: item.subscriptionId ?? null,
        status: item.status,
        requestStatus: item.status,
        action: item.action,
        allowedActions: item.allowedActions,
        proposedDate: item.proposedDate,
        confirmedDate: item.confirmedDate ?? null,
        startDate: item.confirmedDate ?? item.proposedDate,
        endDate: null,
        note: item.note || '',
        history: item.history.map((h) => ({
          status: h.statusTo,
          at: h.at,
          note: h.note || '',
        })),
      }))
      return {
        content: content as unknown as ManagerRecord<K>[],
        number: res.number - 1,
        size: res.size,
        totalElements: res.totalElements,
        totalPages: res.totalPages,
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
    if (provider('manager') === 'real' && ['rooms', 'slots'].includes(resource)) {
      const page = Number(filters.page || 0),
        size = Number(filters.size || 8)
      if (resource === 'rooms') {
        const params = new URLSearchParams({ branchId, page: String(page), size: String(size) })
        if (filters.minPrice) params.set('minPrice', filters.minPrice)
        if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
        if (filters.capacity) params.set('minCapacity', filters.capacity)
        if (filters.q) params.set('keyword', filters.q)
        if (filters.operationalStatus)
          params.set(
            'status',
            filters.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : filters.operationalStatus,
          )
        return request('manager', `/api/v1/rooms?${params}`, apiPage(roomDto)).then((p) =>
          normalizePage({ ...p, content: p.content.map(roomView) }),
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
    if (resource === 'payments' && provider('manager') === 'real') {
      const query = new URLSearchParams({ page: String(Number(filters.page || 0) + 1), size: filters.size || '8' })
      if (filters.status) {
        const backendStatus =
          filters.status === 'VERIFIED'
            ? 'SUCCESS'
            : filters.status === 'REVIEW'
              ? 'LATE_PAID'
              : filters.status
        query.set('status', backendStatus)
      }
      if (filters.keyword || filters.q) query.set('keyword', filters.keyword || filters.q)
      if (filters.contractTenantId) query.set('contractTenantId', filters.contractTenantId)
      if (filters.invoiceId) query.set('invoiceId', filters.invoiceId)
      if (filters.method) query.set('method', filters.method)
      if (filters.date) query.set('date', filters.date)
      const paymentPageSchema = z.object({
        content: z.array(z.object({
          id: z.string(),
          invoiceId: z.string().nullable(),
          contractTenantId: z.string().nullable(),
          amount: z.number(),
          method: z.string().nullable(),
          transactionCode: z.string().nullable(),
          paidAt: z.string().nullable(),
          status: z.string(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
        })),
        number: z.number(),
        size: z.number(),
        totalElements: z.number(),
        totalPages: z.number(),
      })
      const page = await request('manager', `/api/v1/payments?${query}`, paymentPageSchema)
      let content = page.content.map((p) => ({
        id: p.id,
        branchId,
        reference: p.transactionCode || p.id.slice(0, 8),
        targetType: 'INVOICE' as const,
        invoiceId: p.invoiceId,
        bookingId: null,
        contractTenantId: p.contractTenantId,
        payerName: 'Người thanh toán',
        tenantName: 'Người thuê',
        amountReceived: p.amount,
        allocatedAmount: p.amount,
        environment: 'PRODUCTION' as const,
        method: p.method || 'VNPAY',
        status: p.status === 'SUCCESS' ? 'VERIFIED' as const : p.status === 'FAILED' ? 'FAILED' as const : p.status === 'LATE_PAID' ? 'REVIEW' as const : 'PENDING' as const,
        createdAt: p.createdAt || new Date(0).toISOString(),
        verifiedAt: p.paidAt,
        providerTransactionId: p.transactionCode,
        evidence: [],
        note: '',
        history: [],
      }))
      if (filters.date) {
        content = content.filter((p) => vnDateKey(p.createdAt) === filters.date || vnDateKey(p.verifiedAt) === filters.date)
      }
      return {
        content,
        number: Math.max(0, page.number - 1),
        size: page.size,
        totalElements: page.totalElements,
        totalPages: page.totalPages,
      } as unknown as Page<ManagerRecord<K>>
    }
        if (resource === 'maintenance') {
      if (provider('manager') === 'real') {
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
        const seen = new Set<string>()
        const deduped = (p.content || []).filter((item) => {
          if (!item.id || seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        const content = deduped.map((item) => ({
          id: item.id,
          contractTenantId: item.tenantId,
          roomId: item.roomId,
          roomName: item.roomName ? `${item.roomName}${item.slotName ? ` - ${item.slotName}` : ''}` : `P.${(item.roomId || '').slice(-4).toUpperCase()}`,
          tenantName: item.tenantName || 'Khách thuê',
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
              assignedTo: item.assigneeName
                ? item.assigneePhone
                  ? `${item.assigneeName} (${item.assigneePhone})`
                  : item.assigneeName
                : item.managerId
                  ? 'Quản lý phụ trách'
                  : null,
              solutionResult: item.solutionResult,
              rejectReason: item.rejectReason,
              requestedInfoNote: item.requestedInfoNote,
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
      // Mock fallback: read directly from tenantDb to avoid scope/permission
      // checks in managerDb.list() which fail when actor is a real backend user
      // (their id won't be in mock db.state.users) or branchId is a real UUID.
      const { tenantDb } = await import('@/mocks/tenant-engine')
      const stMap: Record<string, string> = {
        OPEN: 'PENDING',
        ACCEPTED: 'IN_PROGRESS',
        COMPLETED: 'RESOLVED',
      }
      const assetNameMap: Record<string, string> = {
        FURNITURE: 'Nội thất',
        SERVICE: 'Dịch vụ',
        CONTRACT: 'Hợp đồng',
        REPAIR: 'Sửa chữa',
        MAINTENANCE: 'Bảo trì',
        COMPLAINT: 'Khiếu nại',
      }
      const page = Number(filters.page || 0)
      const size = Number(filters.size || 8)
      const statusFilter = filters.status || ''
      const qFilter = (filters.q || '').toLowerCase()
      const allRows = tenantDb.state.reports.map((r: any) => {
        const t =
          tenantDb.state.tenancies.find((x) => x.id === r.contractTenantId) ||
          tenantDb.state.tenancies[0]
        const mappedStatus = stMap[r.status] || r.status || 'PENDING'
        return {
          id: r.id,
          contractTenantId: r.contractTenantId,
          roomId: t?.roomId || r.roomId || r.assetId || '',
          roomName: t?.roomName || 'Phòng trọ',
          tenantName: t
            ? (tenantDb as any).db?.state?.users?.find?.((u: any) => u.id === t.userId)?.fullName || 'Khách thuê'
            : 'Khách thuê',
          assetId: r.assetId || '',
          category: r.category || 'REPAIR',
          assetName: assetNameMap[r.category] || 'Yêu cầu hỗ trợ',
          title: r.title || '',
          description: r.description || r.content || '',
          priority: r.priority === 'NORMAL' ? 'NORMAL' : (r.priority || 'NORMAL'),
          attachments: (r.attachments || []).map((a: any, i: number) => ({
            id: `${r.id}-att-${i}`,
            name: `Ảnh ${i + 1}`,
            mime: 'image/jpeg' as const,
            size: 100000,
            url: typeof a === 'string' ? a : a?.url || '',
          })),
          status: mappedStatus,
          createdAt: r.createdAt || new Date().toISOString(),
          assignedTo: r.assignedTo || null,
          solutionResult: r.solutionResult || null,
          rejectReason: r.rejectReason || null,
          requestedInfoNote: r.requestedInfoNote || null,
          records: (r.records || []).map((rec: any) => ({
            id: rec.id || crypto.randomUUID(),
            at: rec.at || new Date().toISOString(),
            status: stMap[rec.status] || rec.status || 'PENDING',
            description: rec.description || '',
            performedBy: rec.performedBy || 'Hệ thống',
            evidence: rec.evidence || [],
            cost: rec.cost || 0,
            responsibleParty: rec.responsibleParty || null,
            approvalStatus: rec.approvalStatus || null,
          })),
        }
      })
      const filtered = allRows.filter((row) => {
        if (statusFilter && row.status !== statusFilter) return false
        if (qFilter && !JSON.stringify(row).toLowerCase().includes(qFilter)) return false
        return true
      })
      return {
        content: filtered.slice(page * size, (page + 1) * size),
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size) || 1,
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
    if (resource === 'payments' && provider('manager') === 'real') {
      const paymentDetailSchema = z.object({
        id: z.string(),
        invoiceId: z.string().nullable(),
        contractTenantId: z.string().nullable(),
        bookingId: z.string().nullable().optional(),
        amount: z.number(),
        method: z.string().nullable(),
        transactionCode: z.string().nullable(),
        gatewayTransactionNo: z.string().nullable().optional(),
        paidAt: z.string().nullable(),
        status: z.string(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
      })
      const p = await request('manager', `/api/v1/payments/${encodeURIComponent(id)}`, paymentDetailSchema)
      return {
        id: p.id,
        branchId,
        reference: p.transactionCode || p.id.slice(0, 8),
        targetType: 'INVOICE' as const,
        invoiceId: p.invoiceId,
        bookingId: p.bookingId || null,
        contractTenantId: p.contractTenantId,
        payerName: 'Người thanh toán',
        tenantName: 'Người thuê',
        amountReceived: p.amount,
        allocatedAmount: p.amount,
        environment: 'PRODUCTION' as const,
        method: p.method || 'VNPAY',
        status: p.status === 'SUCCESS' ? 'VERIFIED' as const : p.status === 'FAILED' ? 'FAILED' as const : p.status === 'LATE_PAID' ? 'REVIEW' as const : 'PENDING' as const,
        createdAt: p.createdAt || new Date(0).toISOString(),
        verifiedAt: p.paidAt,
        providerTransactionId: p.gatewayTransactionNo || p.transactionCode,
        evidence: [],
        note: '',
        history: [],
      } as unknown as ManagerRecord<K>
    }
        if (resource === 'maintenance') {
      if (provider('manager') === 'real') {
        const item = await reportRequestService.getById(id, 'manager')
        return {
          id: item.id,
          contractTenantId: item.tenantId || '',
          roomId: item.roomId || '',
          roomName: item.roomName ? `${item.roomName}${item.slotName ? ` - ${item.slotName}` : ''}` : `P.${(item.roomId || '').slice(-4).toUpperCase()}`,
          tenantName: item.tenantName || 'Khách thuê',
          assetId: item.roomId || '',
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
              assignedTo: item.assigneeName
                ? item.assigneePhone
                  ? `${item.assigneeName} (${item.assigneePhone})`
                  : item.assigneeName
                : item.managerId
                  ? 'Quản lý phụ trách'
                  : null,
              solutionResult: item.solutionResult,
              rejectReason: item.rejectReason,
              requestedInfoNote: item.requestedInfoNote,
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
      const { tenantDb } = await import('@/mocks/tenant-engine')
      const r: any = tenantDb.state.reports.find((x) => x.id === id)
      if (r) {
        const stMap: Record<string, string> = {
          OPEN: 'PENDING',
          ACCEPTED: 'IN_PROGRESS',
          COMPLETED: 'RESOLVED',
        }
        const assetNameMap: Record<string, string> = {
          FURNITURE: 'Nội thất',
          SERVICE: 'Dịch vụ',
          CONTRACT: 'Hợp đồng',
          REPAIR: 'Sửa chữa',
          MAINTENANCE: 'Bảo trì',
          COMPLAINT: 'Khiếu nại',
        }
        const t =
          tenantDb.state.tenancies.find((x) => x.id === r.contractTenantId) ||
          tenantDb.state.tenancies[0]
        return {
          id: r.id,
          contractTenantId: r.contractTenantId || t?.id || '',
          roomId: t?.roomId || r.roomId || r.assetId || '',
          roomName: t?.roomName || 'Phòng trọ',
          tenantName: 'Khách thuê',
          assetId: r.assetId || '',
          category: r.category || 'REPAIR',
          assetName: r.assetName || assetNameMap[r.category] || 'Yêu cầu hỗ trợ',
          title: r.title || '',
          description: r.description || r.content || '',
          priority: r.priority === 'MEDIUM' ? 'NORMAL' : (r.priority || 'NORMAL'),
          attachments: (r.attachments || []).map((a: any, i: number) => ({
            id: `${r.id}-att-${i}`,
            name: `Ảnh ${i + 1}`,
            mime: 'image/jpeg' as const,
            size: 100000,
            url: typeof a === 'string' ? a : a?.url || '',
          })),
          status: stMap[r.status] || r.status || 'PENDING',
          createdAt: r.createdAt || new Date().toISOString(),
          assignedTo: r.assignedTo || null,
          solutionResult: r.solutionResult || null,
          rejectReason: r.rejectReason || null,
          requestedInfoNote: r.requestedInfoNote || null,
          records: (r.records || []).map((rec: any) => ({
            id: rec.id || crypto.randomUUID(),
            at: rec.at || new Date().toISOString(),
            status: stMap[rec.status] || rec.status || 'PENDING',
            description: rec.description || '',
            performedBy: rec.performedBy || 'Hệ thống',
            evidence: rec.evidence || [],
            cost: rec.cost || 0,
            responsibleParty: rec.responsibleParty || null,
            approvalStatus: rec.approvalStatus || null,
          })),
        } as unknown as ManagerRecord<K>
      }
      const { managerDb } = await import('@/mocks/manager-engine')
      const { useSession } = await import('@/features/auth/session-store')
      const actor =
        useSession.getState().user || (await import('@/mocks/manager-fixtures')).managerUser
      return managerDb.get(actor, branchId, resource, id) as unknown as ManagerRecord<K>
    }
    if (resource === 'bookings' && provider('manager') === 'real')
      return bookingService.managerGet(id) as unknown as Promise<ManagerRecord<K>>
    if (resource === 'contracts' && provider('manager') === 'real') {
      const item = await request('manager', `/api/v1/contracts/${encodeURIComponent(id)}`, backendContractDto)
      return managerContract(item, branchId) as unknown as ManagerRecord<K>
    }
    if (resource === 'contract-tenants' && provider('manager') === 'real')
      return request('manager', `/api/v1/contract-tenants/${encodeURIComponent(id)}`, contractTenantSchema) as Promise<ManagerRecord<K>>
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
        roomView,
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
    if (resource === 'contract-tenants' && provider('manager') === 'real') {
      const path = `/api/v1/contract-tenants${id ? `/${encodeURIComponent(id)}` : ''}`
      if (method === 'DELETE')
        return request('manager', path, z.null(), write(method, value)).then(() => null)
      return request('manager', path, contractTenantSchema, write(method, value))
    }
    if (resource === 'maintenance' && provider('manager') === 'real' && id) {
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
        if (action === 'start' || action === 'accept') {
          // Tiếp nhận yêu cầu và bắt đầu xử lý kèm gán người phụ trách
          const item = await reportRequestService.startProcessing(id, {
            assigneeName: v.assigneeName || undefined,
            assigneePhone: v.assigneePhone || undefined,
            managerId: v.managerId || undefined,
          })
          return { id: item.id }
        }
        if (action === 'assign') {
          const item = await reportRequestService.assign(id, {
            assigneeName: v.assigneeName || 'Quản lý phụ trách',
            assigneePhone: v.assigneePhone || undefined,
            managerId: v.managerId || undefined,
          })
          return { id: item.id }
        }
        if (action === 'progress' || action === 'record') {
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
          [],
          'manager',
        )
        return { id: item.id }
      }
      throw new Error('Thao tác yêu cầu hỗ trợ không được hỗ trợ.')
    }
    if (resource === 'maintenance' && id) {
      // Mock fallback for all maintenance actions (when real API is unavailable)
      try {
        const { managerDb } = await import('@/mocks/manager-engine')
        const { useSession } = await import('@/features/auth/session-store')
        const actor =
          useSession.getState().user || (await import('@/mocks/manager-fixtures')).managerUser
        const { operationsAction } = await import('@/mocks/manager-operations')
        operationsAction(managerDb, actor, branchId, resource, id, action, value, method)
        managerDb.save()
        return { id }
      } catch (mockErr: any) {
        if (mockErr?.status !== undefined) throw mockErr // MockError — rethrow
        // Soft errors (e.g. action not found in mock) — ignore, return id
        return { id }
      }
    }
    if (resource === 'bookings' && provider('manager') === 'real' && id) {
      if (action === 'reconcile') {
        const v = value as { paymentId: string; successful: boolean; reason: string }
        return bookingService.reconcile(id, v.paymentId, v.successful, v.reason)
      }
      if (action === 'cancel') return bookingService.managerCancel(id)
      if (action === 'refund') return bookingService.approveRefund(id)
      return bookingService.review(id, value)
    }
    if (resource === 'contracts' && provider('manager') === 'real' && id && action === 'check-in') {
      const v = value as { signedFileUrl: string }
      return contractService.completeCheckIn(id, v.signedFileUrl)
    }
    if (resource === 'contracts' && provider('manager') === 'real' && id && action === 'review-evidence')
      return contractService.reviewEvidence(id, value as { approved: boolean; note?: string; firstBillingStartDate?: string })
    if (resource === 'contracts' && provider('manager') === 'real' && id && action === 'renew')
      return contractService.renewContract(id, value as { termMonths: number })
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
      const v = value as { decision: string; reason?: string; effectiveDate?: string }
      const note = v.reason?.trim() || undefined
      const api = utilitiesService.serviceRequests
      const updated =
        v.decision === 'approve'
          ? await api.approve(id, note)
          : v.decision === 'reject'
            ? await api.reject(id, note ?? '')
            : v.decision === 'confirm-installation'
              ? await api.confirmInstallation(id, { effectiveDate: v.effectiveDate ?? '', note })
              : await api.confirmTermination(id, { effectiveDate: v.effectiveDate ?? '', note })
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
    if (provider('manager') === 'real' && ['rooms', 'slots'].includes(resource)) {
      const isRoom = resource === 'rooms'
      const path = isRoom
        ? `/api/v1/rooms${id ? `/${encodeURIComponent(id)}` : ''}`
        : `/api/v1/room-slots${id ? `/${encodeURIComponent(id)}` : ''}`
      if (method === 'DELETE') return request('manager', path, z.null(), write('DELETE'))
      const input = value as Record<string, unknown>
      const payload = isRoom
        ? roomPayload(input, branchId)
        : {
              roomId: input.roomId,
              slotCode: input.code,
              slotName: input.name,
              status: input.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : input.operationalStatus,
            }
      if (isRoom)
        return request('manager', path, roomDto, write(id ? 'PATCH' : 'POST', payload)).then(roomView)
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
  eligibleContractTenants: (contractId: string) =>
    request(
      'manager',
      `/api/v1/contract-tenants/eligible?contractId=${encodeURIComponent(contractId)}`,
      z.array(eligibleContractTenantSchema),
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
