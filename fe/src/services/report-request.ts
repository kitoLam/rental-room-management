import { z } from 'zod'
import { request, write } from './http'
import { pageSchema, type Page } from '@/interfaces/domain'
import type { Tenancy, MaintenanceReport } from '@/interfaces/tenant'
import type { InternalReport } from '@/mocks/tenant-fixtures'
import {
  reportRequestResponseSchema,
  reportRecordResponseSchema,
  type ReportRequestItem,
  type ReportRecordItem,
  type CreateReportRequestInput,
  type ReportRequestFilter,
} from '@/interfaces/report-request'

type MockReportRecord = MaintenanceReport['records'][number]
type MockReportLike = InternalReport & {
  roomId?: string
  branchId?: string
  contractId?: string
  content?: string
}

function toItem(r: MockReportLike, tenancy?: Tenancy): ReportRequestItem {
  const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    NORMAL: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  }
  const statusMap: Record<string, ReportRequestItem['status']> = {
    OPEN: 'PENDING',
    ACCEPTED: 'IN_PROGRESS',
    COMPLETED: 'RESOLVED',
  }
  return {
    id: r.id,
    tenantId: tenancy?.userId || 'tenant-id',
    roomId: r.roomId || tenancy?.roomId || r.assetId || 'room-id',
    branchId: r.branchId || tenancy?.branchId || 'branch-id',
    contractId: r.contractId || tenancy?.contractId || 'contract-id',
    managerId: r.assignedTo ? 'manager-1' : 'manager-id',
    type: r.category || 'REPAIR',
    title: r.title || '',
    content: r.content || r.description || '',
    attachments: (r.attachments || []).map((a) => (typeof a === 'string' ? a : a.url)),
    priority: priorityMap[r.priority] || 'MEDIUM',
    status: statusMap[r.status] || (r.status as ReportRequestItem['status']) || 'PENDING',
    solutionResult: r.solutionResult || null,
    rejectReason: r.rejectReason || null,
    requestedInfoNote: r.requestedInfoNote || null,
    disputeReason: r.disputeReason || null,
    adminConclusion: r.adminConclusion || null,
    createdAt: r.createdAt || new Date().toISOString(),
    timeline: (r.records || []).map((rec: MockReportRecord, idx: number): ReportRecordItem => ({
      id: rec.id || `rec-${idx}`,
      reportRequestId: r.id,
      actorId: 'user-id',
      actorRole: rec.performedBy || 'Khách thuê',
      actorName: rec.performedBy || 'Khách thuê',
      managerId: 'manager-id',
      action: (rec.status as ReportRecordItem['action']) || 'CREATED',
      statusFrom: null,
      statusTo: (rec.status as ReportRequestItem['status']) || 'PENDING',
      note: rec.description || '',
      attachments: rec.evidence || [],
      createdAt: rec.at || new Date().toISOString(),
    })),
  }
}

async function findMockReport(id: string) {
  const { tenantDb } = await import('@/mocks/tenant-engine')
  const r = tenantDb.state.reports.find((x) => x.id === id) as MockReportLike | undefined
  const tenancy = tenantDb.state.tenancies.find((t) => t.id === r?.contractTenantId) || tenantDb.state.tenancies[0]
  return { tenantDb, r, tenancy }
}

export const reportRequestService = {
  create: async (input: CreateReportRequestInput): Promise<ReportRequestItem> => {
    try {
      return await request('tenant', '/api/v1/report-requests', reportRequestResponseSchema, write('POST', input))
    } catch (err) {
      console.warn('Real report-requests create failed, falling back to mock:', err)
      const { tenantDb } = await import('@/mocks/tenant-engine')
      const tenancy =
        tenantDb.state.tenancies.find((t) => t.roomId === input.roomId) ||
        tenantDb.state.tenancies[0]
      const rep = tenantDb.report(tenancy, {
        category: input.type || 'REPAIR',
        assetId: input.furnitureIds?.[0] || input.serviceIds?.[0] || input.roomId || tenancy.roomId,
        title: input.title,
        description: input.content,
        priority: input.priority || 'NORMAL',
        attachments: (input.attachments || []).map((url: string, i: number) => ({
          id: `att-${Date.now()}-${i}`,
          name: `Ảnh ${i + 1}`,
          mime: 'image/jpeg',
          size: 50000,
          url,
        })),
      })
      return toItem(rep as MockReportLike, tenancy)
    }
  },

  getById: async (id: string): Promise<ReportRequestItem> => {
    try {
      return await request('tenant', `/api/v1/report-requests/${encodeURIComponent(id)}`, reportRequestResponseSchema)
    } catch (err) {
      console.warn('Real report-requests getById failed, falling back to mock:', err)
      const { r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      return toItem(r, tenancy)
    }
  },

  search: async (
    filter: ReportRequestFilter = {},
    feature: 'tenant' | 'manager' = 'tenant',
  ): Promise<Page<ReportRequestItem>> => {
    try {
      const params = new URLSearchParams()
      if (filter.tenantId) params.set('tenantId', filter.tenantId)
      if (filter.roomId) params.set('roomId', filter.roomId)
      if (filter.branchId) params.set('branchId', filter.branchId)
      if (filter.contractId) params.set('contractId', filter.contractId)
      if (filter.managerId) params.set('managerId', filter.managerId)
      if (filter.type) params.set('type', filter.type)
      if (filter.priority) params.set('priority', filter.priority)
      if (filter.status) params.set('status', filter.status)
      if (filter.keyword) params.set('keyword', filter.keyword)
      if (filter.page !== undefined) params.set('page', String(filter.page))
      if (filter.size !== undefined) params.set('size', String(filter.size))

      return await request(
        feature,
        `/api/v1/report-requests?${params.toString()}`,
        pageSchema(reportRequestResponseSchema),
      )
    } catch (err) {
      console.warn('Real report-requests search failed, falling back to mock:', err)
      const { tenantDb } = await import('@/mocks/tenant-engine')
      const items = tenantDb.state.reports.map((rawReport) => {
        const r = rawReport as MockReportLike
        const t =
          tenantDb.state.tenancies.find((x) => x.id === r.contractTenantId) ||
          tenantDb.state.tenancies.find((x) => x.roomId === r.roomId || x.roomId === r.assetId) ||
          tenantDb.state.tenancies[0]
        return toItem(r, t)
      })
      const filtered = items.filter((item) => {
        if (filter.branchId && item.branchId && item.branchId !== filter.branchId) {
          const matchBranch =
            item.branchId === filter.branchId ||
            tenantDb.state.tenancies.some((t) => t.roomId === item.roomId && t.branchId === filter.branchId)
          if (!matchBranch) return false
        }
        if (filter.type && item.type !== filter.type) return false
        if (filter.status && item.status !== filter.status) return false
        if (filter.keyword) {
          const kw = filter.keyword.toLowerCase()
          if (!item.title.toLowerCase().includes(kw) && !item.content.toLowerCase().includes(kw)) {
            return false
          }
        }
        return true
      })
      return {
        content: filtered,
        number: filter.page || 0,
        size: filter.size || 20,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / (filter.size || 20)) || 1,
      }
    }
  },

  requestInfo: async (id: string, note: string): Promise<ReportRequestItem> => {
    try {
      return await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/request-info`,
        reportRequestResponseSchema,
        write('POST', { note }),
      )
    } catch (err) {
      console.warn('Real report-requests requestInfo failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'WAITING_INFO'
      r.requestedInfoNote = note
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'WAITING_INFO',
        description: `Quản lý yêu cầu bổ sung: ${note}`,
        performedBy: 'Quản lý',
        evidence: [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  supplementInfo: async (
    id: string,
    additionalInfo: string,
    additionalAttachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      return await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/supplement`,
        reportRequestResponseSchema,
        write('POST', { additionalInfo, additionalAttachments }),
      )
    } catch (err) {
      console.warn('Real report-requests supplementInfo failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'PENDING'
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'PENDING',
        description: `Khách thuê đã bổ sung: ${additionalInfo}`,
        performedBy: 'Khách thuê',
        evidence: additionalAttachments,
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  reject: async (id: string, reason: string): Promise<ReportRequestItem> => {
    try {
      return await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/reject`,
        reportRequestResponseSchema,
        write('POST', { reason }),
      )
    } catch (err) {
      console.warn('Real report-requests reject failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'REJECTED'
      r.rejectReason = reason
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'REJECTED',
        description: `Từ chối yêu cầu: ${reason}`,
        performedBy: 'Quản lý',
        evidence: [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  startProcessing: async (id: string): Promise<ReportRequestItem> => {
    try {
      return await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/start`,
        reportRequestResponseSchema,
        write('POST'),
      )
    } catch (err) {
      console.warn('Real report-requests startProcessing failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'IN_PROGRESS'
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'IN_PROGRESS',
        description: 'Quản lý bắt đầu tiếp nhận và xử lý yêu cầu',
        performedBy: 'Quản lý',
        evidence: [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  updateProgress: async (
    id: string,
    progressNote: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      return await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/progress`,
        reportRequestResponseSchema,
        write('POST', { progressNote, attachments }),
      )
    } catch (err) {
      console.warn('Real report-requests updateProgress failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'IN_PROGRESS'
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'IN_PROGRESS',
        description: progressNote,
        performedBy: 'Quản lý',
        evidence: attachments,
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  resolve: async (
    id: string,
    solutionResult: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      return await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/resolve`,
        reportRequestResponseSchema,
        write('POST', { solutionResult, attachments }),
      )
    } catch (err) {
      console.warn('Real report-requests resolve failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'RESOLVED'
      r.solutionResult = solutionResult
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'RESOLVED',
        description: `Đã xử lý: ${solutionResult}`,
        performedBy: 'Quản lý',
        evidence: attachments,
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  confirmClose: async (id: string): Promise<ReportRequestItem> => {
    try {
      return await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/confirm-close`,
        reportRequestResponseSchema,
        write('POST'),
      )
    } catch (err) {
      console.warn('Real report-requests confirmClose failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'CLOSED'
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'CLOSED',
        description: 'Khách thuê hài lòng và xác nhận đóng yêu cầu.',
        performedBy: 'Khách thuê',
        evidence: [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  reopen: async (
    id: string,
    reason: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      return await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/reopen`,
        reportRequestResponseSchema,
        write('POST', { reason, attachments }),
      )
    } catch (err) {
      console.warn('Real report-requests reopen failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'IN_PROGRESS'
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'IN_PROGRESS',
        description: `Khách thuê yêu cầu mở lại xử lý: ${reason}`,
        performedBy: 'Khách thuê',
        evidence: attachments,
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  escalateAdmin: async (
    id: string,
    disputeReason: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      return await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/escalate-admin`,
        reportRequestResponseSchema,
        write('POST', { disputeReason, attachments }),
      )
    } catch (err) {
      console.warn('Real report-requests escalateAdmin failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'ESCALATED_ADMIN'
      r.disputeReason = disputeReason
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'ESCALATED_ADMIN',
        description: `Chuyển lên Admin giải quyết: ${disputeReason}`,
        performedBy: 'Khách thuê',
        evidence: attachments,
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  adminResolve: async (id: string, adminConclusion: string): Promise<ReportRequestItem> => {
    try {
      return await request(
        'admin',
        `/api/v1/report-requests/${encodeURIComponent(id)}/admin-resolve`,
        reportRequestResponseSchema,
        write('POST', { adminConclusion }),
      )
    } catch (err) {
      console.warn('Real report-requests adminResolve failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'CLOSED'
      r.adminConclusion = adminConclusion
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'CLOSED',
        description: `Admin đưa ra kết luận phân xử: ${adminConclusion}`,
        performedBy: 'Admin',
        evidence: [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  cancel: async (id: string): Promise<ReportRequestItem> => {
    try {
      return await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/cancel`,
        reportRequestResponseSchema,
        write('POST'),
      )
    } catch (err) {
      console.warn('Real report-requests cancel failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'CANCELLED'
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'CANCELLED',
        description: 'Khách thuê chủ động hủy yêu cầu',
        performedBy: 'Khách thuê',
        evidence: [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
      tenantDb.save()
      return toItem(r, tenancy)
    }
  },

  timeline: async (id: string): Promise<ReportRecordItem[]> => {
    try {
      return await request(
        'tenant',
        `/api/v1/report-records/by-report/${encodeURIComponent(id)}`,
        z.array(reportRecordResponseSchema),
      )
    } catch (err) {
      console.warn('Real report-records timeline failed, falling back to mock:', err)
      const { r, tenancy } = await findMockReport(id)
      if (!r) return []
      return toItem(r, tenancy).timeline || []
    }
  },
}
