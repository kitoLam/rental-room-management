import { z } from 'zod'
import type { User } from '@/interfaces/domain'
import { auditSchema, userCreateSchema, type AdminAudit, type AdminState } from '@/interfaces/admin'
import { OwnerEngine, ownerDb } from './owner-engine'
import { MockError } from './database'
import { fixtureId, demoUser } from './fixtures'
import { managerUser, ownerUser, otherManager } from './manager-fixtures'
import { tenantUser, roommateUser } from './tenant-fixtures'
const stamp = () => new Date().toISOString()
export const adminUser: User = {
  ...demoUser,
  id: fixtureId(8000),
  email: 'admin@tropro.demo',
  fullName: 'Nguyễn Thảo Vy',
  phone: '+84900008000',
  roles: ['USER', 'ADMIN'],
}
export const secondAdmin: User = {
  ...adminUser,
  id: fixtureId(8001),
  email: 'admin-reviewer@tropro.demo',
  fullName: 'Trần Đức Khang',
  phone: '+84900008001',
}
export const applicant: User = {
  ...demoUser,
  id: fixtureId(8002),
  email: 'applicant@tropro.demo',
  fullName: 'Lâm Ngọc Mai',
  phone: '+84900008002',
}
const seedIds = [
  demoUser,
  managerUser,
  ownerUser,
  otherManager,
  tenantUser,
  roommateUser,
  adminUser,
  secondAdmin,
  applicant,
]
  .map((u) => u.id)
  .concat(fixtureId(7003))
const roleDescriptions = [
  {
    id: 'USER',
    name: 'Người dùng',
    description: 'Tìm chỗ ở, đặt lịch xem và giữ phòng.',
    scope: 'Yêu cầu và hồ sơ của chính mình.',
    requirement: 'Tài khoản hợp lệ; kiểm tra chủ thể của từng tài nguyên.',
  },
  {
    id: 'TENANT',
    name: 'Người thuê',
    description: 'Theo dõi hợp đồng và nghĩa vụ thuê cá nhân.',
    scope: 'Quan hệ ContractTenant được phép.',
    requirement: 'Quan hệ thuê hợp lệ; role không tự tạo quyền xem hợp đồng.',
  },
  {
    id: 'MANAGER',
    name: 'Quản lý',
    description: 'Vận hành các chi nhánh được phân công.',
    scope: 'OwnerManager và Branch.managerId hiện hành.',
    requirement: 'Phân công hợp lệ, cùng chủ trọ; lời mời chưa tạo quyền chi nhánh.',
  },
  {
    id: 'OWNER',
    name: 'Chủ trọ',
    description: 'Quản trị các chi nhánh sở hữu.',
    scope: 'Branch.ownerId và quan hệ thuộc chủ trọ.',
    requirement: 'Hồ sơ được duyệt và quyền OWNER do quy trình danh tính cấp.',
  },
  {
    id: 'ADMIN',
    name: 'Quản trị viên',
    description: 'Quản trị tài khoản, xét duyệt hồ sơ và xem hoạt động được phép.',
    scope: 'Các tài nguyên quản trị được cấp rõ ràng.',
    requirement: 'Tài khoản ACTIVE và quyền ADMIN; không tự có quyền vận hành tài chính.',
  },
] as const
export class AdminEngine {
  constructor(public o: OwnerEngine) {
    this.seed()
    this.ensure()
  }
  get e() {
    return this.o.e
  }
  seed() {
    for (const u of [adminUser, secondAdmin, applicant])
      if (!this.e.db.state.users.some((v) => v.id === u.id))
        this.e.db.state.users.push(structuredClone(u))
  }
  ensure() {
    if (!this.e.state.admin) {
      this.seed()
      this.e.state.admin = { metadata: {}, events: [], observed: [] }
      if (!this.o.state.verification.some((v) => v.userId === applicant.id))
        this.o.state.verification.push({
          userId: applicant.id,
          status: 'PENDING',
          fullName: applicant.fullName,
          phone: applicant.phone,
          contactVerified: true,
          submittedAt: stamp(),
          reviewedAt: null,
          reason: null,
          document: {
            name: 'ho-so-mau.png',
            mime: 'image/png',
            size: 100,
            resourceId: `mock-private/${applicant.id}`,
          },
          eligible: false,
        })
    }
    for (const u of this.e.db.state.users)
      if (!this.e.state.admin.metadata[u.id])
        this.e.state.admin.metadata[u.id] = {
          createdAt: stamp(),
          version: 1,
          contactVerified:
            u.status === 'ACTIVE' || (seedIds.includes(u.id) && u.status === 'DISABLED'),
        }
      else if (u.status === 'ACTIVE') this.e.state.admin.metadata[u.id].contactVerified = true
  }
  get state(): AdminState {
    this.ensure()
    return this.e.state.admin!
  }
  authorize(actor: User) {
    const canonical = this.o.canonical(actor)
    if (!canonical.roles.includes('ADMIN'))
      throw new MockError('Chỉ quản trị viên được truy cập tài nguyên này.', 403)
    return canonical
  }
  target(id: string) {
    const u = this.e.db.state.users.find((u) => u.id === id)
    if (!u) throw new MockError('Không tìm thấy tài khoản.', 404)
    return u
  }
  credentials(id: string) {
    return seedIds.includes(id) || !!this.target(id).passwordHash
  }
  project(id: string) {
    const u = this.target(id),
      meta = this.state.metadata[id]
    // Projection only: credentials and verification secrets never leave this boundary.
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email || null,
      phone: u.phone,
      status: u.status,
      createdAt: meta.createdAt,
      roles: [...u.roles],
      version: meta.version,
      canActivate: u.status === 'DISABLED' && this.credentials(u.id) && meta.contactVerified,
      contactVerified: meta.contactVerified || u.status === 'ACTIVE',
      ownerVerificationStatus:
        this.o.state.verification.find((v) => v.userId === u.id)?.status ||
        ('NOT_SUBMITTED' as const),
      ownerReviewedAt: this.o.state.verification.find((v) => v.userId === u.id)?.reviewedAt || null,
      scope: {
        ownedBranches: this.e.state.branches.filter((b) => b.ownerId === u.id).length,
        assignedBranches: this.e.state.branches.filter((b) => b.managerId === u.id).length,
        tenancies: this.e.tenant.state.tenancies.filter((t) => t.userId === u.id).length,
      },
    }
  }
  users(actor: User, params: URLSearchParams) {
    this.authorize(actor)
    const from = params.get('from'),
      to = params.get('to')
    for (const value of [from, to])
      if (value && !z.iso.date().safeParse(value).success)
        throw new MockError('Ngày lọc chưa hợp lệ.', 422)
    if (from && to && from > to) throw new MockError('Ngày kết thúc phải sau ngày bắt đầu.', 422)
    return this.e.db.state.users
      .map((u) => this.project(u.id))
      .filter(
        (u) =>
          (!params.get('q') ||
            `${u.id} ${u.fullName} ${u.email || ''} ${u.phone || ''}`
              .toLocaleLowerCase('vi')
              .includes(params.get('q')!.toLocaleLowerCase('vi'))) &&
          (!params.get('status') || u.status === params.get('status')) &&
          (!params.get('role') || u.roles.includes(params.get('role') as User['roles'][number])) &&
          (!from || u.createdAt.slice(0, 10) >= from) &&
          (!to || u.createdAt.slice(0, 10) <= to),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  record(
    actor: User,
    action: string,
    targetId: string,
    summary: string,
    reason: string | null,
    detail: AdminAudit['detail'],
    requestKey: string | null = null,
    tableName: AdminAudit['tableName'] = 'users',
  ) {
    const event = auditSchema.parse({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      actorName: actor.fullName,
      tableName,
      entityId: targetId,
      action,
      summary,
      reason,
      detail,
      requestKey,
      occurredAt: stamp(),
    })
    this.state.events.unshift(event)
    return event
  }
  create(actor: User, input: unknown) {
    const trusted = this.authorize(actor)
    const raw = z
      .object({
        fullName: z.unknown(),
        email: z.unknown().optional(),
        phone: z.unknown().optional(),
        dateOfBirth: z.unknown().optional(),
        gender: z.unknown().optional(),
      })
      .strict()
      .parse(input)
    const data = userCreateSchema.parse({
        ...raw,
        email: raw.email ?? '',
        phone: raw.phone ?? '',
        dateOfBirth: raw.dateOfBirth ?? '',
        gender: raw.gender ?? '',
      }),
      email = data.email.toLowerCase(),
      phone = data.phone.trim()
    if (
      this.e.db.state.users.some(
        (u) => (email && u.email.toLowerCase() === email) || (phone && u.phone === phone),
      )
    )
      throw new MockError('Email hoặc điện thoại đã được sử dụng.', 409)
    return this.e.transaction(() => {
      const u: User = {
        id: crypto.randomUUID(),
        fullName: data.fullName,
        email,
        phone: phone || null,
        status: 'INVITED',
        roles: ['USER'],
        dateOfBirth: data.dateOfBirth || null,
        gender: data.gender || null,
      }
      this.e.db.state.users.push(u)
      this.state.metadata[u.id] = { createdAt: stamp(), version: 1, contactVerified: false }
      this.record(trusted, 'USER_INVITED', u.id, 'Tạo tài khoản được mời.', null, {
        status: 'INVITED',
      })
      return this.project(u.id)
    })
  }
  status(actor: User, id: string, input: unknown) {
    const trusted = this.authorize(actor),
      data = z
        .object({
          active: z.boolean(),
          version: z.number().int().optional(),
          reason: z.string().trim().max(1000).optional(),
        })
        .strict()
        .parse(input),
      target = this.target(id),
      meta = this.state.metadata[id]
    if (data.version !== undefined && data.version !== meta.version)
      throw new MockError('Tài khoản đã thay đổi. Tải lại trước khi xác nhận.', 409)
    if (!data.active && trusted.id === id)
      throw new MockError('Không thể tự vô hiệu hóa tài khoản quản trị đang dùng.', 403)
    if (
      !data.active &&
      target.roles.includes('ADMIN') &&
      this.e.db.state.users.filter((u) => u.roles.includes('ADMIN') && u.status === 'ACTIVE')
        .length <= 1
    )
      throw new MockError('Cần giữ ít nhất một quản trị viên đang hoạt động.', 409)
    if (data.active && !this.project(id).canActivate)
      throw new MockError(
        'Tài khoản chưa có thông tin đăng nhập, xác minh hợp lệ hoặc cần quy trình mở khóa riêng.',
        409,
      )
    if (!data.active && target.status !== 'ACTIVE')
      throw new MockError('Chỉ ngừng kích hoạt tài khoản đang hoạt động.', 409)
    return this.e.transaction(() => {
      const previousStatus = target.status
      target.status = data.active ? 'ACTIVE' : 'DISABLED'
      meta.version++
      if (!data.active) {
        for (const [token, userId] of Object.entries(this.e.db.state.sessions))
          if (userId === id) delete this.e.db.state.sessions[token]
        if (this.e.db.state.refreshUserId === id) this.e.db.state.refreshUserId = null
      }
      const event = this.record(
        trusted,
        data.active ? 'USER_ACTIVATED' : 'USER_DISABLED',
        id,
        data.active ? 'Kích hoạt lại tài khoản.' : 'Ngừng kích hoạt tài khoản.',
        data.reason || null,
        { previousStatus, status: target.status },
      )
      this.e.db.notify(
        id,
        'Trạng thái tài khoản thay đổi',
        data.active ? 'Tài khoản đã được kích hoạt lại.' : 'Tài khoản đã ngừng kích hoạt.',
        'ACCOUNT_STATUS',
        id,
      )
      this.notifyAdmins('Trạng thái tài khoản thay đổi', event.summary, 'ADMIN_USER', id)
      return this.project(id)
    })
  }
  notifyAdmins(title: string, message: string, type: string, id: string) {
    for (const admin of this.e.db.state.users.filter(
      (u) => u.status === 'ACTIVE' && u.roles.includes('ADMIN'),
    ))
      this.e.db.notify(admin.id, title, message, type, id)
  }
  review(actor: User, id: string) {
    this.authorize(actor)
    const user = this.project(id),
      target = this.target(id),
      verification = this.o.verificationForAdmin(target)
    const history = this.state.events.filter(
      (a) => a.entityId === id && a.action.startsWith('OWNER_'),
    )
    return {
      user,
      verification,
      version: [
        verification.submittedAt,
        verification.document?.resourceId,
        verification.status,
        verification.reviewedAt,
      ].join('|'),
      reviewerName: verification.reviewedBy
        ? this.e.db.state.users.find((u) => u.id === verification.reviewedBy)?.fullName ||
          'Quản trị viên'
        : null,
      history,
    }
  }
  decide(actor: User, id: string, input: unknown) {
    const trusted = this.authorize(actor),
      data = z
        .object({
          decision: z.enum(['APPROVED', 'REJECTED']),
          reason: z.string().trim().min(10, 'Nhập lý do ít nhất 10 ký tự.').max(2000),
          version: z.string().min(1),
        })
        .strict()
        .parse(input),
      snapshot = this.review(trusted, id)
    if (trusted.id === id) throw new MockError('Không được tự xét duyệt hồ sơ của mình.', 403)
    if (snapshot.version !== data.version || snapshot.verification.status !== 'PENDING')
      throw new MockError('Hồ sơ đã thay đổi hoặc đã được xét duyệt.', 409)
    if (
      snapshot.user.status !== 'ACTIVE' ||
      !snapshot.verification.document ||
      !snapshot.verification.contactVerified
    )
      throw new MockError('Hồ sơ chưa đủ điều kiện xét duyệt.', 409)
    return this.e.transaction(() => {
      this.o.adminDecision(
        trusted,
        id,
        data.decision === 'APPROVED',
        data.reason,
        data.decision === 'APPROVED',
      )
      this.state.metadata[id].version++
      const event = this.record(
        trusted,
        data.decision === 'APPROVED' ? 'OWNER_APPROVED' : 'OWNER_REJECTED',
        id,
        data.decision === 'APPROVED'
          ? 'Duyệt hồ sơ và cấp quyền chủ trọ qua quy trình danh tính.'
          : 'Từ chối hồ sơ chủ trọ.',
        data.reason,
        { verificationStatus: data.decision, provisionedOwner: data.decision === 'APPROVED' },
        crypto.randomUUID(),
      )
      this.notifyAdmins('Đã ghi nhận xét duyệt chủ trọ', event.summary, 'ADMIN_VERIFICATION', id)
      return this.review(trusted, id)
    })
  }
  document(actor: User, id: string) {
    const review = this.review(actor, id)
    if (!review.verification.document) throw new MockError('Hồ sơ chưa có tài liệu.', 404)
    return {
      mime: 'image/svg+xml' as const,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      content:
        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460" viewBox="0 0 720 460"><rect width="720" height="460" fill="#f8fafc"/><rect x="40" y="40" width="640" height="380" rx="12" fill="white" stroke="#cbd5e1"/><text x="80" y="115" font-family="sans-serif" font-size="28" fill="#0f766e">TROPRO — TÀI LIỆU MẪU</text><text x="80" y="180" font-family="sans-serif" font-size="20" fill="#334155">Bản xem trước giả lập dành cho kiểm thử.</text><text x="80" y="225" font-family="sans-serif" font-size="20" fill="#334155">Không chứa giấy tờ hoặc thông tin định danh thật.</text><path d="M80 290H590M80 325H500M80 360H550" stroke="#e2e8f0" stroke-width="12"/></svg>',
    }
  }
  roles(actor: User) {
    this.authorize(actor)
    return roleDescriptions.map((r) => ({
      ...r,
      userCount: this.e.db.state.users.filter((u) => u.roles.includes(r.id)).length,
    }))
  }
  owners(actor: User, params: URLSearchParams) {
    this.authorize(actor)
    return this.users(actor, new URLSearchParams())
      .filter((u) => u.roles.includes('OWNER'))
      .filter(
        (u) =>
          (!params.get('q') ||
            `${u.fullName} ${u.email || ''}`
              .toLowerCase()
              .includes(params.get('q')!.toLowerCase())) &&
          (!params.get('status') || u.ownerVerificationStatus === params.get('status')),
      )
  }
  branches(actor: User, params: URLSearchParams) {
    this.authorize(actor)
    return this.e.state.branches
      .map((b) => ({
        id: b.id,
        code: this.o.state.metadata[b.id].code,
        name: b.name,
        province: this.o.state.metadata[b.id].province,
        address: b.address,
        status: b.status,
        ownerId: b.ownerId,
        ownerName: this.target(b.ownerId).fullName,
        managerId: b.managerId,
        managerName: b.managerName || null,
        createdAt: null,
      }))
      .filter(
        (b) =>
          (!params.get('q') ||
            `${b.code} ${b.name} ${b.address}`
              .toLowerCase()
              .includes(params.get('q')!.toLowerCase())) &&
          (!params.get('status') || b.status === params.get('status')) &&
          (!params.get('ownerId') || b.ownerId === params.get('ownerId')) &&
          (!params.get('province') || b.province.includes(params.get('province')!)),
      )
  }
  activity(actor: User, params: URLSearchParams) {
    this.authorize(actor)
    const from = params.get('from'),
      to = params.get('to')
    for (const value of [from, to])
      if (value && !z.iso.date().safeParse(value).success)
        throw new MockError('Ngày lọc không hợp lệ.', 422)
    if (from && to && from > to) throw new MockError('Khoảng ngày không hợp lệ.', 422)
    return this.state.events
      .filter(
        (a) =>
          (!params.get('q') ||
            `${a.summary} ${a.entityId} ${a.actorName}`
              .toLowerCase()
              .includes(params.get('q')!.toLowerCase())) &&
          (!params.get('type') || a.action === params.get('type')) &&
          (!params.get('userId') || a.entityId === params.get('userId')) &&
          (!from || a.occurredAt.slice(0, 10) >= from) &&
          (!to || a.occurredAt.slice(0, 10) <= to),
      )
      .map((a) => auditSchema.parse(a))
  }
  summary(actor: User) {
    this.authorize(actor)
    const users = this.e.db.state.users
    return {
      totalUsers: users.length,
      accounts: ['INVITED', 'PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED'].map(
        (status) => ({ status, count: users.filter((u) => u.status === status).length }),
      ),
      pendingOwners: this.o.state.verification.filter((v) => v.status === 'PENDING').length,
      approvedOwners: users.filter((u) => this.o.eligible(u)).length,
      branches: ['DRAFT', 'ACTIVE', 'INACTIVE'].map((status) => ({
        status,
        count: this.e.state.branches.filter((b) => b.status === status).length,
      })),
      recent: this.state.events.slice(0, 5).map((a) => auditSchema.parse(a)),
      issues: users
        .filter((u) => ['LOCKED', 'PENDING_VERIFICATION'].includes(u.status))
        .slice(0, 8)
        .map((u) => ({ id: u.id, name: u.fullName, status: u.status })),
    }
  }
  scan() {
    for (const v of this.o.state.verification.filter((v) => v.status === 'PENDING')) {
      const key = `verification:${v.userId}:${v.document?.resourceId}`
      if (!this.state.observed.includes(key)) {
        this.state.observed.push(key)
        this.notifyAdmins(
          'Có hồ sơ chủ trọ chờ duyệt',
          'Mở hồ sơ để kiểm tra thông tin và tài liệu.',
          'ADMIN_VERIFICATION',
          v.userId,
        )
      }
    }
    for (const a of this.o.state.activity.filter((a) => a.type === 'ASSIGNMENT'))
      if (!this.state.observed.includes(a.id)) {
        this.state.observed.push(a.id)
        const b = this.e.state.branches.find((b) => b.id === a.branchId)
        if (b)
          this.record(
            this.target(b.ownerId),
            'MANAGER_ASSIGNMENT',
            b.id,
            'Chủ trọ đã cập nhật phân công quản lý chi nhánh.',
            null,
            { branchName: b.name },
            null,
            'branches',
          )
      }
  }
  reset(actor: User) {
    const trusted = this.authorize(actor)
    if (trusted.id !== adminUser.id)
      throw new MockError('Công cụ dành cho quản trị viên demo chính.', 403)
    return this.e.transaction(() => {
      this.e.reset()
      for (const seed of [adminUser, secondAdmin, applicant])
        Object.assign(this.target(seed.id), structuredClone(seed))
      this.ensure()
      this.scan()
      return null
    })
  }
}
export const adminDb = new AdminEngine(ownerDb)
