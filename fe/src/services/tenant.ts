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
import { tenantOverviewService } from './tenant-overview'
import type { Tenancy } from '@/interfaces/tenant'
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
    roomId: item.roomId,
    roomName: item.roomName ? (item.slotName ? `${item.roomName} - ${item.slotName}` : item.roomName) : null,
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
    if (!user?.roles.includes('TENANT')) return []
    const items = await tenantOverviewService.tenancies()
    // Compatibility shape for existing detail screens. Overview uses the nullable API fields directly.
    return items.map((t): Tenancy => ({
      id: t.id, userId: user.id, contractId: t.contractId, branchId: t.branchId, roomId: t.roomId,
      roomSlotId: t.roomSlotIds[0] || null, branchName: t.branchName, roomName: t.roomNumber,
      slotName: t.slotCodes.map((code) => code.startsWith(t.roomNumber + '-') ? code.slice(t.roomNumber.length + 1) : code).join(', ') || null,
      rentalMode: t.roomSlotIds.length ? 'SLOT' : 'ROOM',
      status: t.status, contractStatus: t.contractStatus === 'EXPIRED' ? 'ENDED' : t.contractStatus === 'TERMINATED' ? 'CANCELLED' : t.contractStatus,
      code: t.contractNumber || '', role: t.representative ? 'REPRESENTATIVE' : 'MEMBER',
      startDate: t.startDate || '', endDate: t.endDate || '', actualLeaveDate: null,
      monthlyRent: t.rentAmount ?? t.contractRentPrice ?? 0,
      firstMonthRent: t.contractRentPrice ?? 0, lastMonthRent: t.contractRentPrice ?? 0,
      prepaidFirstRequired: t.contractRentPrice ?? 0, prepaidLastRequired: t.contractDepositAmount ?? t.contractRentPrice ?? 0,
      terms: t.terms || '', sharedTerms: t.terms || '',
      document: t.signedFileUrl ? { name: `Hợp đồng ${t.contractNumber || ''}`, url: t.signedFileUrl, issuedAt: t.signedDate || t.startDate || '' } : null,
    }))
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
  payments: async (id: string) => {
    if (provider('tenant') === 'real' || provider('manager') === 'real') {
      const backendPayments = z.object({
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
      const page = await request('tenant', `/api/v1/payments?page=1&size=1000`, backendPayments)
      return page.content.map((p) => tenantPaymentSchema.parse({
        id: p.id,
        contractTenantId: p.contractTenantId || (/^[0-9a-fA-F]{24}$|^[0-9a-fA-F-]{36}$/.test(id) ? id : p.id),
        invoiceId: p.invoiceId,
        reference: p.transactionCode || p.id.slice(0, 8),
        amountReceived: Math.round(p.amount),
        allocatedAmount: Math.round(p.amount),
        prepaidFirstAmount: 0,
        prepaidLastAmount: 0,
        prepaidFirstApplied: 0,
        prepaidLastApplied: 0,
        payerName: 'Người thuê',
        method: p.method === 'SANDBOX' ? 'SANDBOX' : 'TRANSFER',
        environment: p.method === 'SANDBOX' ? 'SANDBOX' : 'LIVE',
        status: p.status === 'SUCCESS' ? 'VERIFIED' : p.status === 'FAILED' ? 'FAILED' : p.status === 'LATE_PAID' ? 'REVIEW' : 'PENDING',
        createdAt: p.createdAt || new Date(0).toISOString(),
        verifiedAt: p.paidAt,
        evidence: [],
      }))
    }
    return request('tenant', path(id, 'payments'), z.array(tenantPaymentSchema))
  },
  payment: async (id: string, paymentId: string) => {
    if (provider('tenant') === 'real' || provider('manager') === 'real') {
      const pSchema = z.object({
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
      })
      const p = await request('tenant', `/api/v1/payments/${encodeURIComponent(paymentId)}`, pSchema)
      return tenantPaymentSchema.parse({
        id: p.id,
        contractTenantId: p.contractTenantId || (/^[0-9a-fA-F]{24}$|^[0-9a-fA-F-]{36}$/.test(id) ? id : p.id),
        invoiceId: p.invoiceId,
        reference: p.transactionCode || p.id.slice(0, 8),
        amountReceived: Math.round(p.amount),
        allocatedAmount: Math.round(p.amount),
        prepaidFirstAmount: 0,
        prepaidLastAmount: 0,
        prepaidFirstApplied: 0,
        prepaidLastApplied: 0,
        payerName: 'Người thuê',
        method: p.method === 'SANDBOX' ? 'SANDBOX' : 'TRANSFER',
        environment: p.method === 'SANDBOX' ? 'SANDBOX' : 'LIVE',
        status: p.status === 'SUCCESS' ? 'VERIFIED' : p.status === 'FAILED' ? 'FAILED' : p.status === 'LATE_PAID' ? 'REVIEW' : 'PENDING',
        createdAt: p.createdAt || new Date(0).toISOString(),
        verifiedAt: p.paidAt,
        evidence: [],
      })
    }
    return request('tenant', path(id, `payments/${encodeURIComponent(paymentId)}`), tenantPaymentSchema)
  },
  pay: (id: string, invoiceId: string, value: unknown) =>
    request(
      'tenant',
      path(id, `invoices/${encodeURIComponent(invoiceId)}/payments`),
      tenantPaymentSchema,
      write('POST', value),
    ),
  services: async (id: string): Promise<TenantService[]> => {
    if (provider('utilities') === 'real') {
      // Dịch vụ tự chọn đang dùng trên các hợp đồng đang hiệu lực của người thuê.
      const { serviceCatalogApi, isInUse } = await import('./service-catalog')
      const contracts = await serviceCatalogApi.myContracts()
      return contracts
        .filter((c) => c.status === 'ACTIVE')
        .flatMap((c) => (c.activeSlotServices || []).filter((s) => isInUse(s)))
        .map((s) => ({
          id: s.slotServiceId,
          name: s.name || 'Dịch vụ',
          mandatory: false,
          unit: s.unit || '',
          unitPrice: s.unitPrice ?? 0,
          subscriptionId: null,
          requestId: null,
          status: 'APPROVED' as const,
          startDate: s.startDate ?? null,
          endDate: s.endDate ?? null,
          note: '',
          history: [],
        }))
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
  reports: async (id: string, roomId?: string): Promise<MaintenanceReport[]> => {
    if (provider('tenant') === 'real') {
      const p = await reportRequestService.search(
        {
          size: 100,
          roomId: roomId || undefined,
        },
        'tenant',
      )
      const seen = new Set<string>()
      return (p.content || [])
        .filter((item) => {
          if (!item.id || seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        .map((item) => adaptReportRequest(item, id))
    }
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const { useSession } = await import('@/features/auth/session-store')
    const user = useSession.getState().user
    const t = tenantDb.state.tenancies.find((x) => x.id === id && (!user || x.userId === user.id))
    if (!t) return []
    return tenantDb.state.reports.filter(
      (r) =>
        (r.contractTenantId === t.id || r.contractTenantId === id) &&
        (!roomId || r.roomId === roomId),
    )
  },
  report: async (id: string, reportId: string): Promise<MaintenanceReport> => {
    if (provider('tenant') === 'real') {
      const item = await reportRequestService.getById(reportId, 'tenant')
      if (item) return adaptReportRequest(item, id)
      throw new Error('Không tìm thấy yêu cầu hỗ trợ.')
    }
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
    const mockFound =
      (t ? tenantDb.state.reports.find((x) => x.id === reportId && x.contractTenantId === t.id) : undefined) ||
      tenantDb.state.reports.find((x) => x.id === reportId)
    if (mockFound) return mockFound
    throw new Error('Không tìm thấy yêu cầu hỗ trợ.')
  },
  createReport: async (
    id: string,
    value: ReportInput & { roomId?: string; type?: string; furnitureIds?: string[]; serviceIds?: string[] },
  ): Promise<MaintenanceReport> => {
    if (provider('tenant') === 'real') {
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
      return adaptReportRequest(item, id)
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
      const item = await reportRequestService.cancel(reportId)
      return adaptReportRequest(item, id)
    }
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
    return tenantDb.cancelReport(t, reportId)
  },
  reset: () => request('tenant', '/api/tenant/demo/reset', z.null(), write('POST')),
}
