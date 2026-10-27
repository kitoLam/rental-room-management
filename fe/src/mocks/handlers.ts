import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import { db, MockError } from './database'
import { demoUser } from './fixtures'
import { tenantUser, roommateUser } from './tenant-fixtures'
import { handleTenant } from './tenant-handler'
import { provider } from '@/services/config'
import { managerUser, ownerUser, otherManager } from './manager-fixtures'
import { managerDb } from './manager-engine'
import { handleManager } from './manager-handler'
import { handleOwner } from './owner-handler'
import { ownerDb, otherOwner } from './owner-engine'
import { adminDb, adminUser, secondAdmin, applicant } from './admin-engine'
import { handleAdmin } from './admin-handler'
import { inventory } from './inventory'
import {
  addDays,
  emailField,
  loginSchema,
  passwordField,
  profileSchema,
  registerSchema,
} from '@/lib/validation'
import {
  userSchema,
  type AppointmentInput,
  type BookingInput,
  type PaymentScenario,
  type RoomFilters,
  type User,
} from '@/interfaces/domain'

const ok = (data: unknown = null, status = 200) =>
  HttpResponse.json({ status, code: 0, message: 'Thành công', data }, { status })
async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
}
function session(user: User) {
  if (user.roles.some(r=>r==='MANAGER'||r==='OWNER')) { managerDb.tenant.state.workflowMode='managed'; managerDb.save() }
  const accessToken = `mock-${crypto.randomUUID()}`
  db.state.sessions[accessToken] = user.id
  db.state.refreshUserId = user.id
  db.save()
  return { accessToken, expiresIn: 900, user: userSchema.parse(user) }
}
function current(request: Request): User {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  const userId = token ? db.state.sessions[token] : null
  if (userId) {
    const user = db.state.users.find((u) => u.id === userId && u.status === 'ACTIVE')
    if (user) return user
  }
  // Explicit bridge for hybrid demo features. This identity never reaches a real endpoint.
  const identity = request.headers.get('X-TroPro-Demo-Identity')
  if (identity && provider('auth') === 'real') {
    const parsed = userSchema.safeParse(JSON.parse(decodeURIComponent(identity)))
    if (parsed.success) {
      if (
        [
          demoUser.id,
          tenantUser.id,
          roommateUser.id,
          managerUser.id,
          ownerUser.id,
          otherManager.id,
          otherOwner.id,
          adminUser.id,
          secondAdmin.id,
          applicant.id,
        ].includes(parsed.data.id)
      )
        throw new MockError('Danh tính demo cần đăng nhập bằng provider mock.', 401)
      let user = db.state.users.find((u) => u.id === parsed.data.id)
      if (!user) {
        user = { ...parsed.data, roles: ['USER'] }
        db.state.users.push(user)
        db.save()
      }
      if (user.status !== 'ACTIVE')
        throw new MockError('Tài khoản không còn được phép truy cập.', 401)
      return user
    }
  }
  throw new MockError('Vui lòng đăng nhập để tiếp tục.', 401)
}
function paging<T>(data: T[], params: URLSearchParams) {
  const page = Number(params.get('page') || 0)
  const size = Number(params.get('size') || 6)
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100)
    throw new MockError('Phân trang chưa hợp lệ.')
  return {
    content: data.slice(page * size, (page + 1) * size),
    number: page + 1,
    size,
    totalElements: data.length,
    totalPages: Math.ceil(data.length / size),
  }
}
export const handlers = [
  http.all('*/__mock/*', async ({ request }) => {
    await delay(280)
    const url = new URL(request.url)
    const path = url.pathname.replace('/__mock', '')
    const params = url.searchParams
    const method = request.method
    const scenario = request.headers.get('X-TroPro-Demo-Scenario')
    if (scenario === 'loading') await delay(7000)
    if (scenario === 'error')
      return HttpResponse.json(
        { status: 500, code: 500, message: 'Máy chủ demo đang gặp sự cố.' },
        { status: 500 },
      )
    try {
      db.tick()
      for (const demo of [
        tenantUser, roommateUser, managerUser, ownerUser, otherManager,
        adminUser, secondAdmin, applicant,
      ])
        if (!db.state.users.some((u) => u.id === demo.id)) db.state.users.push(structuredClone(demo))
      const payload = async <T>() => (await request.json()) as T
      if (path === '/api/auth/login') {
        const input = loginSchema.parse(await payload())
        const user = db.state.users.find((u) => u.email.toLowerCase() === input.email.toLowerCase())
        const matches =
          user &&
          (user.passwordHash
            ? user.passwordHash === (await hash(input.password))
            : [
                demoUser.id,
                tenantUser.id,
                roommateUser.id,
                managerUser.id,
                ownerUser.id,
                otherManager.id,
                otherOwner.id,
                adminUser.id,
                secondAdmin.id,
                applicant.id,
              ].includes(user.id) && input.password === 'TroPro@123')
        if (!user || !matches) throw new MockError('Email hoặc mật khẩu chưa đúng.', 401)
        if (user.status !== 'ACTIVE')
          throw new MockError(
            ['DISABLED', 'LOCKED'].includes(user.status)
              ? 'Tài khoản đã ngừng kích hoạt hoặc bị khóa.'
              : 'Vui lòng xác minh email trước khi đăng nhập.',
            403,
          )
        return ok(session(user))
      }
      if (path === '/api/auth/refresh') {
        const user = db.state.users.find(
          (u) => u.id === db.state.refreshUserId && u.status === 'ACTIVE',
        )
        if (!user) throw new MockError('Chưa có phiên đăng nhập.', 401)
        return ok(session(user))
      }
      if (path === '/api/auth/logout') {
        const user = current(request)
        Object.entries(db.state.sessions).forEach(([key, id]) => {
          if (id === user.id) delete db.state.sessions[key]
        })
        db.state.refreshUserId = null
        db.save()
        return ok()
      }
      if (path === '/api/auth/register') {
        const raw = await payload<{ fullName: string; email: string; password: string }>()
        const input = registerSchema.parse({ ...raw, confirmPassword: raw.password })
        if (db.state.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase()))
          throw new MockError('Email này đã được đăng ký.', 409)
        const user = {
          id: crypto.randomUUID(),
          email: input.email.toLowerCase(),
          fullName: input.fullName,
          roles: ['USER'] as User['roles'],
          status: 'PENDING_VERIFICATION' as const,
          phone: null,
          dateOfBirth: null,
          gender: null,
          passwordHash: await hash(input.password),
        }
        db.state.users.push(user)
        db.state.challenges.push({
          token: crypto.randomUUID(),
          userId: user.id,
          purpose: 'verify',
          expiresAt: Date.now() + 1800000,
        })
        db.save()
        return ok(null, 202)
      }
      if (path === '/api/auth/verify-email') {
        const input = z.object({ token: z.string().min(1) }).parse(await payload())
        const challenge = db.state.challenges.find(
          (c) => c.token === input.token && c.purpose === 'verify' && c.expiresAt > Date.now(),
        )
        if (!challenge) throw new MockError('Liên kết xác minh không hợp lệ hoặc đã hết hạn.', 400)
        const user = db.state.users.find((u) => u.id === challenge.userId)!
        user.status = 'ACTIVE'
        db.state.challenges = db.state.challenges.filter((c) => c.userId !== user.id)
        db.save()
        return ok()
      }
      if (path === '/api/demo/mailbox' && method === 'GET') {
        const email = params.get('email')
        const user = db.state.users.find((u) => u.email === email)
        const challenge = db.state.challenges.find(
          (c) => c.userId === user?.id && c.expiresAt > Date.now(),
        )
        return ok(
          challenge
            ? {
                href: `${challenge.purpose === 'verify' ? '/verify-email' : '/reset-password'}?token=${encodeURIComponent(challenge.token)}`,
                purpose: challenge.purpose,
              }
            : null,
        )
      }
      if (path === '/api/auth/forgot-password') {
        const input = z.object({ email: emailField }).parse(await payload())
        const user = db.state.users.find((u) => u.email === input.email.toLowerCase())
        if (user) {
          db.state.challenges = db.state.challenges.filter((c) => c.userId !== user.id)
          db.state.challenges.push({
            token: crypto.randomUUID(),
            userId: user.id,
            purpose: 'reset',
            expiresAt: Date.now() + 1800000,
          })
          db.save()
        }
        return ok()
      }
      if (path === '/api/auth/reset-password') {
        const input = z
          .object({ token: z.string(), password: passwordField })
          .parse(await payload())
        const challenge = db.state.challenges.find(
          (c) => c.token === input.token && c.purpose === 'reset' && c.expiresAt > Date.now(),
        )
        if (!challenge)
          throw new MockError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 400)
        const user = db.state.users.find((u) => u.id === challenge.userId)!
        user.passwordHash = await hash(input.password)
        db.state.challenges = db.state.challenges.filter((c) => c.userId !== user.id)
        Object.entries(db.state.sessions).forEach(([key, id]) => {
          if (id === user.id) delete db.state.sessions[key]
        })
        if (db.state.refreshUserId === user.id) db.state.refreshUserId = null
        db.save()
        return ok()
      }
      if (path === '/api/v1/public/room-types')
        return ok(inventory.state.types.filter((t) => t.active))
      if (path === '/api/v1/public/rooms') {
        const filters: RoomFilters = {
          q: params.get('address') || '',
          area: params.get('area') || '',
          mode: (params.get('rentalMode') || 'ALL') as RoomFilters['mode'],
          minPrice: params.has('minPrice') ? Number(params.get('minPrice')) : undefined,
          maxPrice: params.has('maxPrice') ? Number(params.get('maxPrice')) : undefined,
          minCapacity: params.has('minCapacity') ? Number(params.get('minCapacity')) : undefined,
          roomTypeId: params.get('roomTypeId') || '',
          availableOnly: params.get('availableOnly') === 'true',
          sort: params.get('sort') || 'recommended',
          page: Number(params.get('page') || 0),
          branchId: params.get('branchId') || undefined,
        }
        if (
          (filters.minPrice !== undefined &&
            (!Number.isFinite(filters.minPrice) || filters.minPrice < 0)) ||
          (filters.maxPrice !== undefined &&
            (!Number.isFinite(filters.maxPrice) || filters.maxPrice < 0)) ||
          (filters.minPrice !== undefined &&
            filters.maxPrice !== undefined &&
            filters.minPrice > filters.maxPrice)
        )
          throw new MockError('Khoảng giá chưa hợp lệ.')
        return ok(paging(scenario === 'empty' ? [] : db.listRooms(filters), params))
      }
      const availability = path.match(/^\/api\/v1\/public\/rooms\/([^/]+)\/availability$/)
      if (availability)
        return ok(
          db.availability(
            availability[1],
            params.get('startDate') || addDays(0),
            params.get('endDate') || addDays(1),
          ),
        )
      const room = path.match(/^\/api\/v1\/public\/rooms\/([^/]+)$/)
      if (room) {
        if(!db.room(room[1]).isPublic || !db.branchVisible(db.room(room[1]).branchId))throw new MockError('Phòng không còn được công khai.',404)
        return ok(
          db
            .listRooms({
              q: '',
              area: '',
              mode: 'ALL',
              roomTypeId: '',
              availableOnly: false,
              sort: 'recommended',
              page: 1,
            })
            .find((r) => r.id === room[1]),
        )
      }
      const policy = path.match(/^\/api\/v1\/public\/branches\/([^/]+)\/policy$/)
      if (policy) { if(!db.branchVisible(policy[1])) throw new MockError('Chi nhánh không công khai.',404); return ok(db.policy(policy[1])) }
      const branch = path.match(/^\/api\/v1\/public\/branches\/([^/]+)$/)
      if (branch) return ok(db.branch(branch[1]))
      const user = current(request)
      if (path === '/api/users' || path.startsWith('/api/users/') || path.startsWith('/api/admin/'))
        return await handleAdmin(request, user, scenario === 'empty')
      if (path.startsWith('/api/tenant/'))
        return await handleTenant(request, user.id, scenario === 'empty')
      if (path.startsWith('/api/manager/')) return await handleManager(request,user,scenario==='empty')
      if (path.startsWith('/api/owner/')) return await handleOwner(request,user,scenario==='empty')
      if (path === '/api/me') {
        if (method === 'PATCH') {
          const input = profileSchema.parse(await payload())
          Object.assign(user, {
            ...input,
            phone: input.phone || null,
            dateOfBirth: input.dateOfBirth || null,
            gender: input.gender || null,
          })
          db.save()
        }
        return ok(userSchema.parse(user))
      }
      if (path === '/api/appointments') {
        if (method === 'POST')
          return ok(db.createAppointment(await payload<AppointmentInput>(), user.id), 201)
        return ok(
          paging(
            scenario === 'empty'
              ? []
              : db.state.appointments.filter(
                  (a) =>
                    a.requesterUserId === user.id &&
                    (!params.get('status') || a.status === params.get('status')),
                ),
            params,
          ),
        )
      }
      const appointment = path.match(/^\/api\/appointments\/([^/]+)(\/cancel|\/demo-response)?$/)
      if (appointment) {
        if (appointment[2] === '/cancel' && method === 'POST')
          return ok(db.cancelAppointment(appointment[1], user.id))
        const record = db.own(db.state.appointments, appointment[1], user.id)
        if (appointment[2] === '/demo-response' && method === 'POST') {
          if (record.status !== 'PENDING') throw new MockError('Lịch hẹn đã được xử lý.', 409)
          const input = z
            .object({ status: z.enum(['CONFIRMED', 'REJECTED']) })
            .parse(await payload())
          record.status = input.status
          record.assignedManager = input.status === 'CONFIRMED' ? 'Quản lý chi nhánh (demo)' : null
          record.timeline.push({
            status: input.status,
            at: new Date().toISOString(),
            note: 'Phản hồi của chi nhánh trong mô phỏng.',
          })
          db.notify(
            user.id,
            input.status === 'CONFIRMED'
              ? 'Chi nhánh đã xác nhận lịch hẹn'
              : 'Chi nhánh chưa thể nhận lịch hẹn',
            'Xem chi tiết để kiểm tra trạng thái.',
            'APPOINTMENT',
            record.id,
          )
          db.save()
        }
        return ok(record)
      }
      if (path === '/api/bookings') {
        if (method === 'POST')
          return ok(db.createBooking(await payload<BookingInput>(), user.id), 201)
        return ok(
          paging(
            scenario === 'empty'
              ? []
              : db.state.bookings.filter(
                  (b) =>
                    b.requesterUserId === user.id &&
                    (!params.get('status') || b.status === params.get('status')),
                ),
            params,
          ),
        )
      }
      const booking = path.match(/^\/api\/bookings\/([^/]+)(\/cancel|\/payments)?$/)
      if (booking) {
        if (booking[2] === '/cancel' && method === 'POST')
          return ok(db.cancelBooking(booking[1], user.id))
        const record = db.own(db.state.bookings, booking[1], user.id)
        if (booking[2] === '/payments') {
          if (method === 'POST') {
            const input = z
              .object({ scenario: z.enum(['success', 'failure', 'pending', 'late']) })
              .parse(await payload())
            return ok(
              db.initiatePayment(record.id, user.id, input.scenario as PaymentScenario),
              201,
            )
          }
          return ok(db.state.payments.filter((p) => p.bookingId === record.id))
        }
        return ok(record)
      }
      if (path === '/api/notifications/unread-count')
        return ok({ count: db.notifications(user.id).filter((n) => !n.read).length })
      if (path === '/api/notifications/mark-all-read' && method === 'PUT') {
        db.state.notifications
          .filter((n) => n.recipientUserId === user.id)
          .forEach((n) => {
            n.read = true
          })
        db.save()
        return ok()
      }
      if (path === '/api/notifications/mark-read' && method === 'PUT') {
        const input = z
          .object({ notificationIds: z.array(z.string().uuid()).min(1) })
          .parse(await payload())
        const records = input.notificationIds.map((id) => {
          const n = db.state.notifications.find((v) => v.id === id)
          if (!n) throw new MockError('Không tìm thấy thông báo.', 404)
          if (n.recipientUserId !== user.id)
            throw new MockError('Bạn không có quyền đọc thông báo này.', 403)
          return n
        })
        records.forEach((n) => {
          n.read = true
        })
        db.save()
        return ok(records)
      }
      if (path === '/api/notifications')
        return ok(
          paging(
            scenario === 'empty'
              ? []
              : db
                  .notifications(user.id)
                  .filter((n) => !params.has('read') || n.read === (params.get('read') === 'true'))
                  .filter((n) => !params.has('type') || n.type === params.get('type')),
            params,
          ),
        )
      throw new MockError('API chưa có trong bản mô phỏng.', 404)
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? path.startsWith('/api/manager/') ? 'Dữ liệu quản lý chưa hợp lệ. Kiểm tra các mục đã nhập.' : error.issues[0].message
          : error instanceof MockError
            ? error.message
            : 'Không thể xử lý yêu cầu mô phỏng.'
      const status =
        error instanceof MockError ? error.status : error instanceof z.ZodError ? 422 : 500
      return HttpResponse.json({ status, code: status, message, data: null }, { status })
    } finally {
      try {
        managerDb.transaction(() => {
          managerDb.scanInbox()
          ownerDb.scanActivity()
          adminDb.scan()
        })
      } catch {/* A failed inbox persistence must not replace the API response. */}
    }
  }),
]
