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

const SHARED_REPORTS_KEY = 'tropro-shared-reports-v1'

type MockReportRecord = MaintenanceReport['records'][number]
type MockReportLike = InternalReport & {
  roomId?: string
  branchId?: string
  contractId?: string
  content?: string
  locallyModified?: boolean
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
      statusTo: (statusMap[rec.status] || rec.status || 'PENDING') as ReportRequestItem['status'],
      note: rec.description || '',
      attachments: rec.evidence || [],
      createdAt: rec.at || new Date().toISOString(),
    })),
  }
}

async function syncMockReports() {
  const { tenantDb } = await import('@/mocks/tenant-engine')
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SHARED_REPORTS_KEY)
      if (raw) {
        const shared = JSON.parse(raw) as MockReportLike[]
        if (Array.isArray(shared)) {
          for (const sr of shared) {
            if (!sr || !sr.id) continue
            const existingIdx = tenantDb.state.reports.findIndex((x) => x.id === sr.id)
            if (existingIdx >= 0) {
              const existing = tenantDb.state.reports[existingIdx] as MockReportLike
              if (sr.locallyModified || !existing.locallyModified) {
                tenantDb.state.reports[existingIdx] = sr
              }
            } else {
              tenantDb.state.reports.unshift(sr)
            }
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return tenantDb
}

function saveSharedReports(tenantDb: { state: { reports: InternalReport[] }; save: () => void }) {
  try {
    tenantDb.save()
  } catch {
    // ignore sessionStorage quota errors
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const compactReports = tenantDb.state.reports.slice(0, 20).map((r) => ({
        ...r,
        attachments: (r.attachments || []).map((a) =>
          typeof a === 'object' && a && typeof a.url === 'string' && a.url.startsWith('data:image/')
            ? { ...a, url: '/demo/room-1.webp' }
            : a,
        ),
        records: (r.records || []).map((rec) => ({
          ...rec,
          evidence: (rec.evidence || []).map((u) =>
            typeof u === 'string' && u.startsWith('data:image/') ? '/demo/room-1.webp' : u,
          ),
        })),
      }))
      localStorage.setItem(SHARED_REPORTS_KEY, JSON.stringify(compactReports))
    } catch {
      try {
        localStorage.removeItem(SHARED_REPORTS_KEY)
      } catch {
        // ignore
      }
    }
  }
}

async function upsertMockFromItem(item: ReportRequestItem, fromMutation = false) {
  try {
    const tenantDb = await syncMockReports()
    const existingIdx = tenantDb.state.reports.findIndex((r) => r.id === item.id)
    if (existingIdx >= 0) {
      const existing = tenantDb.state.reports[existingIdx] as MockReportLike
      // Do not let a stale GET response overwrite a locally modified fallback state
      if (existing.locallyModified && !fromMutation) {
        return
      }
    }
    const tenancy =
      tenantDb.state.tenancies.find((t) => t.roomId === item.roomId) ||
      tenantDb.state.tenancies[0]
    const assetNameMap: Record<string, string> = {
      REPAIR: 'Sửa chữa',
      FURNITURE: 'Nội thất',
      SERVICE: 'Dịch vụ',
      COMPLAINT: 'Khiếu nại',
      MAINTENANCE: 'Bảo trì',
      CONTRACT: 'Hợp đồng',
      OTHER: 'Khác',
    }
    const mockItem: MockReportLike = {
      id: item.id,
      contractTenantId: tenancy?.id || item.tenantId || '',
      roomId: item.roomId,
      branchId: item.branchId || tenancy?.branchId || '',
      contractId: item.contractId || tenancy?.contractId || '',
      assetId: item.roomId || tenancy?.roomId || '',
      category: (item.type || 'REPAIR') as MaintenanceReport['category'],
      assetName: assetNameMap[item.type] || 'Yêu cầu hỗ trợ',
      title: item.title,
      description: item.content,
      content: item.content,
      priority: (item.priority === 'MEDIUM' ? 'NORMAL' : item.priority) as MaintenanceReport['priority'],
      status: item.status as MaintenanceReport['status'],
      attachments: (item.attachments || []).map((url, idx) => ({
        id: `${item.id}-att-${idx}`,
        name: `Ảnh ${idx + 1}`,
        mime: 'image/jpeg' as const,
        size: 100000,
        url,
      })),
      createdAt: item.createdAt,
      assignedTo: item.managerId ? 'Quản lý chi nhánh' : null,
      solutionResult: item.solutionResult || null,
      rejectReason: item.rejectReason || null,
      requestedInfoNote: item.requestedInfoNote || null,
      disputeReason: item.disputeReason || null,
      adminConclusion: item.adminConclusion || null,
      locallyModified: false,
      workflowAt: 0,
      records: (item.timeline || []).map((rec) => ({
        id: rec.id,
        at: rec.createdAt,
        status: (rec.statusTo || rec.action) as MaintenanceReport['records'][number]['status'],
        description: rec.note || rec.action,
        performedBy: rec.actorName || rec.actorRole || 'Hệ thống',
        evidence: rec.attachments || [],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })),
    }
    if (existingIdx >= 0) {
      tenantDb.state.reports[existingIdx] = mockItem
    } else {
      tenantDb.state.reports.unshift(mockItem)
    }
    saveSharedReports(tenantDb)
  } catch {
    // Never let cache sync failure break the main API flow
  }
}

async function findMockReport(id: string) {
  const tenantDb = await syncMockReports()
  const r = tenantDb.state.reports.find((x) => x.id === id) as MockReportLike | undefined
  const tenancy =
    tenantDb.state.tenancies.find((t) => t.id === r?.contractTenantId) ||
    tenantDb.state.tenancies[0]
  return { tenantDb, r, tenancy }
}

function filterItems(items: ReportRequestItem[], filter: ReportRequestFilter): ReportRequestItem[] {
  return items.filter((item) => {
    if (filter.type && item.type !== filter.type) return false
    if (filter.status && item.status !== filter.status) return false
    if (filter.priority && item.priority !== filter.priority) return false
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase()
      if (!item.title.toLowerCase().includes(kw) && !item.content.toLowerCase().includes(kw)) {
        return false
      }
    }
    return true
  })
}

export const reportRequestService = {
  create: async (input: CreateReportRequestInput): Promise<ReportRequestItem> => {
    try {
      const created = await request(
        'tenant',
        '/api/v1/report-requests',
        reportRequestResponseSchema,
        write('POST', input),
      )
      await upsertMockFromItem(created, true)
      return created
    } catch (err) {
      console.warn('Real report-requests create failed, falling back to mock:', err)
      const tenantDb = await syncMockReports()
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
      }) as MockReportLike
      rep.locallyModified = true
      saveSharedReports(tenantDb)
      return toItem(rep, tenancy)
    }
  },

  getById: async (
    id: string,
    feature: 'tenant' | 'manager' | 'admin' = 'tenant',
  ): Promise<ReportRequestItem> => {
    const { r: mockR, tenancy: mockTenancy } = await findMockReport(id)
    // If local state has a locally modified update (e.g. escalated to admin, rejected, resolved),
    // return it immediately so stale backend GET responses cannot overwrite it.
    if (mockR?.locallyModified) {
      return toItem(mockR, mockTenancy)
    }

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id)

    // If it's a MongoDB ObjectId or not in mock memory yet, try the real API first
    if (isObjectId || !mockR) {
      try {
        const item = await request(
          feature,
          `/api/v1/report-requests/${encodeURIComponent(id)}`,
          reportRequestResponseSchema,
        )
        await upsertMockFromItem(item, false)
        return item
      } catch (err) {
        if (mockR) {
          return toItem(mockR, mockTenancy)
        }
        throw err
      }
    }

    // Record is a mock UUID in local state — return it directly without triggering 404 spam
    return toItem(mockR, mockTenancy)
  },

  search: async (
    filter: ReportRequestFilter = {},
    feature: 'tenant' | 'manager' | 'admin' = 'tenant',
  ): Promise<Page<ReportRequestItem>> => {
    const tenantDb = await syncMockReports()
    const getLocalItems = (): { item: ReportRequestItem; locallyModified?: boolean }[] =>
      tenantDb.state.reports.map((rawReport) => {
        const r = rawReport as MockReportLike
        const t =
          tenantDb.state.tenancies.find((x) => x.id === r.contractTenantId) ||
          tenantDb.state.tenancies.find((x) => x.roomId === r.roomId || x.roomId === r.assetId) ||
          tenantDb.state.tenancies[0]
        return { item: toItem(r, t), locallyModified: r.locallyModified }
      })

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
      params.set('page', '0')
      params.set('size', '100')

      const p = await request(
        feature,
        `/api/v1/report-requests?${params.toString()}`,
        pageSchema(reportRequestResponseSchema),
      )

      const seen = new Set<string>()
      const merged: ReportRequestItem[] = []
      const localEntries = getLocalItems()
      const localModifiedMap = new Map<string, ReportRequestItem>()
      for (const le of localEntries) {
        if (le.locallyModified && le.item.id) {
          localModifiedMap.set(le.item.id, le.item)
        }
      }

      for (const apiItem of p.content || []) {
        if (apiItem.id && !seen.has(apiItem.id)) {
          seen.add(apiItem.id)
          const localMod = localModifiedMap.get(apiItem.id)
          if (localMod) {
            merged.push(localMod)
          } else {
            merged.push(apiItem)
            await upsertMockFromItem(apiItem, false)
          }
        }
      }

      for (const le of localEntries) {
        if (le.item.id && !seen.has(le.item.id)) {
          seen.add(le.item.id)
          merged.push(le.item)
        }
      }

      const filtered = filterItems(merged, filter)
      const page = filter.page || 0
      const size = filter.size || 20
      return {
        content: filtered.slice(page * size, (page + 1) * size),
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size) || 1,
      }
    } catch (err) {
      console.warn('Real report-requests search failed, falling back to mock:', err)
      const filtered = filterItems(
        getLocalItems().map((x) => x.item),
        filter,
      )
      const page = filter.page || 0
      const size = filter.size || 20
      return {
        content: filtered.slice(page * size, (page + 1) * size),
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size) || 1,
      }
    }
  },

  requestInfo: async (id: string, note: string): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/request-info`,
        reportRequestResponseSchema,
        write('POST', { note }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests requestInfo failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'WAITING_INFO'
      r.requestedInfoNote = note
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  supplementInfo: async (
    id: string,
    additionalInfo: string,
    additionalAttachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/supplement`,
        reportRequestResponseSchema,
        write('POST', { additionalInfo, additionalAttachments }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests supplementInfo failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'PENDING'
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  reject: async (id: string, reason: string): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/reject`,
        reportRequestResponseSchema,
        write('POST', { reason }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests reject failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'REJECTED'
      r.rejectReason = reason
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  startProcessing: async (id: string): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/start`,
        reportRequestResponseSchema,
        write('POST'),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests startProcessing failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'IN_PROGRESS'
      r.assignedTo = 'Quản lý chi nhánh'
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  updateProgress: async (
    id: string,
    progressNote: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/progress`,
        reportRequestResponseSchema,
        write('POST', { progressNote, attachments }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests updateProgress failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'IN_PROGRESS'
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  resolve: async (
    id: string,
    solutionResult: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'manager',
        `/api/v1/report-requests/${encodeURIComponent(id)}/resolve`,
        reportRequestResponseSchema,
        write('POST', { solutionResult, attachments }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests resolve failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'RESOLVED'
      r.solutionResult = solutionResult
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  confirmClose: async (id: string): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/confirm-close`,
        reportRequestResponseSchema,
        write('POST'),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests confirmClose failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'CLOSED'
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  reopen: async (
    id: string,
    reason: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/reopen`,
        reportRequestResponseSchema,
        write('POST', { reason, attachments }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests reopen failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'IN_PROGRESS'
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  escalateAdmin: async (
    id: string,
    disputeReason: string,
    attachments: string[] = [],
  ): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/escalate-admin`,
        reportRequestResponseSchema,
        write('POST', { disputeReason, attachments }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests escalateAdmin failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'ESCALATED_ADMIN'
      r.disputeReason = disputeReason
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  adminResolve: async (id: string, adminConclusion: string): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'admin',
        `/api/v1/report-requests/${encodeURIComponent(id)}/admin-resolve`,
        reportRequestResponseSchema,
        write('POST', { adminConclusion }),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests adminResolve failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'CLOSED'
      r.adminConclusion = adminConclusion
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
      return toItem(r, tenancy)
    }
  },

  cancel: async (id: string): Promise<ReportRequestItem> => {
    try {
      const item = await request(
        'tenant',
        `/api/v1/report-requests/${encodeURIComponent(id)}/cancel`,
        reportRequestResponseSchema,
        write('POST'),
      )
      await upsertMockFromItem(item, true)
      return item
    } catch (err) {
      console.warn('Real report-requests cancel failed, falling back to mock:', err)
      const { tenantDb, r, tenancy } = await findMockReport(id)
      if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.', { cause: err })
      r.status = 'CANCELLED'
      r.locallyModified = true
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
      saveSharedReports(tenantDb)
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
