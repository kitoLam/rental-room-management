import { HttpResponse } from 'msw'
import { z } from 'zod'
import type { User } from '@/interfaces/domain'
import { ownerDb as o } from './owner-engine'
import { MockError } from './database'
import { paymentViews } from './manager-finance'
const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status, code: 0, message: 'Thành công', data }, { status })
function page<T>(rows: T[], params: URLSearchParams, empty: boolean) {
  const index = Number(params.get('page') || 0),
    size = Number(params.get('size') || 8)
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(size) || size < 1 || size > 100)
    throw new MockError('Phân trang chưa hợp lệ.', 422)
  const data = empty ? [] : rows
  return {
    content: data.slice(index * size, (index + 1) * size),
    number: index + 1,
    size,
    totalElements: data.length,
    totalPages: Math.ceil(data.length / size),
  }
}
export async function handleOwner(request: Request, actor: User, empty = false) {
  const url = new URL(request.url),
    path = url.pathname.replace('/__mock/api/owner', ''),
    method = request.method,
    params = url.searchParams
  const payload = () => request.json()
  if (path === '/verification') {
    if (method === 'GET') return ok(o.verification(actor))
    if (method === 'POST') return ok(o.submitVerification(actor, await payload()), 201)
  }
  // Acceptance is bound to the authenticated verified email, not Owner entitlement.
  if (path === '/my-invitations' && method === 'GET') {
    const user = o.canonical(actor)
    return ok(
      o.state.invitations
        .filter((i) => i.email === user.email.toLowerCase())
        .map((i) => ({
          ...i,
          status:
            i.status === 'INVITED' && Date.parse(i.expiresAt) <= Date.now() ? 'EXPIRED' : i.status,
        })),
    )
  }
  const accept = path.match(/^\/my-invitations\/([^/]+)\/accept$/)
  if (accept && method === 'POST') return ok(o.accept(actor, accept[1]))
  o.authorize(actor)
  const scope = params.get('branchId') || null
  if (scope) o.scope(actor, scope)
  const filter = <T extends object>(rows: T[]) =>
    rows.filter((row) => {
      const q = params.get('q')?.trim().toLocaleLowerCase('vi') || '',
        status = params.get('status'),
        branchId = 'branchId' in row ? row.branchId : 'id' in row ? row.id : null
      return (
        (!scope || branchId === scope) &&
        (!status || ('status' in row && row.status === status)) &&
        (!q || JSON.stringify(row).toLocaleLowerCase('vi').includes(q))
      )
    })
  if (path === '/summary' && method === 'GET')
    return ok(o.summary(actor, scope, params.get('month') || new Date().toISOString().slice(0, 7)))
  if (path === '/branches') {
    if (method === 'GET') {
      const manager = params.get('managerId'),
        rows = filter(o.branches(actor))
          .filter((b) => !manager || b.managerId === manager)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      return ok(page(rows, params, empty))
    }
    if (method === 'POST') return ok(o.saveBranch(actor, null, await payload()), 201)
  }
  const branch = path.match(/^\/branches\/([^/]+)(?:\/(policies|qr|assignment))?$/)
  if (branch) {
    const [, id, child] = branch
    o.scope(actor, id)
    if (!child && method === 'GET') return ok(o.branch(actor, id))
    if (!child && method === 'PATCH') {
      const data = await payload()
      return ok(o.saveBranch(actor, id, data.value, data.version))
    }
    if (!child && method === 'DELETE') {
      const data = await payload()
      return ok(o.deleteBranch(actor, id, data.version))
    }
    if (child === 'policies' && method === 'GET')
      return ok(
        o.state.policies.filter((p) => p.branchId === id).sort((a, b) => b.version - a.version),
      )
    if (child === 'policies' && method === 'POST')
      return ok(o.savePolicy(actor, id, await payload()), 201)
    if (child === 'qr' && method === 'PUT') return ok(o.saveQr(actor, id, await payload()))
    if (child === 'assignment' && method === 'PUT') {
      const data = z
        .object({ managerId: z.guid().nullable(), version: z.number().int(), reason: z.string() })
        .strict()
        .parse(await payload())
      return ok(o.assign(actor, id, data.managerId, data.version, data.reason))
    }
  }
  if (path === '/managers' && method === 'GET')
    return ok(
      page(
        o
          .managers(actor)
          .filter(
            (m) =>
              (!params.get('q') ||
                `${m.user.fullName} ${m.user.email}`
                  .toLowerCase()
                  .includes(params.get('q')!.toLowerCase())) &&
              (!scope || m.branches.some((b) => b.id === scope)),
          ),
        params,
        empty,
      ),
    )
  const manager = path.match(/^\/managers\/([^/]+)$/)
  if (manager) {
    const m = o.managers(actor).find((m) => m.id === manager[1])
    if (!m) throw new MockError('Không tìm thấy quản lý thuộc chủ trọ.', 404)
    if (method === 'GET') return ok(m)
    if (method === 'DELETE') return ok(o.removeManager(actor, manager[1], (await payload()).reason))
  }
  if (path === '/invitations') {
    if (method === 'GET')
      return ok(
        page(
          filter(
            o.state.invitations
              .filter((i) => i.ownerId === actor.id)
              .map((i) => ({
                ...i,
                status:
                  i.status === 'INVITED' && Date.parse(i.expiresAt) <= Date.now()
                    ? 'EXPIRED'
                    : i.status,
              })),
          ),
          params,
          empty,
        ),
      )
    if (method === 'POST') return ok(o.invite(actor, await payload()), 201)
  }
  const invitation = path.match(/^\/invitations\/([^/]+)\/(cancel|resend)$/)
  if (invitation && method === 'POST')
    return ok(o.invitationAction(actor, invitation[1], invitation[2]))
  if (path === '/approvals' && method === 'GET')
    return ok(page(filter(o.state.approvals.filter((p) => p.ownerId === actor.id)), params, empty))
  const approval = path.match(/^\/approvals\/([^/]+)$/)
  if (approval && method === 'POST') return ok(o.decide(actor, approval[1], await payload()))
  if (path === '/payments' && method === 'GET') {
    const rows = o
      .branches(actor)
      .filter((b) => !scope || b.id === scope)
      .flatMap((b) => paymentViews(o.e, b.id).map((p) => ({ ...p, branchName: b.name })))
      .filter(
        (p) =>
          (!params.get('environment') || p.environment === params.get('environment')) &&
          (!params.get('targetType') || p.targetType === params.get('targetType')) &&
          (!params.get('month') || p.createdAt.startsWith(params.get('month')!)),
      )
    return ok(
      page(
        filter(rows).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        params,
        empty,
      ),
    )
  }
  if (path === '/activity' && method === 'GET')
    return ok(
      page(
        filter(o.state.activity.filter((a) => a.ownerId === actor.id)).filter(
          (a) =>
            (!params.get('type') || a.type === params.get('type')) &&
            (!params.get('month') || a.at.startsWith(params.get('month')!)),
        ),
        params,
        empty,
      ),
    )
  throw new MockError('Không tìm thấy API chủ trọ.', 404)
}
