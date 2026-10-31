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
} from '@/interfaces/tenant'

import { provider } from './config'
import { utilitiesService } from './utilities'
import { reportRequestService } from './report-request'
import type { ReportRequestItem } from '@/interfaces/report-request'
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
    assignedTo: item.managerId ? 'Quản lý khu trọ' : null,
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
export const tenantApi = {
  manualPay: (id: string, invoiceId: string, value: unknown) => request('tenant', path(id, `invoices/${encodeURIComponent(invoiceId)}/manual-payments`), tenantPaymentSchema, write('POST', value)),
  prepay: (id: string, value: unknown) =>
    request('tenant', path(id, 'prepaid-payments'), tenantPaymentSchema, write('POST', value)),
  tenancies: async () => {
    try {
      return await request('tenant', '/api/tenant/tenancies', z.array(tenancySchema))
    } catch {
      const { tenantDb } = await import('@/mocks/tenant-engine')
      const { useSession } = await import('@/features/auth/session-store')
      const user = useSession.getState().user
      const list = user ? tenantDb.state.tenancies.filter((t) => t.userId === user.id) : []
      return list.length ? list : tenantDb.state.tenancies.slice(0, 1)
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
    try {
      return await request('tenant', path(id, 'room'), tenantRoomSchema)
    } catch {
      const { tenantDb } = await import('@/mocks/tenant-engine')
      const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
      return tenantDb.room(t)
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
  services: async (id: string, tenancyContext?: { roomId?: string; contractId?: string }) => {
    if (provider('utilities') === 'real') {
      const roomId = tenancyContext?.roomId
      const contractId = tenancyContext?.contractId
      if (!roomId || !contractId) {
        return []
      }
      const roomServices = await utilitiesService.roomServices.listByRoom(roomId)
      const contractServices = await utilitiesService.contractServices.listByContract(contractId)
      const csByRoomServiceId = new Map(contractServices.map((cs) => [cs.roomServiceId, cs]))

      return roomServices.map((rs) => {
        const cs = csByRoomServiceId.get(rs.id)
        return {
          id: rs.id,
          name: rs.serviceName,
          mandatory: Boolean(rs.mandatory),
          unit: rs.unit || 'tháng',
          unitPrice: rs.unitPrice,
          subscriptionId: cs ? cs.id : null,
          status: cs ? cs.status : null,
          startDate: cs ? cs.startDate : rs.startDate,
          endDate: (cs ? cs.endDate : rs.endDate) ?? null,
          note: cs?.reason || '',
          history: cs?.processedAt
            ? [
                {
                  status: cs.status,
                  at: cs.processedAt,
                  note: cs.reason || 'Đã xử lý',
                },
              ]
            : [],
        }
      })
    }
    return request('tenant', path(id, 'services'), z.array(serviceSchema))
  },
  registerService: async (id: string, value: unknown) => {
    if (provider('utilities') === 'real') {
      const v = value as {
        serviceId: string
        startDate: string
        endDate: string
        note?: string
        contractId: string
        roomServiceId?: string
      }
      const item = await utilitiesService.contractServices.register({
        contractId: v.contractId,
        contractTenantId: id,
        roomServiceId: v.roomServiceId || v.serviceId,
        startDate: v.startDate,
        endDate: v.endDate,
        reason: v.note,
      })
      return {
        id: item.id,
        name: item.serviceName,
        mandatory: false,
        unit: '',
        unitPrice: item.agreedUnitPrice,
        subscriptionId: item.id,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.reason || '',
        history: [],
      }
    }
    return request('tenant', path(id, 'services'), serviceSchema, write('POST', value))
  },
  cancelService: async (id: string, serviceId: string) => {
    if (provider('utilities') === 'real') {
      const item = await utilitiesService.contractServices.cancel(serviceId)
      return {
        id: item.id,
        name: item.serviceName,
        mandatory: false,
        unit: '',
        unitPrice: item.agreedUnitPrice,
        subscriptionId: item.id,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.reason || '',
        history: [],
      }
    }
    return request(
      'tenant',
      path(id, `services/${encodeURIComponent(serviceId)}/cancel`),
      serviceSchema,
      write('POST'),
    )
  },
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
    const { tenantDb } = await import('@/mocks/tenant-engine')
    const t = tenantDb.state.tenancies.find((x) => x.id === id) || tenantDb.state.tenancies[0]
    const mockList = tenantDb.state.reports.filter(
      (r) => !t || r.contractTenantId === t.id || r.contractTenantId === id || !r.contractTenantId,
    )
    const localList = mockList.length ? mockList : tenantDb.state.reports
    // Attempt real API to get the latest list; merge with local items so newly created
    // records (created via mock fallback) are always included.
    if (provider('tenant') === 'real') {
      try {
        const p = await reportRequestService.search({ size: 100 })
        if (p && Array.isArray(p.content)) {
          const seen = new Set<string>()
          const realItems = p.content
            .filter((item) => {
              if (!item.id || seen.has(item.id)) return false
              seen.add(item.id)
              return true
            })
            .map((item) => adaptReportRequest(item, id))
          // Prepend local-only records (those not returned by real API)
          const localOnly = localList.filter((r) => !seen.has(r.id))
          return [...localOnly, ...realItems]
        }
      } catch {
        // Real API unavailable — fall through to local list
      }
    }
    return localList
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
