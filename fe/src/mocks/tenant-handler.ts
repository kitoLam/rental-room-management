import { HttpResponse } from 'msw'
import { tenantDb } from './tenant-engine'
import { db, MockError } from './database'
import { managerDb } from './manager-engine'
import { ownerDb } from './owner-engine'

export async function handleTenant(request: Request, userId: string, empty = false) {
  const url = new URL(request.url),
    path = url.pathname.replace('/__mock', ''),
    method = request.method
  const ok = (data: unknown, status = 200) =>
    HttpResponse.json({ status, code: 0, message: 'Thành công', data }, { status })
  tenantDb.tick(
    (...args) => db.notify(...args),
    Date.now(),
    import.meta.env.DEV && request.headers.get('X-TroPro-Tenant-Workflow') === 'reject',
  )
  db.save()
  if (path === '/api/tenant/tenancies' && method === 'GET')
    return ok(empty ? [] : tenantDb.state.tenancies.filter((t) => t.userId === userId))
  if (path === '/api/tenant/demo/reset' && method === 'POST' && import.meta.env.DEV) {
    if (!tenantDb.state.tenancies.some((t) => t.userId === userId))
      throw new MockError('Chỉ tài khoản Tenant demo được đặt lại dữ liệu demo.', 403)
    const ids = new Set(tenantDb.state.tenancies.map((t) => t.userId))
    managerDb.reset()
    db.state.notifications = db.state.notifications.filter(
      (n) => !ids.has(n.recipientUserId) || !n.referenceType?.startsWith('TENANT_'),
    )
    db.save()
    return ok(null)
  }
  const match = path.match(/^\/api\/tenant\/tenancies\/([^/]+)\/(.+)$/)
  if (!match) throw new MockError('API Tenant không tồn tại.', 404)
  const [, tenancyId, resource] = match,
    t = tenantDb.own(userId, tenancyId)
  const list = <T extends { contractTenantId: string }>(items: T[]) =>
    empty ? [] : items.filter((i) => i.contractTenantId === t.id)
  const created = <T extends { id: string }>(record: T, title: string, type: string) => {
    db.notify(
      userId,
      title,
      'Yêu cầu đã được ghi nhận, mở để theo dõi kết quả.',
      type,
      record.id,
      t.id,
    )
    db.save()
    return ok(record, 201)
  }
  if (resource === 'room' && method === 'GET') return ok(tenantDb.room(t))
  if (resource === `contracts/${t.contractId}` && method === 'GET') return ok(t)
  if (resource === 'invoices' && method === 'GET')
    return ok(list(tenantDb.state.invoices).map((i) => tenantDb.invoice(t, i.id)))
  if (resource === 'payments' && method === 'GET') return ok(list(tenantDb.state.payments))
  if (resource === 'prepaid-payments' && method === 'POST')
    return created(
      tenantDb.prepay(t, await request.json()),
      'Đã tạo giao dịch trả trước mô phỏng',
      'TENANT_PAYMENT',
    )
  if (resource === 'services' && method === 'GET') return ok(empty ? [] : tenantDb.servicesFor(t))
  if (resource === 'services' && method === 'POST')
    return created(
      tenantDb.service(t, await request.json()),
      'Đã gửi đăng ký dịch vụ',
      'TENANT_SERVICE',
    )
  if (resource === 'utilities' && method === 'GET') return ok(list(tenantDb.state.charges))
  if (resource === 'allocations' && method === 'GET') return ok(list(tenantDb.state.proposals))
  if (resource === 'allocations' && method === 'POST')
    return created(
      tenantDb.propose(t, await request.json()),
      'Đã gửi đề xuất phân bổ',
      'TENANT_ALLOCATION',
    )
  if (resource === 'maintenance' && method === 'GET') return ok(list(tenantDb.state.reports))
  if (resource === 'maintenance' && method === 'POST')
    return created(
      tenantDb.report(t, await request.json()),
      'Đã gửi yêu cầu bảo trì',
      'TENANT_MAINTENANCE',
    )
  const manual = resource.match(/^invoices\/([^/]+)\/manual-payments$/)
  if (manual && method === 'POST') return ok(ownerDb.submitManual(userId, t.id, manual[1], await request.json()), 201)
  const invoice = resource.match(/^invoices\/([^/]+)(\/payments)?$/)
  if (invoice) {
    if (method === 'GET' && !invoice[2]) return ok(tenantDb.invoice(t, invoice[1]))
    if (method === 'POST' && invoice[2])
      return ok(tenantDb.pay(t, invoice[1], await request.json()), 201)
  }
  const payment = resource.match(/^payments\/([^/]+)$/)
  if (payment && method === 'GET')
    return ok(tenantDb.resource(tenantDb.state.payments, payment[1], t))
  const service = resource.match(/^services\/([^/]+)\/cancel$/)
  if (service && method === 'POST') return ok(tenantDb.cancelService(t, service[1]))
  const report = resource.match(/^maintenance\/([^/]+)(\/cancel)?$/)
  if (report) {
    if (method === 'GET' && !report[2])
      return ok(tenantDb.resource(tenantDb.state.reports, report[1], t))
    if (method === 'POST' && report[2]) return ok(tenantDb.cancelReport(t, report[1]))
  }
  throw new MockError('Không tìm thấy dữ liệu hoặc thao tác được phép.', 404)
}
