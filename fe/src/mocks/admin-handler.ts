import { HttpResponse } from 'msw'
import type { User } from '@/interfaces/domain'
import { userSchema } from '@/interfaces/domain'
import { adminDb as a, adminUser } from './admin-engine'
import { MockError } from './database'
import { z } from 'zod'
const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status, code: 0, message: 'Thành công', data }, { status })
function page<T>(rows: T[], params: URLSearchParams, empty: boolean, spring = false) {
  const index = Number(params.get('page') || 0),
    size = Number(params.get('size') || 20)
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(size) || size < 1 || size > 100)
    throw new MockError('Phân trang chưa hợp lệ.', 422)
  const items = empty ? [] : rows
  return {
    content: items.slice(index * size, (index + 1) * size),
    number: spring ? index : index + 1,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  }
}
export async function handleAdmin(request: Request, actor: User, empty = false) {
  const path = new URL(request.url).pathname.replace('/__mock', ''),
    params = new URL(request.url).searchParams,
    method = request.method
  a.authorize(actor)
  if (path === '/api/users') {
    if (method === 'GET') return ok(page(a.users(actor, params), params, empty, true))
    if (method === 'POST') return ok(a.create(actor, await request.json()), 201)
  }
  const user = path.match(/^\/api\/users\/([^/]+)(\/active-status)?$/)
  if (user) {
    if (method === 'GET' && !user[2]) return ok(a.project(user[1]))
    if (method === 'PATCH' && user[2]) return ok(a.status(actor, user[1], await request.json()))
    throw new MockError('Thao tác tài khoản không được hỗ trợ.', 405)
  }
  if (path === '/api/admin/entitlements' && method === 'GET')
    return ok({
      user: userSchema.parse(a.o.canonical(actor)),
      permissions: ['USERS', 'OWNER_REVIEW', 'DIRECTORIES', 'AUDIT'],
    })
  if (path === '/api/admin/dashboard' && method === 'GET') return ok(a.summary(actor))
  if (path === '/api/admin/roles' && method === 'GET') return ok(a.roles(actor))
  if (path === '/api/admin/owners' && method === 'GET')
    return ok(page(a.owners(actor, params), params, empty))
  if (path === '/api/admin/branches' && method === 'GET')
    return ok(page(a.branches(actor, params), params, empty))
  if (path === '/api/admin/owner-verifications' && method === 'GET') {
    const from = params.get('from'),
      to = params.get('to')
    if (
      [from, to].some((v) => v && !z.iso.date().safeParse(v).success) ||
      (from && to && from > to)
    )
      throw new MockError('Khoảng ngày nộp hồ sơ không hợp lệ.', 422)
    const rows = a
      .users(actor, new URLSearchParams({ q: params.get('q') || '' }))
      .map((u) => a.review(actor, u.id))
      .filter(
        (r) =>
          (!params.get('status') || r.verification.status === params.get('status')) &&
          (!params.get('from') ||
            (!!r.verification.submittedAt &&
              r.verification.submittedAt.slice(0, 10) >= params.get('from')!)) &&
          (!params.get('to') ||
            (!!r.verification.submittedAt &&
              r.verification.submittedAt.slice(0, 10) <= params.get('to')!)),
      )
    return ok(page(rows, params, empty))
  }
  const review = path.match(
    /^\/api\/admin\/owner-verifications\/([^/]+)(?:\/(decision|document))?$/,
  )
  if (review) {
    if (method === 'GET' && !review[2]) return ok(a.review(actor, review[1]))
    if (method === 'GET' && review[2] === 'document') return ok(a.document(actor, review[1]))
    if (method === 'POST' && review[2] === 'decision')
      return ok(a.decide(actor, review[1], await request.json()))
  }
  if (path === '/api/admin/activity' && method === 'GET')
    return ok(page(a.activity(actor, params), params, empty))
  const event = path.match(/^\/api\/admin\/activity\/([^/]+)$/)
  if (event && method === 'GET') {
    const record = a.activity(actor, new URLSearchParams()).find((v) => v.id === event[1])
    if (!record) throw new MockError('Không tìm thấy sự kiện được phép.', 404)
    return ok(record)
  }
  if (path === '/api/admin/demo/reset' && method === 'POST' && import.meta.env.DEV) {
    if (actor.id !== adminUser.id) throw new MockError('Công cụ dành cho quản trị viên demo.', 403)
    return ok(a.reset(actor))
  }
  throw new MockError('Không tìm thấy API quản trị.', 404)
}
