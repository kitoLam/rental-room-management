import { z } from 'zod'
import { request, write } from './http'
import { pageSchema } from '@/interfaces/domain'
import {
  tenancySchema,
  tenantRoomSchema,
  invoiceSchema,
  tenantPaymentSchema,
  serviceSchema,
  chargeSchema,
  proposalSchema,
  tenantContractSchema,
  type ReportInput,
  type MaintenanceReport,
  type TenantService,
} from '@/interfaces/tenant'

import { provider } from './config'
import { utilitiesService } from './utilities'
import { reportRequestService } from './report-request'
import { formatReportAssignee, type ReportRequestItem } from '@/interfaces/report-request'
import type {
  CreateCostAllocationProposalInput,
} from '@/interfaces/utilities'

function adaptReportRequest(item: ReportRequestItem, tenancyId?: string): MaintenanceReport {
  const assetNameMap: Record<string, string> = {
    REPAIR: 'Sửa chữa',
    MAINTENANCE: 'Bảo trì',
    COMPLAINT: 'Khiếu nại',
    FURNITURE: 'Nội thất',
    SERVICE: 'Dịch vụ',
    CONTRACT: 'Gia hạn / Hợp đồng',
    OTHER: 'Yêu cầu hỗ trợ',
  }
  return {
    id: item.id,
    contractTenantId: tenancyId || item.tenantId,
    assetId: item.roomId,
    category: item.type as any,
    title: item.title,
    description: item.content,
    priority: (item.priority === 'MEDIUM' ? 'NORMAL' : item.priority) as any,
    attachments: (item.attachments || []).map((url, i) => ({
      id: `${item.id}-att-${i}`,
      name: `Ảnh ${i + 1}`,
      mime: 'image/jpeg',
      size: 100000,
      url,
    })),
    assetName: assetNameMap[item.type] || item.type,
    status: item.status as any,
    createdAt: item.createdAt,
    assignedTo: formatReportAssignee(item),
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
  }
}

const path = (id: string, resource: string) =>
  `/api/tenant/tenancies/${encodeURIComponent(id)}/${resource}`

export type ServiceRegistrationValue = {
  serviceId: string
  proposedDate: string
  note: string
  contractEndDate: string
}
// subscriptionId dùng cho API thật; serviceId (id danh mục) dùng cho mock engine.
export type ServiceStopValue = { serviceId: string; subscriptionId: string; proposedDate: string; note: string }

function contractToTenancy(
  c: z.infer<typeof tenantContractSchema>,
  userId?: string,
  resolvedSlotName?: string | null,
) {
  const parts = (c.roomAddress || '').split(' · ')
  const branchName = parts.length > 1 ? parts[0] : c.roomAddress || 'Chi nhánh đang thuê'
  const roomName =
    parts.length > 1
      ? (() => {
          const r = parts.slice(1).join(' · ').trim()
          return r.startsWith('P.') || r.startsWith('Phòng') ? r : `P.${r}`
        })()
      : `P.${c.roomId.slice(-4).toUpperCase()}`
  const rent = Math.max(0, Math.round(c.rentPrice || 0))
  const deposit = Math.max(0, Math.round(c.contractDepositAmount || rent))
  const status =
    c.status === 'ACTIVE'
      ? ('ACTIVE' as const)
      : c.status === 'DRAFT'
        ? ('DRAFT' as const)
        : c.status === 'EXPIRED'
          ? ('LEFT' as const)
          : ('CANCELLED' as const)
  const contractStatus =
    c.status === 'ACTIVE'
      ? ('ACTIVE' as const)
      : c.status === 'DRAFT'
        ? ('DRAFT' as const)
        : c.status === 'EXPIRED'
          ? ('ENDED' as const)
          : ('CANCELLED' as const)
  const today = new Date().toISOString().slice(0, 10)
  const defaultEnd = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
  return tenancySchema.parse({
    id: c.id,
    userId: userId || c.tenantId || c.id,
    contractId: c.id,
    branchId: c.roomId,
    roomId: c.roomId,
    roomSlotId: c.roomSlotId || null,
    branchName,
    roomName,
    slotName:
      resolvedSlotName !== undefined
        ? resolvedSlotName
        : c.roomSlotId
          ? `Slot ${c.roomSlotId.slice(-4).toUpperCase()}`
          : null,
    rentalMode: c.roomSlotId ? 'SLOT' : 'ROOM',
    status,
    contractStatus,
    code: c.contractNumber,
    role: 'REPRESENTATIVE',
    startDate: c.startDate || today,
    endDate: c.endDate || defaultEnd,
    actualLeaveDate: null,
    monthlyRent: rent,
    firstMonthRent: rent,
    lastMonthRent: rent,
    prepaidFirstRequired: rent,
    prepaidLastRequired: deposit,
    terms: c.terms || 'Theo quy định hợp đồng thuê phòng.',
    sharedTerms: c.terms || 'Theo nội quy chung của khu trọ.',
    document: c.signedFileUrl
      ? {
          name: `Hợp đồng ${c.contractNumber}`,
          url: c.signedFileUrl,
          issuedAt: c.signedDate || today,
        }
      : null,
  })
}

export const tenantApi = {
  manualPay: (id: string, invoiceId: string, value: unknown) => request('tenant', path(id, `invoices/${encodeURIComponent(invoiceId)}/manual-payments`), tenantPaymentSchema, write('POST', value)),
  prepay: (id: string, value: unknown) =>
    request('tenant', path(id, 'prepaid-payments'), tenantPaymentSchema, write('POST', value)),
  tenancies: async () => {
    if (provider('tenant') === 'mock') {
      try {
        return await request('tenant', '/api/tenant/tenancies', z.array(tenancySchema))
      } catch {
        const { tenantDb } = await import('@/mocks/tenant-engine')
        const { useSession } = await import('@/features/auth/session-store')
        const user = useSession.getState().user
        return user ? tenantDb.state.tenancies.filter((t) => t.userId === user.id) : []
      }
    }
    const { useSession } = await import('@/features/auth/session-store')
    const user = useSession.getState().user
    if (!user) return []
    if (
      !user.roles.includes('TENANT') &&
      user.roles.some((r) => r === 'MANAGER' || r === 'OWNER' || r === 'ADMIN')
    ) {
      return []
    }
    try {
      const page = await request(
        'leasing',
        '/api/v1/contracts?page=0&size=100',
        pageSchema(tenantContractSchema),
      )
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const activeList = (page.content || [])
        .filter(
          (c) =>
            c.status === 'ACTIVE' &&
            !(c.contractNumber || '').toUpperCase().startsWith('TMP-') &&
            (!c.startDate || c.startDate <= today) &&
            (!c.endDate || c.endDate >= today),
        )
        .sort((a, b) => {
          const startCmp = (b.startDate || '').localeCompare(a.startDate || '')
          if (startCmp !== 0) return startCmp
          return (b.contractNumber || '').localeCompare(a.contractNumber || '')
        })
      const byRoom = new Map<string, (typeof activeList)[number]>()
      for (const c of activeList) {
        const roomKey = c.roomId || c.id
        if (!byRoom.has(roomKey)) {
          byRoom.set(roomKey, c)
        }
      }
      const contracts =
        byRoom.size > 0
          ? Array.from(byRoom.values())
          : (page.content || []).filter((c) => c.status === 'ACTIVE').slice(0, 1)
      const { roomSlotService } = await import('./guest-user')
      return await Promise.all(
        contracts.map(async (c) => {
          let resolvedSlot: string | null | undefined = undefined
          const slotIds = c.roomSlotId ? [c.roomSlotId] : c.roomSlotIds?.length ? [c.roomSlotIds[0]] : []
          if (c.roomId && slotIds.length > 0) {
            try {
              const slotsPage = await roomSlotService.list(c.roomId)
              const codes = slotIds
                .map((sid) => slotsPage.content.find((s) => s.id === sid)?.slotCode)
                .filter((code): code is string => Boolean(code))
              if (codes.length > 0) {
                resolvedSlot = codes
                  .map((code) => (code.includes('-') ? code.split('-').at(-1)!.trim() : code.trim()))
                  .join(', ')
              }
            } catch {
              // ignore slot lookup error
            }
          }
          return contractToTenancy(c, user.id, resolvedSlot)
        }),
      )
    } catch {
      const { tenantDb } = await import('@/mocks/tenant-engine')
      return tenantDb.state.tenancies.filter((t) => t.userId === user.id)
    }
  },
  contracts: async () => {
    if (provider('leasing') === 'real') {
      const page = await request(
        'leasing',
        '/api/v1/contracts?page=0&size=100',
        pageSchema(tenantContractSchema),
      )
      return page.content
    }
    return tenantApi.tenancies()
  },
  room: async (id: string) => {
    if (provider('tenant') === 'mock') {
      try {
        return await request('tenant', path(id, 'room'), tenantRoomSchema)
      } catch {
        const { tenantDb } = await import('@/mocks/tenant-engine')
        const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
        return tenantDb.room(t)
      }
    }
    const tenancies = await tenantApi.tenancies()
    const t = tenancies.find((x) => x.id === id || x.contractId === id) || tenancies[0]
    if (!t) {
      throw new Error('Tài khoản chưa có phòng đang thuê.')
    }
    let contractServices: { id: string; name: string; category: 'SERVICE'; condition: string }[] = []
    try {
      const c = await request(
        'leasing',
        `/api/v1/contracts/${encodeURIComponent(t.contractId)}`,
        tenantContractSchema,
      )
      contractServices = (c.services || [])
        .filter((s) => s.selected)
        .map((s) => ({
          id: s.serviceId,
          name: s.name,
          category: 'SERVICE' as const,
          condition: 'Đang sử dụng',
        }))
    } catch {
      // ignore
    }
    return {
      tenancy: t,
      images: ['/demo/room-1.webp', '/demo/room-2.webp', '/demo/room-3.webp'],
      area: 25,
      floor: 2,
      roomType: 'Phòng tiêu chuẩn',
      amenities: ['Điều hòa', 'Nóng lạnh', 'Tủ quần áo', 'Giường nệm', 'Wifi'],
      rules: ['Yên tĩnh sau 22 giờ', 'Không hút thuốc trong phòng', 'Giữ sạch khu vực chung'],
      manager: { name: 'Bộ phận quản lý chi nhánh', phone: '0900000999' },
      zaloUrl: null,
      assets: [
        { id: t.roomId, name: 'Thiết bị nội thất trong phòng', category: 'FURNITURE' as const, condition: 'Đang sử dụng' },
        ...contractServices,
      ],
    }
  },
  contract: (id: string, contractId: string) =>
    provider('leasing') === 'real'
      ? request('leasing', `/api/v1/contracts/${encodeURIComponent(contractId)}`, tenantContractSchema)
      : request('tenant', path(id, `contracts/${encodeURIComponent(contractId)}`), tenancySchema),
  invoices: (id: string) => request('tenant', path(id, 'invoices'), z.array(invoiceSchema)),
  invoice: (id: string, invoiceId: string) =>
    request('tenant', path(id, `invoices/${encodeURIComponent(invoiceId)}`), invoiceSchema),
  payments: (id: string) => request('tenant', path(id, 'payments'), z.array(tenantPaymentSchema)),
  payment: (id: string, paymentId: string) =>
    request('tenant', path(id, `payments/${encodeURIComponent(paymentId)}`), tenantPaymentSchema),
  pay: (id: string, invoiceId: string, value: unknown) =>
    request(
      'tenant',
      path(id, `invoices/${encodeURIComponent(invoiceId)}/payments`),
      tenantPaymentSchema,
      write('POST', value),
    ),
  services: async (id: string): Promise<TenantService[]> => {
    if (provider('utilities') === 'real') {
      // BE tự xác định phòng / chỗ của người thuê từ token, FE không gửi roomId / contractId.
      // Catalog của service-requests chỉ có dịch vụ đăng ký được; dịch vụ bắt buộc lấy từ danh mục công khai để hiển thị.
      const [items, publicItems] = await Promise.all([
        utilitiesService.serviceRequests.catalog(),
        request(
          'catalog',
          '/api/v1/public/services?serviceScope=SLOT',
          z.array(z.object({ id: z.string(), name: z.string(), unit: z.string(), unitPrice: z.coerce.number(), mandatory: z.boolean() })),
        ),
      ])
      const mandatory: TenantService[] = publicItems.filter((s) => s.mandatory).map((s) => ({
        id: s.id,
        name: s.name,
        mandatory: true,
        unit: s.unit,
        unitPrice: s.unitPrice,
        subscriptionId: null,
        requestId: null,
        status: null,
        allowedActions: [],
        startDate: null,
        endDate: null,
        note: '',
        history: [],
      }))
      return [...mandatory, ...items.map((s) => ({
        id: s.serviceId,
        name: s.name,
        mandatory: false,
        unit: s.unit,
        unitPrice: s.subscription?.unitPrice ?? s.unitPrice,
        subscriptionId: s.subscription?.id ?? null,
        requestId: s.openRequest?.id ?? null,
        status: s.displayStatus,
        allowedActions: s.allowedActions,
        startDate: s.subscription?.startDate ?? s.openRequest?.proposedDate ?? null,
        endDate: s.subscription?.endDate ?? null,
        note: '',
        history: [],
      }))]
    }
    return request('tenant', path(id, 'services'), z.array(serviceSchema))
  },
  registerService: async (id: string, value: ServiceRegistrationValue) => {
    if (provider('utilities') === 'real') {
      return utilitiesService.serviceRequests.register({
        serviceId: value.serviceId,
        proposedDate: value.proposedDate,
        note: value.note || undefined,
      })
    }
    // Mock engine dùng dạng cũ: khoảng ngày sử dụng trong thời hạn thuê.
    return request(
      'tenant',
      path(id, 'services'),
      serviceSchema,
      write('POST', {
        serviceId: value.serviceId,
        startDate: value.proposedDate,
        endDate: value.contractEndDate,
        note: value.note,
      }),
    )
  },
  stopService: async (id: string, value: ServiceStopValue) => {
    if (provider('utilities') === 'real') {
      return utilitiesService.serviceRequests.terminate({
        subscriptionId: value.subscriptionId,
        proposedDate: value.proposedDate,
        note: value.note || undefined,
      })
    }
    return request(
      'tenant',
      path(id, `services/${encodeURIComponent(value.serviceId)}/cancel`),
      serviceSchema,
      write('POST'),
    )
  },
  cancelServiceRequest: async (_id: string, requestId: string) =>
    utilitiesService.serviceRequests.cancel(requestId),
  utilities: (id: string) => request('tenant', path(id, 'utilities'), z.array(chargeSchema)),
  allocations: (id: string) => request('tenant', path(id, 'allocations'), z.array(proposalSchema)),
  propose: async (id: string, value: unknown) => {
    if (provider('utilities') === 'real') {
      const p = await utilitiesService.costAllocation.propose(
        value as CreateCostAllocationProposalInput,
      )
      return {
        id: p.id,
        contractTenantId: p.proposedBy,
        chargeId: p.roomServiceChargeId,
        method: p.method === 'RESIDENT_DAYS' ? 'RESIDENT_DAYS' : ('APPROVED_CUSTOM' as const),
        reason: p.reason || '',
        status: (p.status === 'APPROVED'
          ? 'APPROVED'
          : p.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
        createdAt: p.createdAt || new Date().toISOString(),
        decidedAt: p.processedAt || null,
        decision: p.status === 'PENDING' ? null : p.status,
        shares: [],
      }
    }
    return request('tenant', path(id, 'allocations'), proposalSchema, write('POST', value))
  },
  reports: async (id: string): Promise<MaintenanceReport[]> => {
    if (provider('tenant') === 'real') {
      try {
        const p = await reportRequestService.search({ size: 100 }, 'tenant')
        if (p && Array.isArray(p.content)) {
          const seen = new Set<string>()
          return p.content
            .filter((item) => {
              if (!item.id || seen.has(item.id)) return false
              seen.add(item.id)
              return true
            })
            .map((item) => adaptReportRequest(item, id))
        }
      } catch {
        // Real API unavailable — fall through to user's own local list
      }
    }
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const { useSession } = await import('@/features/auth/session-store')
    const user = useSession.getState().user
    const t = tenantDb.state.tenancies.find((x) => x.id === id && (!user || x.userId === user.id))
    if (!t) return []
    return tenantDb.state.reports.filter((r) => r.contractTenantId === t.id || r.contractTenantId === id)
  },
  report: async (id: string, reportId: string): Promise<MaintenanceReport> => {
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
    // Check mock memory first to avoid hammering real API with a 404 loop when
    // the record was created via mock fallback (e.g. backend unavailable).
    const mockFound =
      tenantDb.state.reports.find((x) => x.id === reportId && x.contractTenantId === t.id) ||
      tenantDb.state.reports.find((x) => x.id === reportId)
    if (mockFound) {
      // Silently attempt real API for fresher data; fall back to cached mock on any error
      if (provider('tenant') === 'real') {
        try {
          const item = await reportRequestService.getById(reportId)
          if (item) return adaptReportRequest(item, id)
        } catch {
          // ignore — use mock below
        }
      }
      return mockFound
    }
    // Not in mock — try real API (will throw if not found)
    if (provider('tenant') === 'real') {
      const item = await reportRequestService.getById(reportId)
      if (item) return adaptReportRequest(item, id)
    }
    throw new Error('Không tìm thấy yêu cầu hỗ trợ.')
  },
  createReport: async (
    id: string,
    value: ReportInput & { roomId?: string; type?: string; furnitureIds?: string[]; serviceIds?: string[] },
  ): Promise<MaintenanceReport> => {
    if (provider('tenant') === 'real') {
      try {
        const targetRoomId =
          value.roomId ||
          (value.category !== 'FURNITURE' && value.category !== 'SERVICE' ? value.assetId : undefined) ||
          ''
        const item = await reportRequestService.create({
          roomId: targetRoomId,
          type: (value.type || value.category || 'REPAIR') as any,
          title: value.title,
          content: value.description,
          priority: (value.priority === 'NORMAL' ? 'MEDIUM' : value.priority) as any,
          attachments: (value.attachments || []).map((a) => a.url),
          furnitureIds:
            value.furnitureIds ||
            (value.category === 'FURNITURE' && value.assetId && value.assetId !== targetRoomId
              ? [value.assetId]
              : undefined),
          serviceIds:
            value.serviceIds ||
            (value.category === 'SERVICE' && value.assetId && value.assetId !== targetRoomId
              ? [value.assetId]
              : undefined),
        })
        const adapted = adaptReportRequest(item, id)
        try {
          const { tenantDb } = await import('@/mocks/tenant-engine')
          const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
          if (t && !tenantDb.state.reports.some((r) => r.id === adapted.id)) {
            tenantDb.state.reports.unshift({
              ...adapted,
              workflowAt: Date.now() + 12000,
            } as any)
            tenantDb.save()
          }
        } catch {
          // ignore sync error
        }
        return adapted
      } catch (err) {
        console.warn('Real report-requests create failed, falling back to direct mock:', err)
      }
    }
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
    return tenantDb.report(t, {
      category: value.category || 'REPAIR',
      assetId: value.assetId || t.roomId,
      title: value.title,
      description: value.description,
      priority: value.priority || 'NORMAL',
      attachments: value.attachments || [],
    })
  },
  cancelReport: async (id: string, reportId: string): Promise<MaintenanceReport> => {
    if (provider('tenant') === 'real') {
      try {
        const item = await reportRequestService.cancel(reportId)
        if (item) {
          return adaptReportRequest(item, id)
        }
      } catch (err) {
        console.warn('Real report-request cancel failed, falling back to mock:', err)
      }
    }
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
    return tenantDb.cancelReport(t, reportId)
  },
  reset: () => request('tenant', '/api/tenant/demo/reset', z.null(), write('POST')),
}
