import { HttpResponse } from 'msw'
import { tenantDb } from './tenant-engine'
import { MockError } from './database'
import type { User } from '@/interfaces/domain'
import type { ReportRequestItem, ReportRecordItem } from '@/interfaces/report-request'

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status, code: 0, message: 'Thành công', data }, { status })

function toReportItem(r: any): ReportRequestItem {
  const tenancy =
    tenantDb.state.tenancies.find((t) => t.id === r.contractTenantId) ||
    tenantDb.state.tenancies[0]
  const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    NORMAL: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  }
  const statusMap: Record<string, any> = {
    OPEN: 'PENDING',
    ACCEPTED: 'IN_PROGRESS',
    COMPLETED: 'RESOLVED',
  }
  const st = statusMap[r.status] || r.status || 'PENDING'

  return {
    id: r.id,
    tenantId: tenancy?.userId || 'tenant-id',
    roomId: tenancy?.roomId || r.assetId || 'room-id',
    branchId: tenancy?.branchId || 'branch-id',
    contractId: tenancy?.contractId || 'contract-id',
    managerId: r.assignedTo ? 'manager-1' : 'manager-id',
    type: r.category || 'REPAIR',
    title: r.title,
    content: r.description,
    attachments: (r.attachments || []).map((a: any) => (typeof a === 'string' ? a : a.url)),
    priority: priorityMap[r.priority] || 'MEDIUM',
    status: st,
    solutionResult: r.solutionResult || null,
    rejectReason: r.rejectReason || null,
    requestedInfoNote: r.requestedInfoNote || null,
    disputeReason: r.disputeReason || null,
    adminConclusion: r.adminConclusion || null,
    createdAt: r.createdAt || new Date().toISOString(),
    timeline: (r.records || []).map((rec: any, idx: number): ReportRecordItem => ({
      id: rec.id || `rec-${idx}`,
      reportRequestId: r.id,
      actorId: 'user-id',
      actorRole: rec.performedBy || 'Khách thuê',
      actorName: rec.performedBy || 'Khách thuê',
      managerId: 'manager-id',
      action: rec.status || 'CREATED',
      statusFrom: null,
      statusTo: rec.status || 'PENDING',
      note: rec.description || '',
      attachments: rec.evidence || [],
      createdAt: rec.at || new Date().toISOString(),
    })),
  }
}

export async function handleReportRequests(request: Request, user: User) {
  const url = new URL(request.url),
    path = url.pathname.replace('/__mock', ''),
    method = request.method

  // 1. GET /api/v1/report-requests (Search / list)
  if (path === '/api/v1/report-requests' && method === 'GET') {
    const list = tenantDb.state.reports.map(toReportItem)
    const branchId = url.searchParams.get('branchId')
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const keyword = url.searchParams.get('keyword')?.toLowerCase()

    const filtered = list.filter((item) => {
      if (branchId && item.branchId && item.branchId !== branchId) {
        const matchBranch =
          item.branchId === branchId ||
          tenantDb.state.tenancies.some((t) => t.roomId === item.roomId && t.branchId === branchId)
        if (!matchBranch) return false
      }
      if (type && item.type !== type) return false
      if (status && item.status !== status) return false
      if (keyword && !item.title.toLowerCase().includes(keyword) && !item.content.toLowerCase().includes(keyword)) {
        return false
      }
      return true
    })

    return ok({
      content: filtered,
      number: 0,
      page: 0,
      size: filtered.length || 20,
      totalElements: filtered.length,
      totalPages: 1,
      last: true,
    })
  }

  // 2. POST /api/v1/report-requests (Create new report)
  if (path === '/api/v1/report-requests' && method === 'POST') {
    const body = await request.json()
    const targetRoomId = body.roomId
    const tenancy =
      tenantDb.state.tenancies.find((t) => t.roomId === targetRoomId) ||
      tenantDb.state.tenancies.find((t) => t.userId === user.id) ||
      tenantDb.state.tenancies[0]

    const report = tenantDb.report(tenancy, {
      category: body.type || 'REPAIR',
      assetId: body.furnitureIds?.[0] || body.serviceIds?.[0] || targetRoomId || tenancy.roomId,
      title: body.title,
      description: body.content,
      priority: body.priority || 'NORMAL',
      attachments: (body.attachments || []).map((url: string, i: number) => ({
        id: `att-${Date.now()}-${i}`,
        name: `Ảnh ${i + 1}`,
        mime: 'image/jpeg',
        size: 50000,
        url,
      })),
    })

    return ok(toReportItem(report), 201)
  }

  // 3. GET /api/v1/report-records/by-report/:id
  const recordsMatch = path.match(/^\/api\/v1\/report-records\/by-report\/([^/]+)$/)
  if (recordsMatch && method === 'GET') {
    const r = tenantDb.state.reports.find((x) => x.id === recordsMatch[1])
    if (!r) throw new MockError('Không tìm thấy yêu cầu hỗ trợ.', 404)
    return ok(toReportItem(r).timeline)
  }

  // 4. Action sub-routes on /api/v1/report-requests/:id/...
  const actionMatch = path.match(
    /^\/api\/v1\/report-requests\/([^/]+)\/(request-info|supplement|reject|progress|resolve|confirm-close|reopen|escalate-admin|admin-resolve|cancel)$/,
  )
  if (actionMatch && method === 'POST') {
    const [, reportId, action] = actionMatch
    const r = tenantDb.state.reports.find((x) => x.id === reportId)
    if (!r) throw new MockError('Không tìm thấy yêu cầu hỗ trợ.', 404)

    const body = await request.json().catch(() => ({}))

    switch (action) {
      case 'request-info':
        r.status = 'WAITING_INFO' as any
        r.requestedInfoNote = body.note || 'Cần bổ sung thêm thông tin'
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'WAITING_INFO',
          description: `Quản lý yêu cầu bổ sung: ${r.requestedInfoNote}`,
          performedBy: user.fullName || 'Quản lý',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'supplement':
        r.status = 'PENDING' as any
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'PENDING',
          description: `Khách thuê đã bổ sung thông tin: ${body.additionalInfo || ''}`,
          performedBy: user.fullName || 'Khách thuê',
          evidence: body.additionalAttachments || [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'reject':
        r.status = 'REJECTED' as any
        r.rejectReason = body.reason || 'Yêu cầu không hợp lệ'
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'REJECTED',
          description: `Từ chối yêu cầu: ${r.rejectReason}`,
          performedBy: user.fullName || 'Quản lý',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'progress':
        r.status = 'IN_PROGRESS' as any
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'IN_PROGRESS',
          description: body.progressNote || 'Đang tiến hành xử lý',
          performedBy: user.fullName || 'Quản lý',
          evidence: body.attachments || [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'resolve':
        r.status = 'RESOLVED' as any
        r.solutionResult = body.solutionResult || 'Đã khắc phục sự cố'
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'RESOLVED',
          description: `Đã giải quyết: ${r.solutionResult}`,
          performedBy: user.fullName || 'Quản lý',
          evidence: body.attachments || [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'confirm-close':
        r.status = 'CLOSED' as any
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'CLOSED',
          description: 'Khách thuê hài lòng và xác nhận đóng yêu cầu.',
          performedBy: user.fullName || 'Khách thuê',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'reopen':
        r.status = 'IN_PROGRESS' as any
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'IN_PROGRESS',
          description: `Khách thuê yêu cầu mở lại xử lý: ${body.reason || ''}`,
          performedBy: user.fullName || 'Khách thuê',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'escalate-admin':
        r.status = 'ESCALATED_ADMIN' as any
        r.disputeReason = body.disputeReason || 'Chuyển tranh chấp lên Quản trị viên'
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'ESCALATED_ADMIN',
          description: `Chuyển lên Admin giải quyết: ${r.disputeReason}`,
          performedBy: user.fullName || 'Khách thuê',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'admin-resolve':
        r.status = 'CLOSED' as any
        r.adminConclusion = body.adminConclusion || 'Admin đã giải quyết khiếu nại'
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'CLOSED',
          description: `Admin phân xử: ${r.adminConclusion}`,
          performedBy: user.fullName || 'Admin',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break

      case 'cancel':
        r.status = 'CANCELLED' as any
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'CANCELLED',
          description: 'Đã hủy yêu cầu hỗ trợ.',
          performedBy: user.fullName || 'Khách thuê',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        })
        break
    }

    tenantDb.save()
    return ok(toReportItem(r))
  }

  // 5. GET /api/v1/report-requests/:id
  const getMatch = path.match(/^\/api\/v1\/report-requests\/([^/]+)$/)
  if (getMatch && method === 'GET') {
    const r = tenantDb.state.reports.find((x) => x.id === getMatch[1])
    if (!r) throw new MockError('Không tìm thấy yêu cầu hỗ trợ.', 404)
    return ok(toReportItem(r))
  }

  throw new MockError('API ReportRequest chưa được hỗ trợ.', 404)
}
