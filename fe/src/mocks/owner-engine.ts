import { z } from 'zod'
import type { User, Branch } from '@/interfaces/domain'
import { userSchema } from '@/interfaces/domain'
import {
  branchInputSchema,
  invitationInputSchema,
  policyInputSchema,
  proposalInputSchema,
  type BranchMetadata,
  type OwnerState,
  type OwnedBranch,
  type OwnerVerification,
} from '@/interfaces/owner'
import { managerDb, type ManagerEngine } from './manager-engine'
import { MockError } from './database'
import { branches, policies, fixtureId } from './fixtures'
import { ownerUser } from './manager-fixtures'
import { paymentViews, reportSummary, sumVnd } from './manager-finance'
import { validateImage } from './image-validation'
import { statusLabel } from '@/lib/activity'
const now = () => new Date().toISOString()
const reasonSchema = z.string().trim().min(10, 'Lý do cần ít nhất 10 ký tự.').max(2000)
export const otherOwner: User = {
  ...ownerUser,
  id: fixtureId(7003),
  email: 'owner-other@tropro.demo',
  fullName: 'Lê Hoàng Phúc',
}
const newVerification = (u: User): OwnerVerification => ({
  userId: u.id,
  status: 'NOT_SUBMITTED',
  fullName: u.fullName,
  phone: u.phone,
  contactVerified: u.status === 'ACTIVE',
  submittedAt: null,
  reviewedAt: null,
  reason: null,
  document: null,
  eligible: false,
})
export class OwnerEngine {
  constructor(public e: ManagerEngine) {
    if (!e.db.state.users.some((u) => u.id === otherOwner.id))
      e.db.state.users.push(structuredClone(otherOwner))
    this.ensure()
    e.ownerEligible = (actor) => this.eligible(actor)
    e.db.policyProvider = () => this.state.policies
    e.db.branchVisible = (id) => {
      const b = e.state.branches.find((b) => b.id === id)
      return b?.status === 'ACTIVE' && !!this.state.metadata[id]?.isPublic
    }
    e.db.branchProvider = () => e.state.branches.map((b) => this.publicBranch(b.id))
    e.db.branchQr = (id) => this.state.metadata[id]?.qrUrl || null
    e.tenant.manualQr = (t, invoiceId) => {
      const m = this.state.metadata[t.branchId]
      return m?.qrUrl && m.qrPublicId
        ? { qrUrl: m.qrUrl, resourceId: m.qrPublicId, reference: `TP-MQR-${invoiceId}` }
        : null
    }
  }
  get state(): OwnerState {
    this.ensure()
    return this.e.state.owner!
  }
  ensure() {
    if (this.e.state.owner) return
    const metadata: Record<string, BranchMetadata> = {}
    for (const [i, b] of this.e.state.branches.entries()) {
      const source = branches.find((v) => v.id === b.id)
      metadata[b.id] = {
        code: `TP-${i + 1}`,
        province: 'Thành phố Hồ Chí Minh',
        district: '',
        ward: '',
        latitude: source?.latitude ?? null,
        longitude: source?.longitude ?? null,
        description: source?.description || '',
        rules: source?.rules || [],
        publicPhone: source?.publicPhone || '',
        publicEmail: source?.publicEmail || '',
        images: source?.images || [],
        isPublic: true,
        qrPublicId: null,
        qrUrl: null,
        version: 1,
        assignedAt: now(),
      }
    }
    this.e.state.owner = {
      metadata,
      verification: [ownerUser, otherOwner].map((u) => ({
        ...newVerification(u),
        status: 'APPROVED',
        submittedAt: now(),
        reviewedAt: now(),
        reason: 'Hồ sơ giả lập đã được quản trị viên duyệt.',
        document: {
          name: 'ho-so-demo.png',
          mime: 'image/png',
          size: 100,
          resourceId: `mock-private/${u.id}`,
        },
        eligible: true,
      })),
      policies: policies.map((p) => ({
        ...structuredClone(p),
        collectionDay: 5,
        paymentGraceDays: 3,
      })),
      invitations: [],
      approvals: [],
      activity: [],
      relationshipDates: {},
      notices: [],
    }
  }
  canonical(actor: User) {
    const u = this.e.db.state.users.find((u) => u.id === actor.id && u.status === 'ACTIVE')
    if (!u) throw new MockError('Phiên hoặc tài khoản không còn hợp lệ.', 401)
    return u
  }
  eligible(actor: User) {
    const u = this.e.db.state.users.find((u) => u.id === actor.id && u.status === 'ACTIVE')
    return (
      !!u?.roles.includes('OWNER') &&
      this.state.verification.some((v) => v.userId === u.id && v.status === 'APPROVED')
    )
  }
  authorize(actor: User) {
    this.canonical(actor)
    if (!this.eligible(actor))
      throw new MockError('Cần hồ sơ được duyệt và quyền chủ trọ để quản trị.', 403)
  }
  scope(actor: User, id: string) {
    this.authorize(actor)
    const b = this.e.state.branches.find((b) => b.id === id && b.ownerId === actor.id)
    if (!b) throw new MockError('Bạn không có quyền với chi nhánh này.', 403)
    return b
  }
  record(
    actor: User,
    type: string,
    summary: string,
    branchId: string | null,
    route: string | null = null,
  ) {
    const ownerId = branchId
      ? this.e.state.branches.find((b) => b.id === branchId)!.ownerId
      : actor.id
    this.state.activity.unshift({
      id: crypto.randomUUID(),
      ownerId,
      branchId,
      actorName: actor.fullName,
      type,
      summary,
      at: now(),
      route,
    })
    if (branchId)
      this.e.db.notify(
        ownerId,
        'Hoạt động chi nhánh',
        summary,
        'OWNER_BRANCH',
        branchId!,
        undefined,
        branchId!,
      )
  }
  verification(actor: User) {
    const u = this.canonical(actor)
    return {
      ...(this.state.verification.find((v) => v.userId === u.id) || newVerification(u)),
      fullName: u.fullName,
      phone: u.phone,
      contactVerified: true,
      eligible: this.eligible(u),
    }
  }
  verificationForAdmin(user: User) {
    return {
      ...(this.state.verification.find((v) => v.userId === user.id) || newVerification(user)),
      fullName: user.fullName,
      phone: user.phone,
      eligible: this.eligible(user),
    }
  }
  submitVerification(actor: User, input: unknown) {
    const data = z
      .object({
        fullName: z.string().trim().min(2).max(255),
        phone: z.string().regex(/^\+?[0-9 ]{9,15}$/),
        document: z
          .object({
            name: z.string().min(1).max(200),
            mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
            size: z.number().int().positive().max(1048576),
            url: z.string(),
          })
          .strict(),
      })
      .strict()
      .parse(input)
    this.canonical(actor)
    if (['PENDING', 'APPROVED'].includes(this.verification(actor).status))
      throw new MockError('Hồ sơ đang chờ duyệt hoặc đã được duyệt.', 409)
    validateImage(data.document.url, data.document.mime, data.document.size)
    return this.e.transaction(() => {
      const user = this.canonical(actor)
      user.fullName = data.fullName
      user.phone = data.phone
      const v: OwnerVerification = {
        ...newVerification(user),
        status: 'PENDING',
        submittedAt: now(),
        document: {
          name: data.document.name,
          mime: data.document.mime,
          size: data.document.size,
          resourceId: `mock-private/${crypto.randomUUID()}`,
        },
      }
      this.state.verification = this.state.verification.filter((v) => v.userId !== user.id)
      this.state.verification.push(v)
      // Only metadata is retained. The submitted image is discarded, never stored in browser storage.
      this.e.db.notify(
        user.id,
        'Đã tiếp nhận hồ sơ chủ trọ',
        'Hồ sơ đang chờ quản trị viên xét duyệt.',
        'OWNER_VERIFICATION',
        user.id,
      )
      return v
    })
  }
  adminDecision(
    admin: User,
    userId: string,
    approved: boolean,
    reason: string,
    grantOwner = false,
  ) {
    const trusted = this.canonical(admin)
    if (!trusted.roles.includes('ADMIN') || trusted.id === userId)
      throw new MockError('Chỉ quản trị viên độc lập được duyệt hồ sơ.', 403)
    reasonSchema.parse(reason)
    return this.e.transaction(() => {
      const v = this.state.verification.find((v) => v.userId === userId)
      if (!v || v.status !== 'PENDING') throw new MockError('Hồ sơ không còn chờ duyệt.', 409)
      v.status = approved ? 'APPROVED' : 'REJECTED'
      v.reviewedAt = now()
      v.reviewedBy = trusted.id
      v.reason = reason
      const u = this.e.db.state.users.find((u) => u.id === userId)!
      if (approved && grantOwner && !u.roles.includes('OWNER')) u.roles.push('OWNER')
      v.eligible = this.eligible(u)
      this.e.db.notify(userId, 'Kết quả xác minh chủ trọ', reason, 'OWNER_VERIFICATION', userId)
      return v
    })
  }
  publicBranch(id: string): Branch {
    const b = this.e.state.branches.find((b) => b.id === id)!,
      m = this.state.metadata[id]
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      description: m?.description || '',
      images: m?.images || [],
      publicPhone: m?.publicPhone || null,
      publicEmail: m?.publicEmail || null,
      latitude: m?.latitude ?? null,
      longitude: m?.longitude ?? null,
      rules: m?.rules || [],
    }
  }
  branch(actor: User, id: string): OwnedBranch {
    const b = this.scope(actor, id),
      m = this.state.metadata[id]
    return {
      ...b,
      ...m,
      ...this.publicBranch(id),
      roomCount: this.e.inventory.state.rooms.filter((r) => r.branchId === id).length,
    }
  }
  branches(actor: User) {
    this.authorize(actor)
    return this.e.state.branches
      .filter((b) => b.ownerId === actor.id)
      .map((b) => this.branch(actor, b.id))
  }
  eligibleManager(ownerId: string, id: string) {
    const u = this.e.db.state.users.find(
      (u) => u.id === id && u.status === 'ACTIVE' && u.roles.includes('MANAGER'),
    )
    if (
      !u ||
      id === ownerId ||
      !this.e.state.ownerManagers.some((v) => v.ownerId === ownerId && v.managerId === id)
    )
      throw new MockError('Quản lý chưa có quan hệ hợp lệ với chủ trọ.', 422)
    return u
  }
  protectedBranch(id: string) {
    const e = this.e,
      ids = e.tenant.state.tenancies.filter((t) => t.branchId === id).map((t) => t.id)
    return (
      e.state.contracts.some((c) => c.branchId === id && ['DRAFT', 'ACTIVE'].includes(c.status)) ||
      e.db.state.bookings.some(
        (b) =>
          b.branchId === id && ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(b.status),
      ) ||
      e.db.state.appointments.some(
        (a) =>
          e.inventory.state.rooms.some((r) => r.id === a.roomId && r.branchId === id) &&
          ['PENDING', 'CONFIRMED'].includes(a.status),
      ) ||
      e.tenant.state.invoices.some(
        (i) =>
          ids.includes(i.contractTenantId) &&
          i.documentStatus !== 'CANCELLED' &&
          (i.documentStatus === 'DRAFT' ||
            e.tenant.invoice(e.tenancy(id, i.contractTenantId), i.id).outstanding > 0),
      ) ||
      paymentViews(e, id).some(
        (p) =>
          ['PENDING', 'REVIEW'].includes(p.status) ||
          (p.status === 'VERIFIED' && p.targetType === 'BOOKING_HOLD') ||
          (p.status === 'VERIFIED' &&
            p.targetType === 'INVOICE' &&
            p.amountReceived > p.allocatedAmount) ||
          (p.targetType === 'PREPAID_RENT' &&
            p.status === 'VERIFIED' &&
            p.amountReceived > (p.prepaidFirstApplied || 0) + (p.prepaidLastApplied || 0)),
      ) ||
      e.tenant.state.charges.some((c) => ids.includes(c.contractTenantId) && !c.invoiceId) ||
      e.tenant.state.reports.some(
        (r) =>
          ids.includes(r.contractTenantId) &&
          !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status),
      )
    )
  }
  saveBranch(
    actor: User,
    id: string | null,
    input: unknown,
    expectedVersion?: number,
    assignmentReason = 'Cập nhật thông tin chi nhánh.',
  ) {
    this.authorize(actor)
    const data = branchInputSchema.parse(input),
      old = id ? this.scope(actor, id) : null
    if (old && this.state.metadata[old.id].version !== expectedVersion)
      throw new MockError('Chi nhánh đã thay đổi. Tải lại trước khi lưu.', 409)
    if (
      this.e.state.branches.some(
        (b) =>
          b.id !== id && this.state.metadata[b.id]?.code.toLowerCase() === data.code.toLowerCase(),
      )
    )
      throw new MockError('Mã chi nhánh đã tồn tại.', 409)
    if (data.managerId) this.eligibleManager(actor.id, data.managerId)
    if (data.status === 'ACTIVE' && !data.managerId)
      throw new MockError('Chi nhánh hoạt động phải có quản lý chính.', 422)
    if (old && old.status === 'ACTIVE' && data.status !== 'ACTIVE' && this.protectedBranch(old.id))
      throw new MockError('Chi nhánh còn hợp đồng, giữ chỗ hoặc nghĩa vụ cần xử lý.', 409)
    if (old?.status === 'ACTIVE' && data.status === 'DRAFT')
      throw new MockError('Chi nhánh hoạt động không thể quay về nháp.', 409)
    for (const image of data.images)
      if (!old || !this.state.metadata[old.id].images.includes(image)) validateImage(image)
    return this.e.transaction(() => {
      const branchId = id || crypto.randomUUID(),
        oldManagerId = old?.managerId,
        manager = data.managerId ? this.eligibleManager(actor.id, data.managerId) : null
      if (
        data.status === 'ACTIVE' &&
        !this.state.policies.some(
          (p) => p.branchId === branchId && Date.parse(p.effectiveFrom) <= Date.now(),
        )
      )
        throw new MockError('Cần chính sách hiệu lực trước khi kích hoạt.', 422)
      const b = {
        id: branchId,
        ownerId: actor.id,
        name: data.name,
        address: data.address,
        managerId: manager?.id || null,
        managerName: manager?.fullName || '',
        status: data.status,
        zaloUrl: old?.zaloUrl || null,
        zaloEnabled: old?.zaloEnabled || false,
      }
      if (old) Object.assign(old, b)
      else this.e.state.branches.push(b)
      const prior = this.state.metadata[branchId]
      const {
        code,
        province,
        district,
        ward,
        latitude,
        longitude,
        description,
        rules,
        publicPhone,
        publicEmail,
        images,
        isPublic,
      } = data
      this.state.metadata[branchId] = {
        code,
        province,
        district,
        ward,
        latitude,
        longitude,
        description,
        rules,
        publicPhone,
        publicEmail,
        images,
        isPublic,
        qrPublicId: prior?.qrPublicId || null,
        qrUrl: prior?.qrUrl || null,
        version: (prior?.version || 0) + 1,
        assignedAt:
          old && prior && oldManagerId === data.managerId
            ? prior.assignedAt
            : data.managerId
              ? now()
              : null,
      }
      for (const room of this.e.inventory.state.rooms.filter((r) => r.branchId === branchId)) {
        room.branchName = data.name
        room.address = data.address
      }
      this.record(
        actor,
        'BRANCH',
        `Cập nhật chi nhánh ${data.name}.`,
        branchId,
        `/owner/branches/${branchId}`,
      )
      if ((oldManagerId || null) !== data.managerId) {
        this.record(
          actor,
          'ASSIGNMENT',
          `Thay đổi quản lý ${data.name}: ${assignmentReason}`,
          branchId,
          `/owner/branches/${branchId}`,
        )
        for (const uid of [oldManagerId, data.managerId].filter((v): v is string => !!v))
          this.e.db.notify(
            uid,
            'Phân công chi nhánh đã thay đổi',
            data.name,
            'MANAGER_ASSIGNMENT',
            branchId,
            undefined,
            branchId,
          )
      }
      return this.branch(actor, branchId)
    })
  }
  deleteBranch(actor: User, id: string, version: number) {
    const b = this.scope(actor, id)
    if (this.state.metadata[id].version !== version)
      throw new MockError('Chi nhánh đã thay đổi.', 409)
    if (
      b.status !== 'DRAFT' ||
      this.e.inventory.state.rooms.some((r) => r.branchId === id) ||
      this.e.state.contracts.some((c) => c.branchId === id) ||
      this.state.invitations.some((i) => i.branchIds.includes(id))
    )
      throw new MockError('Chỉ xóa nháp chưa có tài nguyên hoặc lịch sử liên quan.', 409)
    return this.e.transaction(() => {
      this.record(actor, 'BRANCH', `Xóa nháp ${b.name}.`, id)
      this.e.state.branches = this.e.state.branches.filter((b) => b.id !== id)
      delete this.state.metadata[id]
      this.state.policies = this.state.policies.filter((p) => p.branchId !== id)
      return null
    })
  }
  assign(actor: User, id: string, managerId: string | null, version: number, reason: string) {
    const b = this.branch(actor, id)
    reasonSchema.parse(reason)
    if (b.managerId === managerId) throw new MockError('Phân công không thay đổi.', 409)
    return this.saveBranch(
      actor,
      id,
      branchInputSchema.parse({
        ...Object.fromEntries(
          Object.keys(branchInputSchema.shape).map((k) => [k, b[k as keyof OwnedBranch]]),
        ),
        publicPhone: b.publicPhone || '',
        publicEmail: b.publicEmail || '',
        managerId,
      }),
      version,
      reason,
    )
  }
  managers(actor: User) {
    this.authorize(actor)
    return this.e.state.ownerManagers
      .filter((v) => v.ownerId === actor.id)
      .map((v) => ({
        id: v.managerId,
        user: userSchema.parse(this.e.db.state.users.find((u) => u.id === v.managerId)!),
        assignedAt: this.state.relationshipDates[v.managerId] || '2026-10-01T00:00:00Z',
        branches: this.branches(actor)
          .filter((b) => b.managerId === v.managerId)
          .map((b) => ({ id: b.id, name: b.name, assignedAt: b.assignedAt })),
      }))
  }
  removeManager(actor: User, managerId: string, reason: string) {
    this.authorize(actor)
    reasonSchema.parse(reason)
    if (!this.managers(actor).some((m) => m.id === managerId))
      throw new MockError('Không tìm thấy quan hệ quản lý.', 404)
    if (this.branches(actor).some((b) => b.managerId === managerId))
      throw new MockError('Cần chuyển hoặc thu hồi tất cả phân công trước.', 409)
    return this.e.transaction(() => {
      this.e.state.ownerManagers = this.e.state.ownerManagers.filter(
        (v) => v.managerId !== managerId,
      )
      this.record(actor, 'MANAGER', `Kết thúc quan hệ quản lý: ${reason}`, null)
      return null
    })
  }
  invite(actor: User, input: unknown) {
    this.authorize(actor)
    const data = invitationInputSchema.parse(input)
    data.email = data.email.toLowerCase()
    for (const id of data.branchIds) this.scope(actor, id)
    if (new Set(data.branchIds).size !== data.branchIds.length)
      throw new MockError('Chi nhánh bị chọn trùng.', 422)
    const existing = this.e.db.state.users.find((u) => u.email.toLowerCase() === data.email)
    if (
      existing?.id === actor.id ||
      (existing && this.e.state.ownerManagers.some((v) => v.managerId === existing.id))
    )
      throw new MockError('Tài khoản đã thuộc chủ trọ hoặc không thể được mời.', 409)
    if (
      this.state.invitations.some(
        (i) =>
          i.email === data.email && i.status === 'INVITED' && Date.parse(i.expiresAt) > Date.now(),
      )
    )
      throw new MockError('Email đã có lời mời đang hiệu lực.', 409)
    return this.e.transaction(() => {
      const i = {
        ...data,
        id: crypto.randomUUID(),
        ownerId: actor.id,
        status: 'INVITED' as const,
        createdAt: now(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        acceptedBy: null,
      }
      this.state.invitations.unshift(i)
      this.record(
        actor,
        'INVITATION',
        `Đã tạo lời mời cho ${data.fullName}.`,
        null,
        '/owner/managers',
      )
      if (existing)
        this.e.db.notify(
          existing.id,
          'Lời mời quản lý chi nhánh',
          'Đăng nhập bằng tài khoản đã xác minh để xem và xác nhận.',
          'MANAGER_INVITATION',
          i.id,
        )
      return i
    })
  }
  accept(actor: User, id: string) {
    const user = this.canonical(actor),
      i = this.state.invitations.find((v) => v.id === id && v.email === user.email.toLowerCase())
    if (!i) throw new MockError('Lời mời không dành cho tài khoản này.', 403)
    if (i.status !== 'INVITED' || Date.parse(i.expiresAt) <= Date.now())
      throw new MockError('Lời mời không còn hiệu lực.', 409)
    const owner = this.e.db.state.users.find((u) => u.id === i.ownerId)!
    this.authorize(owner)
    if (user.id === owner.id || this.e.state.ownerManagers.some((v) => v.managerId === user.id))
      throw new MockError('Tài khoản đã có quan hệ quản lý khác.', 409)
    return this.e.transaction(() => {
      user.roles = [...new Set([...user.roles, 'MANAGER' as const])]
      this.e.state.ownerManagers.push({ ownerId: owner.id, managerId: user.id })
      this.state.relationshipDates[user.id] = now()
      // Proposed assignments require a fresh Owner confirmation; acceptance alone does not change a Branch.
      i.status = 'ACCEPTED'
      i.acceptedBy = user.id
      this.e.db.notify(
        owner.id,
        'Quản lý đã xác nhận lời mời',
        `${user.fullName} đã sẵn sàng được phân công.`,
        'OWNER_MANAGER',
        user.id,
      )
      this.record(
        owner,
        'INVITATION',
        `${user.fullName} đã xác nhận lời mời.`,
        null,
        `/owner/managers/${user.id}`,
      )
      return { invitation: i, user: userSchema.parse(user) }
    })
  }
  invitationAction(actor: User, id: string, action: string) {
    this.authorize(actor)
    const i = this.state.invitations.find((i) => i.id === id && i.ownerId === actor.id)
    if (!i) throw new MockError('Không tìm thấy lời mời.', 404)
    if (i.status !== 'INVITED') throw new MockError('Lời mời đã được xử lý.', 409)
    return this.e.transaction(() => {
      if (action === 'cancel') i.status = 'CANCELLED'
      else if (action === 'resend') {
        if (Date.now() - Date.parse(i.createdAt) < 60000)
          throw new MockError('Chờ một phút trước khi gửi lại.', 409)
        i.createdAt = now()
        i.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
      } else throw new MockError('Thao tác chưa hợp lệ.', 422)
      this.record(
        actor,
        'INVITATION',
        action === 'cancel' ? 'Đã hủy lời mời quản lý.' : 'Đã gửi lại lời mời quản lý.',
        null,
        '/owner/managers',
      )
      return i
    })
  }
  savePolicy(actor: User, branchId: string, input: unknown) {
    this.scope(actor, branchId)
    const data = policyInputSchema.parse(input),
      history = this.state.policies
        .filter((p) => p.branchId === branchId)
        .sort((a, b) => b.version - a.version)
    if (
      Date.parse(data.effectiveFrom) < Date.now() - 60000 ||
      (history[0] && Date.parse(data.effectiveFrom) <= Date.parse(history[0].effectiveFrom))
    )
      throw new MockError('Ngày hiệu lực phải từ hiện tại và sau phiên bản cuối.', 409)
    return this.e.transaction(() => {
      const p = {
        ...data,
        id: crypto.randomUUID(),
        branchId,
        version: (history[0]?.version || 0) + 1,
      }
      this.state.policies.push(p)
      this.record(
        actor,
        'POLICY',
        `Tạo chính sách phiên bản ${p.version}.`,
        branchId,
        `/owner/branches/${branchId}/policies`,
      )
      return p
    })
  }
  saveQr(actor: User, id: string, input: unknown) {
    this.scope(actor, id)
    const data = z.object({ image: z.string(), version: z.number().int() }).strict().parse(input)
    validateImage(data.image)
    if (data.version !== this.state.metadata[id].version)
      throw new MockError('Cấu hình đã thay đổi.', 409)
    return this.e.transaction(() => {
      const m = this.state.metadata[id]
      m.qrUrl = data.image
      m.qrPublicId = `mock-qr/${crypto.randomUUID()}`
      m.version++
      this.record(
        actor,
        'QR',
        'Cập nhật QR nhận tiền thủ công.',
        id,
        `/owner/branches/${id}/payments/settings`,
      )
      return this.branch(actor, id)
    })
  }
  submitManual(userId: string, tenancyId: string, invoiceId: string, input: unknown) {
    const t = this.e.tenant.own(userId, tenancyId)
    this.e.tenant.active(t)
    const data = z
        .object({
          amount: z.number().int().positive().max(1000000000),
          payerName: z.string().trim().min(2).max(100),
          reference: z.string(),
          providerTransactionId: z.string().trim().min(5).max(100),
          evidence: z.array(z.string()).min(1).max(3),
          idempotencyKey: z.uuid(),
        })
        .strict()
        .parse(input),
      invoice = this.e.tenant.invoice(t, invoiceId)
    const existing = this.e.tenant.state.payments.find(
      (p) => p.idempotencyKey === data.idempotencyKey,
    )
    if (existing) {
      if (
        existing.contractTenantId !== t.id ||
        existing.invoiceId !== invoiceId ||
        existing.amountReceived !== data.amount ||
        existing.payerName !== data.payerName ||
        existing.method !== 'TRANSFER' ||
        this.e.state.paymentMeta[existing.id]?.providerTransactionId !== data.providerTransactionId
      )
        throw new MockError('Mã yêu cầu đã dùng cho giao dịch khác.', 409)
      return existing
    }
    if (
      !invoice.manualQr ||
      data.reference !== invoice.manualQr.reference ||
      invoice.documentStatus !== 'ISSUED' ||
      data.amount > invoice.availableToPay
    )
      throw new MockError('QR, tham chiếu hoặc mức thanh toán không còn hợp lệ.', 409)
    for (const image of data.evidence) validateImage(image)
    return this.e.transaction(() => {
      const p = {
        id: crypto.randomUUID(),
        contractTenantId: t.id,
        invoiceId,
        reference: data.reference,
        amountReceived: data.amount,
        allocatedAmount: 0,
        prepaidFirstAmount: 0,
        prepaidLastAmount: 0,
        prepaidFirstApplied: 0,
        prepaidLastApplied: 0,
        payerName: data.payerName,
        method: 'TRANSFER' as const,
        environment: 'LIVE' as const,
        status: 'PENDING' as const,
        createdAt: now(),
        verifiedAt: null,
        evidence: data.evidence,
        settlementAt: 0,
        outcome: 'pending' as const,
        idempotencyKey: data.idempotencyKey,
      }
      this.e.tenant.state.payments.unshift(p)
      this.e.state.paymentMeta[p.id] = {
        providerTransactionId: data.providerTransactionId,
        expectedReference: data.reference,
        amount: data.amount,
        history: [],
        note: 'Chứng cứ do người thuê gửi trong demo; cần quản lý đối chiếu độc lập trước khi xác minh.',
      }
      this.e.db.notify(
        userId,
        'Đã gửi chứng cứ chuyển khoản',
        'Giao dịch đang chờ đối soát, chưa giảm dư nợ.',
        'TENANT_PAYMENT',
        p.id,
        t.id,
      )
      return p
    })
  }
  summary(actor: User, branchId: string | null, month: string) {
    const selected = branchId ? [this.branch(actor, branchId)] : this.branches(actor)
    const rows = selected.map((b) => {
      const s = reportSummary(this.e, b.id, month),
        payments = paymentViews(this.e, b.id),
        verified = payments.filter((p) => p.status === 'VERIFIED'),
        real = verified.filter((p) => p.environment !== 'SANDBOX'),
        prepaid = real.filter((p) => p.targetType === 'PREPAID_RENT'),
        prepaidReceived = sumVnd(prepaid.map((p) => p.amountReceived)),
        prepaidApplied = sumVnd(
          prepaid.map((p) => sumVnd([p.prepaidFirstApplied || 0, p.prepaidLastApplied || 0])),
        )
      const wholeRooms = this.e.inventory.state.rooms.filter(
          (r) => r.branchId === b.id && r.rentalMode === 'ROOM',
        ),
        today = now().slice(0, 10),
        tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        views = wholeRooms.map((r) => this.e.occupancy(r, today, tomorrow)),
        availableSlots = this.e.inventory.state.slots.filter(
          (slot) =>
            slot.branchId === b.id &&
            slot.operationalStatus === 'ACTIVE' &&
            b.status === 'ACTIVE' &&
            this.e.inventory.state.rooms.some(
              (room) => room.id === slot.roomId && room.operationalStatus === 'ACTIVE',
            ) &&
            !this.e.overlapsRoom(slot.roomId, slot.id, today, tomorrow),
        ).length
      return {
        ...s,
        slots: {
          ...s.slots,
          available: availableSlots,
          unavailable: Math.max(
            0,
            s.slots.total - s.slots.occupied - s.slots.held - availableSlots,
          ),
        },
        rooms: {
          total: wholeRooms.length,
          available: views.filter((r) => b.status === 'ACTIVE' && r.availability === 'AVAILABLE')
            .length,
          occupied: views.filter((r) => r.availability === 'OCCUPIED').length,
          held: views.filter((r) => r.availability === 'HELD').length,
          maintenance: views.filter(
            (r) => b.status !== 'ACTIVE' || r.operationalStatus !== 'ACTIVE',
          ).length,
        },
        id: b.id,
        name: b.name,
        roomCount: b.roomCount,
        status: b.status,
        managerName: b.managerName || null,
        invoiceCount: this.e.tenant.state.invoices.filter(
          (i) =>
            i.documentStatus === 'ISSUED' &&
            i.billingMonth.startsWith(month) &&
            this.e.tenant.state.tenancies.some(
              (t) => t.id === i.contractTenantId && t.branchId === b.id,
            ),
        ).length,
        bookingCount: this.e.db.state.bookings.filter(
          (v) => v.branchId === b.id && v.createdAt.startsWith(month),
        ).length,
        maintenanceCount: this.e.tenant.state.reports.filter(
          (r) =>
            this.e.tenant.state.tenancies.some(
              (t) => t.id === r.contractTenantId && t.branchId === b.id,
            ) && !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status),
        ).length,
        exceptions: payments.filter((p) => p.status === 'REVIEW').length,
        prepaidReceived,
        prepaidApplied,
        prepaidUnused: sumVnd([prepaidReceived - prepaidApplied]),
        holdReceived: sumVnd(
          real.filter((p) => p.targetType === 'BOOKING_HOLD').map((p) => p.amountReceived),
        ),
        holdSandbox: sumVnd(
          verified
            .filter((p) => p.targetType === 'BOOKING_HOLD' && p.environment === 'SANDBOX')
            .map((p) => p.amountReceived),
        ),
        unmatched: sumVnd(
          real
            .filter((p) => p.targetType === 'INVOICE')
            .map((p) => Math.max(0, p.amountReceived - p.allocatedAmount)),
        ),
      }
    })
    const keys = [
      'billed',
      'receipts',
      'sandboxReceipts',
      'debt',
      'overdue',
      'overdueCount',
      'invoiceCount',
      'activeContracts',
      'activeTenancies',
      'bookingCount',
      'maintenanceCount',
      'exceptions',
      'prepaidReceived',
      'prepaidApplied',
      'prepaidUnused',
      'holdReceived',
      'holdSandbox',
      'unmatched',
    ] as const
    const totals = Object.fromEntries(keys.map((k) => [k, sumVnd(rows.map((r) => r[k]))])) as {
      [K in (typeof keys)[number]]: number
    }
    return {
      period: month,
      rows,
      totals,
      pendingApprovals: this.state.approvals.filter(
        (p) =>
          p.ownerId === actor.id &&
          p.status === 'PENDING' &&
          (!branchId || p.branchId === branchId),
      ).length,
    }
  }
  fingerprint(invoice: unknown) {
    return JSON.stringify(invoice)
  }
  requestAdjustment(actor: User, branchId: string, input: unknown) {
    const user = this.canonical(actor)
    this.e.scope(user, branchId, true)
    const data = proposalInputSchema.parse(input),
      invoice = this.e.tenant.state.invoices.find(
        (i) =>
          i.id === data.invoiceId &&
          this.e.tenant.state.tenancies.some(
            (t) => t.id === i.contractTenantId && t.branchId === branchId,
          ),
      )
    if (!invoice || invoice.documentStatus !== 'ISSUED')
      throw new MockError('Chỉ yêu cầu điều chỉnh hóa đơn đã phát hành.', 409)
    if (
      data.proposedTotal === invoice.totalAmount ||
      this.state.approvals.some((p) => p.invoiceId === invoice.id && p.status === 'PENDING')
    )
      throw new MockError('Giá trị không thay đổi hoặc đã có yêu cầu chờ duyệt.', 409)
    for (const image of data.evidence) validateImage(image)
    return this.e.transaction(() => {
      const b = this.e.scope(user, branchId),
        p = {
          ...data,
          id: crypto.randomUUID(),
          ownerId: b.ownerId,
          branchId,
          contractTenantId: invoice.contractTenantId,
          billingMonth: invoice.billingMonth,
          requesterId: user.id,
          requesterName: user.fullName,
          createdAt: now(),
          originalTotal: invoice.totalAmount,
          fingerprint: this.fingerprint(invoice),
          status: 'PENDING' as const,
          executionStatus: 'NOT_APPLIED' as const,
          history: [],
        }
      this.state.approvals.unshift(p)
      this.record(
        user,
        'APPROVAL_REQUEST',
        'Có yêu cầu duyệt điều chỉnh hóa đơn.',
        branchId,
        '/owner/approvals/invoices',
      )
      this.e.db.notify(
        b.ownerId,
        'Yêu cầu điều chỉnh hóa đơn',
        data.reason,
        'OWNER_APPROVAL',
        p.id,
        undefined,
        branchId,
      )
      return p
    })
  }
  decide(actor: User, id: string, input: unknown) {
    this.authorize(actor)
    const data = z
        .object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: reasonSchema })
        .strict()
        .parse(input),
      p = this.state.approvals.find((p) => p.id === id && p.ownerId === actor.id)
    if (!p) throw new MockError('Không tìm thấy yêu cầu thuộc chủ trọ.', 404)
    this.scope(actor, p.branchId)
    const invoice = this.e.tenant.state.invoices.find((i) => i.id === p.invoiceId)
    if (
      p.status !== 'PENDING' ||
      !invoice ||
      invoice.documentStatus !== 'ISSUED' ||
      p.fingerprint !== this.fingerprint(invoice)
    )
      throw new MockError('Yêu cầu đã xử lý hoặc hóa đơn đã thay đổi.', 409)
    return this.e.transaction(() => {
      p.status = data.decision
      p.history.push({ at: now(), actor: actor.fullName, note: data.reason })
      this.record(
        actor,
        'APPROVAL_DECISION',
        `Quyết định điều chỉnh: ${data.reason}`,
        p.branchId,
        '/owner/approvals/invoices',
      )
      this.e.db.notify(
        p.requesterId,
        'Kết quả duyệt điều chỉnh',
        data.reason,
        'MANAGER_INVOICE',
        p.invoiceId,
        undefined,
        p.branchId,
      )
      return p
    })
  }
  scanActivity() {
    for (const b of this.e.state.branches) {
      const actor = this.e.db.state.users.find((u) => u.id === b.ownerId)
      if (!actor) continue
      const events = [
        ...(b.status === 'ACTIVE' && !b.managerId
          ? [
              {
                key: `assignment-missing:${b.id}`,
                type: 'ASSIGNMENT',
                summary: 'Chi nhánh hoạt động đang thiếu quản lý chính.',
                route: '/owner/manager-assignments',
              },
            ]
          : []),
        ...this.e.tenant.state.invoices
          .filter(
            (i) =>
              i.documentStatus === 'ISSUED' &&
              this.e.tenant.state.tenancies.some(
                (t) => t.id === i.contractTenantId && t.branchId === b.id,
              ) &&
              this.e.tenant.invoice(this.e.tenancy(b.id, i.contractTenantId), i.id)
                .financialStatus === 'OVERDUE',
          )
          .map((i) => ({
            key: `overdue:${i.id}`,
            type: 'OVERDUE',
            summary: `Hóa đơn kỳ ${i.billingMonth.slice(0, 7)} có công nợ quá hạn.`,
            route: `/manager/invoices/${i.id}?branchId=${b.id}&workspace=owner`,
          })),
        ...this.e.tenant.state.invoices
          .filter(
            (i) =>
              i.documentStatus === 'ISSUED' &&
              this.e.tenant.state.tenancies.some(
                (t) => t.id === i.contractTenantId && t.branchId === b.id,
              ),
          )
          .map((i) => ({
            key: `invoice:${i.id}`,
            type: 'INVOICE',
            summary: `Hóa đơn kỳ ${i.billingMonth.slice(0, 7)} đã phát hành.`,
            route: `/manager/invoices/${i.id}?branchId=${b.id}&workspace=owner`,
          })),
        ...paymentViews(this.e, b.id)
          .filter((p) => ['VERIFIED', 'REVIEW'].includes(p.status))
          .map((p) => ({
            key: `payment:${p.id}:${p.status}`,
            type: 'PAYMENT',
            summary: `Giao dịch ${p.reference}: ${p.status === 'VERIFIED' ? 'đã xác minh' : 'cần đối soát'}.`,
            route: `/manager/payments/${p.id}?branchId=${b.id}&workspace=owner`,
          })),
        ...this.e.tenant.state.reports
          .filter((r) =>
            this.e.tenant.state.tenancies.some(
              (t) => t.id === r.contractTenantId && t.branchId === b.id,
            ),
          )
          .map((r) => ({
            key: `report:${r.id}:${r.status}`,
            type: 'MAINTENANCE',
            summary: `Sửa chữa ${r.title}: ${statusLabel[r.status]?.toLowerCase() || 'đã cập nhật'}.`,
            route: `/manager/maintenance/${r.id}?branchId=${b.id}&workspace=owner`,
          })),
      ]
      for (const event of events)
        if (!this.state.notices.includes(event.key)) {
          this.state.notices.push(event.key)
          this.state.activity.unshift({
            id: crypto.randomUUID(),
            ownerId: b.ownerId,
            branchId: b.id,
            actorName: 'Hệ thống',
            type: event.type,
            summary: event.summary,
            at: now(),
            route: event.route,
          })
          if (
            ['MAINTENANCE', 'ASSIGNMENT', 'OVERDUE'].includes(event.type) ||
            event.key.endsWith(':REVIEW')
          )
            this.e.db.notify(
              b.ownerId,
              'Cần kiểm tra chi nhánh',
              event.summary,
              'OWNER_BRANCH',
              b.id,
              undefined,
              b.id,
            )
        }
    }
  }
}
export const ownerDb = new OwnerEngine(managerDb)
