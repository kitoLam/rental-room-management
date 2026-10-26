import { HttpResponse } from 'msw'
import type { User } from '@/interfaces/domain'
import { managerSchemas, type ManagerResource } from '@/interfaces/manager'
import { managerDb } from './manager-engine'
import { ownerUser, managerUser } from './manager-fixtures'
import { MockError } from './database'
import { eligibleUsers } from './manager-leasing'
import { saveZalo } from './manager-operations'
import { invoiceSources } from './manager-finance'
import { ownerDb } from './owner-engine'

export async function handleManager(request: Request, actor: User, empty = false) {
  const url = new URL(request.url),
    path = url.pathname.replace('/__mock', ''),
    params = url.searchParams,
    method = request.method,
    e = managerDb
  const ok = (data: unknown, status = 200) =>
    HttpResponse.json({ status, code: 0, message: 'Thành công', data }, { status })
  if (actor.roles.some((r) => r === 'MANAGER' || r === 'OWNER')) {
    e.tenant.state.workflowMode = 'managed'
    e.tenant.tick((...args) => e.db.notify(...args))
    e.scanInbox()
  }
  if (path === '/api/manager/branches' && method === 'GET')
    return ok(empty ? [] : request.headers.get('X-TroPro-Workspace') === 'OWNER' ? ownerDb.branches(actor) : e.branches(actor))
  if (path === '/api/manager/demo/scenario' && method === 'POST' && import.meta.env.DEV) {
    if (actor.id !== managerUser.id)
      throw new MockError('Công cụ chỉ dành cho tài khoản quản lý demo.', 403)
    const data = await request.json()
    if (data.scenario === 'revoke') e.revoke(ownerUser, data.branchId)
    else if (data.scenario === 'reset') {
      e.reset()
      e.tenant.state.workflowMode = 'managed'
      e.save()
    } else throw new MockError('Kịch bản chưa hợp lệ.', 422)
    return ok(null)
  }
  const match = path.match(/^\/api\/manager\/branches\/([^/]+)\/(.+)$/)
  if (!match) throw new MockError('Không tìm thấy API quản lý.', 404)
  const [, branchId, tail] = match
  if (request.headers.get('X-TroPro-Workspace') === 'OWNER') ownerDb.scope(actor, branchId)
  e.scope(actor, branchId, method !== 'GET')
  if (tail === 'adjustment-requests' && method === 'POST') return ok(ownerDb.requestAdjustment(actor, branchId, await request.json()), 201)
  if (tail === 'charge-preview' && method === 'POST')
    return ok(e.previewCharge(actor, branchId, await request.json()))
  if (tail === 'summary' && method === 'GET')
    return ok(
      e.summary(actor, branchId, params.get('month') || new Date().toISOString().slice(0, 7)),
    )
  if (tail === 'eligible-users' && method === 'GET') return ok(eligibleUsers(e, branchId))
  if (tail === 'invoice-sources' && method === 'GET')
    return ok(
      invoiceSources(
        e,
        branchId,
        params.get('contractTenantId') || '',
        params.get('month') || '',
        params.get('invoiceId') || undefined,
      ),
    )
  if (tail === 'settings/zalo' && method === 'PUT') {
    const data = await request.json()
    return ok(e.transaction(() => saveZalo(e, actor, branchId, data)))
  }
  const [resource, id, action = ''] = tail.split('/') as [
    ManagerResource,
    string | undefined,
    string | undefined,
  ]
  if (!Object.hasOwn(managerSchemas, resource))
    throw new MockError('Không tìm thấy tính năng quản lý.', 404)
  if ((method === 'PATCH' || method === 'DELETE') && !id)
    throw new MockError('Chọn hồ sơ cần cập nhật.', 422)
  if (method === 'GET') {
    if (resource === 'invoices' && id && action === 'editor') {
      const i = e.tenant.state.invoices.find(
        (i) =>
          i.id === id &&
          e.tenant.state.tenancies.some(
            (t) => t.id === i.contractTenantId && t.branchId === branchId,
          ),
      )
      if (!i || i.documentStatus !== 'DRAFT' || !e.state.sources[i.id])
        throw new MockError('Chỉ chỉnh sửa nháp có nguồn phí hợp lệ.', 409)
      const sources = e.state.sources[i.id],
        rent = i.items.find((v) => v.type === 'RENT'),
        adjust = i.items.find((v) => v.type === 'ADJUSTMENT'),
        prepaid = sources.find((s) => s.type === 'PREPAID')
      return ok({
        contractTenantId: i.contractTenantId,
        billingMonth: i.billingMonth,
        dueDate: i.dueDate,
        rentAmount: rent?.amount || 0,
        rentApprovalNote: rent?.snapshot || '',
        sources: sources
          .filter((s) => ['UTILITY', 'SERVICE', 'REPAIR'].includes(s.type))
          .map((s) => ({ type: s.type, id: s.id })),
        adjustment: adjust?.amount || 0,
        adjustmentReason: adjust?.snapshot || '',
        prepaidAmount: i.prepaidApplied,
        prepaidSourcePaymentId: prepaid?.id || null,
        prepaidBucket: prepaid?.bucket || 'FIRST_MONTH',
      })
    }
    if (id) return ok(e.get(actor, branchId, resource, id))
    const page = Number(params.get('page') || 0),
      size = Number(params.get('size') || 8)
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100)
      throw new MockError('Phân trang chưa hợp lệ.', 422)
    const rows = empty ? [] : e.list(actor, branchId, resource, params)
    return ok({
      content: rows.slice(page * size, (page + 1) * size),
      number: page + 1,
      size,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
    })
  }
  const value = method === 'DELETE' ? await request.json().catch(() => ({})) : await request.json()
  return ok(e.action(actor, branchId, resource, id || null, action, value, method), id ? 200 : 201)
}
