import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnerEngine, otherOwner } from './owner-engine'
import { ManagerEngine } from './manager-engine'
import { MockDatabase } from './database'
import { MockInventory } from './inventory'
import { TenantEngine } from './tenant-engine'
import { ownerUser as owner, managerUser as manager, otherManager } from './manager-fixtures'
import { demoUser as user, fixtureId as id } from './fixtures'
import { tenantUser } from './tenant-fixtures'
import {
  branchInputSchema,
  ownerSummarySchema,
  ownedBranchSchema,
  type BranchInput,
} from '@/interfaces/owner'
import { paymentViews } from './manager-finance'
import type { User } from '@/interfaces/domain'
let e: ManagerEngine, o: OwnerEngine
const note = 'Đã đối chiếu hồ sơ và chứng cứ hợp lệ.'
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvZkAAAAASUVORK5CYII='
const document = {
  name: 'ho-so-demo.png',
  mime: 'image/png',
  size: atob(image.split(',')[1]).length,
  url: image,
}
const draft = (code = 'NEW-1'): BranchInput => ({
  code,
  name: 'TroPro Linh Trung',
  address: '15 Đường số 2, Linh Trung',
  province: '',
  district: '',
  ward: '',
  latitude: null,
  longitude: null,
  description: 'Không gian sống gần trường.',
  rules: [],
  publicPhone: '',
  publicEmail: '',
  images: [],
  isPublic: false,
  status: 'DRAFT',
  managerId: null,
})
const input = (branch = id(10)) => {
  const b = o.branch(owner, branch)
  return branchInputSchema.parse(
    Object.fromEntries(
      Object.keys(branchInputSchema.shape).map((k) => [
        k,
        k === 'publicPhone' || k === 'publicEmail' ? b[k] || '' : b[k as keyof typeof b],
      ]),
    ),
  )
}
const policy = (branch = id(10), offset = 0) => {
  const p = o.state.policies.find((p) => p.branchId === branch)!
  const {
    collectionDay,
    paymentGraceDays,
    bookingHoldAmount,
    paymentWindowMinutes,
    temporaryHoldMinutes,
    confirmedHoldMinutes,
    cancellationTerms,
    appointmentPolicy,
  } = p
  return {
    collectionDay,
    paymentGraceDays,
    bookingHoldAmount,
    paymentWindowMinutes,
    temporaryHoldMinutes,
    confirmedHoldMinutes,
    cancellationTerms,
    appointmentPolicy,
    effectiveFrom: new Date(Date.now() + offset).toISOString(),
  }
}
const invite = (email = user.email) => ({
  fullName: 'Nguyễn Minh An',
  email,
  phone: '0901234567',
  branchIds: [id(10)],
  note: 'Lời mời quản lý chi nhánh.',
})
const admin: User = {
  ...user,
  id: id(9900),
  email: 'admin-test@example.test',
  roles: ['USER', 'ADMIN'],
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-16T09:00:00Z'))
  const catalog = new MockInventory(),
    db = new MockDatabase(undefined, catalog),
    tenant = new TenantEngine(undefined, catalog)
  e = new ManagerEngine(db, tenant, catalog)
  e.tenant.state.workflowMode = 'managed'
  o = new OwnerEngine(e)
  e.db.state.users.push(structuredClone(admin))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('Owner identity and verification', () => {
  it('rejects an ordinary USER and Manager from Owner resources', () => {
    expect(() => o.branches(user)).toThrow()
    expect(() => o.branches(manager)).toThrow()
  })
  it('requires both approved verification and canonical OWNER role', () => {
    o.state.verification.find((v) => v.userId === owner.id)!.status = 'PENDING'
    expect(o.eligible(owner)).toBe(false)
    expect(e.branches(owner)).toEqual([])
    expect(() => o.summary(owner, null, '2026-10')).toThrow()
  })
  it('does not trust forged role claims', () => {
    expect(o.eligible({ ...user, roles: ['OWNER'] })).toBe(false)
    expect(() => o.branches({ ...user, roles: ['OWNER'] })).toThrow()
  })
  it('submits only metadata and never grants Owner role', () => {
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    expect(o.verification(user).status).toBe('PENDING')
    expect(e.db.state.users.find((u) => u.id === user.id)!.roles).toEqual(['USER'])
    expect(JSON.stringify(o.state)).not.toContain(document.url)
    expect(() => o.branches(user)).toThrow()
  })
  it('prevents duplicate submissions and Owner self approval', () => {
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    expect(() =>
      o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document }),
    ).toThrow()
    expect(() => o.adminDecision(user, user.id, true, note, true)).toThrow()
  })
  it('does not accept an invented ADMIN claim', () => {
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    expect(() =>
      o.adminDecision({ ...owner, roles: ['ADMIN'] }, user.id, true, note, true),
    ).toThrow()
  })
  it('separates trusted approval and entitlement grant', () => {
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    o.adminDecision(admin, user.id, true, note)
    expect(o.verification(user).status).toBe('APPROVED')
    expect(o.eligible(user)).toBe(false)
  })
  it('trusted ADMIN can explicitly grant authorized entitlement', () => {
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    o.adminDecision(admin, user.id, true, note, true)
    expect(o.eligible(user)).toBe(true)
    expect(o.branches(user)).toEqual([])
  })
  it('allows resubmission after rejection and preserves shared inbox', () => {
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    o.adminDecision(admin, user.id, false, note)
    expect(o.verification(user).reason).toBe(note)
    o.submitVerification(user, { fullName: user.fullName, phone: '0901234567', document })
    expect(o.verification(user).status).toBe('PENDING')
    expect(e.db.notifications(user.id).length).toBeGreaterThan(1)
  })
  it.each(['data:image/png;base64,ZmFrZQ==', 'data:text/html;base64,ZmFrZQ=='])(
    'rejects invalid identity image %s',
    (url) => {
      expect(() =>
        o.submitVerification(user, {
          fullName: user.fullName,
          phone: '0901234567',
          document: { ...document, url },
        }),
      ).toThrow()
    },
  )
})
describe('Owner branches and assignment integrity', () => {
  it('branch editor reassignment records audit and notifies both Managers exactly once', () => {
    const invitation = o.invite(owner, invite())
    o.accept(user, invitation.id)
    const b = o.branch(owner, id(10))
    o.saveBranch(owner, b.id, { ...input(), managerId: user.id }, b.version)
    expect(
      o.state.activity.filter((a) => a.type === 'ASSIGNMENT' && a.branchId === b.id),
    ).toHaveLength(1)
    expect(
      e.db.notifications(manager.id).filter((n) => n.referenceType === 'MANAGER_ASSIGNMENT'),
    ).toHaveLength(1)
    expect(
      e.db.notifications(user.id).filter((n) => n.referenceType === 'MANAGER_ASSIGNMENT'),
    ).toHaveLength(1)
    expect(() => e.scope(manager, b.id)).toThrow()
  })
  it('permits safe deactivation of a configured empty Branch and blocks operational writes', () => {
    const b = o.saveBranch(owner, null, draft())
    o.savePolicy(owner, b.id, policy())
    const active = o.saveBranch(
      owner,
      b.id,
      { ...draft(), status: 'ACTIVE', managerId: manager.id, isPublic: true },
      b.version,
    )
    const inactive = o.saveBranch(
      owner,
      b.id,
      { ...input(b.id), status: 'INACTIVE' },
      active.version,
    )
    expect(inactive.status).toBe('INACTIVE')
    expect(() => e.scope(manager, b.id, true)).toThrow()
    expect(() => e.db.branch(b.id)).toThrow()
  })
  it('counts all physical Rooms while keeping ROOM and SLOT utilization units separate', () => {
    const s = o.summary(owner, null, '2026-10')
    expect(s.rows.reduce((n, r) => n + r.roomCount, 0)).toBe(
      e.inventory.state.rooms.filter((r) => [id(10), id(12)].includes(r.branchId)).length,
    )
    expect(s.rows.find((r) => r.id === id(12))!.rooms.total).toBe(0)
    expect(s.rows.find((r) => r.id === id(12))!.slots.total).toBeGreaterThan(0)
    const slots = s.rows.find((r) => r.id === id(12))!.slots
    expect(slots.available).toBe(10)
    expect(slots.unavailable).toBe(4)
    expect(slots.occupied + slots.held + slots.available + slots.unavailable).toBe(slots.total)
  })
  it('creates a persistent typed draft owned by the authenticated user', () => {
    const b = o.saveBranch(owner, null, draft())
    expect(b.ownerId).toBe(owner.id)
    expect(b.status).toBe('DRAFT')
    expect(o.branches(owner).some((v) => v.id === b.id)).toBe(true)
    expect(ownedBranchSchema.safeParse(b).success).toBe(true)
  })
  it('rejects arbitrary ownerId injection and duplicate codes', () => {
    o.saveBranch(owner, null, draft())
    expect(() => o.saveBranch(owner, null, { ...draft('N2'), ownerId: otherOwner.id })).toThrow()
    expect(() => o.saveBranch(owner, null, draft('new-1'))).toThrow()
  })
  it.each([
    { latitude: 91, longitude: 100 },
    { latitude: 10, longitude: null },
    { latitude: 10, longitude: 181 },
  ])('validates coordinates %j', (coord) =>
    expect(() => o.saveBranch(owner, null, { ...draft(), ...coord })).toThrow(),
  )
  it('blocks activation without manager and effective policy', () => {
    expect(() => o.saveBranch(owner, null, { ...draft(), status: 'ACTIVE' })).toThrow()
    expect(() =>
      o.saveBranch(owner, null, { ...draft(), managerId: manager.id, status: 'ACTIVE' }),
    ).toThrow()
    expect(o.branches(owner)).toHaveLength(2)
  })
  it('activates a configured draft with one eligible primary Manager', () => {
    const b = o.saveBranch(owner, null, draft())
    o.savePolicy(owner, b.id, policy())
    const active = o.saveBranch(
      owner,
      b.id,
      { ...draft(), status: 'ACTIVE', managerId: manager.id },
      b.version,
    )
    expect(active.status).toBe('ACTIVE')
    expect(e.branches(manager).some((v) => v.id === b.id)).toBe(true)
  })
  it('allows one Manager across owned Branches', () => {
    expect(o.branches(owner).filter((b) => b.managerId === manager.id)).toHaveLength(2)
  })
  it.each([id(11), 'unknown'])('denies foreign or invalid Branch %s', (branch) => {
    expect(() => o.branch(owner, branch)).toThrow()
    expect(() => o.savePolicy(owner, branch, policy())).toThrow()
    expect(() => e.scope(owner, branch)).toThrow()
  })
  it('prevents unsafe deactivation and active branch revocation', () => {
    const b = o.branch(owner, id(10))
    expect(() => o.saveBranch(owner, b.id, { ...input(), status: 'INACTIVE' }, b.version)).toThrow()
    expect(() => o.assign(owner, b.id, null, b.version, note)).toThrow()
  })
  it('rejects stale writes atomically', () => {
    const b = o.branch(owner, id(10))
    o.saveBranch(owner, b.id, { ...input(), description: 'Mô tả cập nhật' }, b.version)
    expect(() =>
      o.saveBranch(owner, b.id, { ...input(), name: 'Sai phiên bản' }, b.version),
    ).toThrow()
    expect(o.branch(owner, b.id).name).toBe(b.name)
  })
  it('rejects cross-Owner Manager assignment', () => {
    const b = o.branch(owner, id(10))
    expect(() => o.assign(owner, b.id, otherManager.id, b.version, note)).toThrow()
  })
  it('reassignment immediately revokes previous Manager and preserves multi-role identity', () => {
    const i = o.invite(owner, invite())
    o.accept(user, i.id)
    const b = o.branch(owner, id(10))
    o.assign(owner, b.id, user.id, b.version, note)
    expect(() => e.scope(manager, b.id)).toThrow()
    expect(
      e.scope(
        e.db.state.users.find((u) => u.id === user.id)!,
        b.id,
      ).id,
    ).toBe(b.id)
    expect(e.branches(manager).map((b) => b.id)).toEqual([id(12)])
    expect(e.db.state.users.filter((u) => u.id === user.id)).toHaveLength(1)
    expect(e.db.state.users.find((u) => u.id === user.id)!.roles).toEqual(['USER', 'MANAGER'])
  })
  it('revokes a draft assignment and removes relationship only after all assignments end', () => {
    const i = o.invite(owner, invite())
    o.accept(user, i.id)
    const b = o.saveBranch(owner, null, { ...draft(), managerId: user.id })
    expect(() => o.removeManager(owner, user.id, note)).toThrow()
    o.assign(owner, b.id, null, b.version, note)
    o.removeManager(owner, user.id, note)
    expect(e.db.state.users.find((u) => u.id === user.id)!.status).toBe('ACTIVE')
    expect(e.branches({ ...user, roles: ['USER', 'MANAGER'] })).toEqual([])
  })
  it('deletes an empty draft but preserves operational history', () => {
    const b = o.saveBranch(owner, null, draft())
    o.deleteBranch(owner, b.id, b.version)
    expect(o.branches(owner).some((v) => v.id === b.id)).toBe(false)
    expect(() => o.deleteBranch(owner, id(10), 1)).toThrow()
  })
  it('publishes shared metadata and hides a Branch from public discovery', () => {
    const b = o.branch(owner, id(10))
    o.saveBranch(
      owner,
      b.id,
      { ...input(), name: 'TroPro tên mới', description: 'Thông tin công khai mới' },
      b.version,
    )
    expect(e.db.branch(b.id).name).toBe('TroPro tên mới')
    expect(
      e.db
        .listRooms({
          q: '',
          area: '',
          mode: 'ALL',
          roomTypeId: '',
          sort: 'recommended',
          page: 0,
          availableOnly: false,
        })
        .some((r) => r.branchName === 'TroPro tên mới'),
    ).toBe(true)
    o.saveBranch(owner, b.id, { ...input(), isPublic: false }, o.branch(owner, b.id).version)
    expect(() => e.db.branch(b.id)).toThrow()
    expect(() => e.db.availability(id(109), '2026-11-01', '2026-12-01')).toThrow()
  })
})
describe('Manager invitations require identity confirmation', () => {
  it('invitation does not create accounts, relationships or privileged access', () => {
    const count = e.db.state.users.length
    const i = o.invite(owner, invite('new-manager@example.test'))
    expect(i.status).toBe('INVITED')
    expect(e.db.state.users).toHaveLength(count)
    expect(o.managers(owner)).toHaveLength(1)
  })
  it('links a verified existing User exactly once without automatic Branch assignments', () => {
    const i = o.invite(owner, invite())
    o.accept(user, i.id)
    expect(e.db.state.users.filter((u) => u.email === user.email)).toHaveLength(1)
    expect(e.branches({ ...user, roles: ['USER', 'MANAGER'] })).toEqual([])
    expect(() => o.accept(user, i.id)).toThrow()
  })
  it('acceptance and Manager directory never expose canonical credentials', () => {
    const canonical = e.db.state.users.find((u) => u.id === user.id)!
    canonical.passwordHash = 'private-manager-credential'
    const i = o.invite(owner, invite())
    const accepted = o.accept(user, i.id)
    expect(accepted.user.roles).toContain('MANAGER')
    expect(o.managers(owner).some((m) => m.id === user.id)).toBe(true)
    expect(JSON.stringify([accepted, o.managers(owner)])).not.toMatch(
      /passwordHash|private-manager-credential/,
    )
    expect(canonical.passwordHash).toBe('private-manager-credential')
  })
  it('rejects duplicate pending invitations and unrelated acceptance', () => {
    const i = o.invite(owner, invite())
    expect(() => o.invite(owner, invite())).toThrow()
    expect(() => o.accept(tenantUser, i.id)).toThrow()
  })
  it('rejects expired and cancelled invitations', () => {
    const i = o.invite(owner, invite())
    vi.advanceTimersByTime(8 * 86400000)
    expect(() => o.accept(user, i.id)).toThrow()
    o.invitationAction(owner, i.id, 'resend')
    o.invitationAction(owner, i.id, 'cancel')
    expect(() => o.accept(user, i.id)).toThrow()
  })
  it('does not seize another Owner Manager or own identity', () => {
    expect(() => o.invite(owner, invite(otherManager.email))).toThrow()
    expect(() => o.invite(owner, invite(owner.email))).toThrow()
  })
  it('requires an active verified account and eligible inviter', () => {
    const i = o.invite(owner, invite())
    e.db.state.users.find((u) => u.id === user.id)!.status = 'PENDING_VERIFICATION'
    expect(() => o.accept(user, i.id)).toThrow()
    e.db.state.users.find((u) => u.id === user.id)!.status = 'ACTIVE'
    o.state.verification.find((v) => v.userId === owner.id)!.status = 'REJECTED'
    expect(() => o.accept(user, i.id)).toThrow()
  })
})
describe('Immutable policy versions and Branch QR', () => {
  it('preserves existing Booking snapshot and resolves future version', () => {
    const old = structuredClone(e.db.state.bookings.find((b) => b.branchId === id(10))!)
    const p = o.savePolicy(owner, id(10), { ...policy(), bookingHoldAmount: 777777 })
    expect(p.version).toBe(2)
    expect(e.db.policy(id(10)).bookingHoldAmount).toBe(777777)
    expect(e.db.state.bookings.find((b) => b.id === old.id)!.policySnapshot).toEqual(
      old.policySnapshot,
    )
    const booking = e.db.createBooking(
      {
        roomId: id(109),
        rentalMode: 'ROOM',
        startDate: '2026-11-01',
        endDate: '2026-12-01',
        policyId: p.id,
        policyVersion: p.version,
        acknowledged: true,
      },
      user.id,
    )
    expect(booking.policySnapshot.version).toBe(2)
  })
  it('keeps future policies inactive until effective', () => {
    o.savePolicy(owner, id(10), { ...policy(id(10), 86400000), bookingHoldAmount: 888888 })
    expect(e.db.policy(id(10)).version).toBe(1)
    vi.advanceTimersByTime(86400001)
    expect(e.db.policy(id(10)).version).toBe(2)
  })
  it.each([
    { collectionDay: 29 },
    { paymentGraceDays: -1 },
    { bookingHoldAmount: 1.1 },
    { paymentWindowMinutes: 0 },
    { temporaryHoldMinutes: 1 },
    { effectiveFrom: '2020-01-01T00:00:00Z' },
    {
      appointmentPolicy: {
        openingHour: 20,
        closingHour: 8,
        maxDurationMinutes: 60,
        cancellationHours: 2,
      },
    },
  ])('rejects invalid policy %j', (bad) =>
    expect(() => o.savePolicy(owner, id(10), { ...policy(), ...bad })).toThrow(),
  )
  it('rejects out-of-order versions', () => {
    o.savePolicy(owner, id(10), policy(id(10), 86400000))
    expect(() => o.savePolicy(owner, id(10), policy())).toThrow()
  })
  it('QR updates shared payment instruction, never a receipt', () => {
    const count = e.tenant.state.payments.length
    o.saveQr(owner, id(10), { image, version: 1 })
    const invoice = e.tenant.invoice(e.tenancy(id(10), id(5100)), id(5300))
    expect(invoice.manualQr?.qrUrl).toBe(image)
    expect(invoice.manualQr?.reference).toContain(id(5300))
    expect(e.tenant.state.payments).toHaveLength(count)
    expect(() => o.saveQr(otherOwner, id(10), { image, version: 2 })).toThrow()
  })
})
describe('Owner financial integrity and adjustment approvals', () => {
  it('aggregates only owned Branches using exact totals and typed contract', () => {
    const s = o.summary(owner, null, '2026-10')
    expect(s.rows.map((r) => r.id).sort()).toEqual([id(10), id(12)].sort())
    expect(s.totals.billed).toBe(s.rows.reduce((n, r) => n + r.billed, 0))
    expect(ownerSummarySchema.safeParse(s).success).toBe(true)
    expect(o.summary(owner, id(12), '2026-10').totals.billed).toBe(
      s.rows.find((r) => r.id === id(12))!.billed,
    )
    expect(() => o.summary(owner, id(11), '2026-10')).toThrow()
  })
  it('pending and sandbox money never count as actual cash', () => {
    const s = o.summary(owner, null, '2026-10')
    expect(s.totals.receipts).toBe(0)
    expect(o.summary(owner, null, '2026-09').totals.sandboxReceipts).toBeGreaterThan(0)
    expect(paymentViews(e, id(12)).find((p) => p.id === id(7900))!.status).toBe('PENDING')
  })
  it('verified manual receipt updates Owner actual receipts and Tenant debt once', () => {
    const before = o.summary(owner, id(12), '2026-10'),
      t = e.tenancy(id(12), id(5101)),
      debt = e.tenant.invoice(t, id(5301)).outstanding
    e.action(manager, id(12), 'payments', id(7900), '', {
      decision: 'verify',
      note,
      reference: 'TP-QR-DEMO-01',
      amount: 50000,
      providerTransactionId: 'BANK-DEMO-0001',
    })
    expect(o.summary(owner, id(12), '2026-10').totals.receipts - before.totals.receipts).toBe(50000)
    expect(e.tenant.invoice(t, id(5301)).outstanding).toBe(debt - 50000)
    expect(() =>
      e.action(owner, id(12), 'payments', id(7900), '', { decision: 'verify', note }),
    ).toThrow()
  })
  it('separates lifetime prepaid received/applied/unused from fresh cash', () => {
    const p = e.tenant.state.payments.find((p) => p.contractTenantId === id(5100) && !p.invoiceId)!
    p.environment = 'LIVE'
    p.verifiedAt = '2026-09-01T00:00:00Z'
    const s = o.summary(owner, null, '2026-10')
    expect(s.totals.receipts).toBe(0)
    expect(s.totals.prepaidReceived).toBe(p.amountReceived)
    expect(s.totals.prepaidApplied).toBe(p.prepaidFirstApplied + p.prepaidLastApplied)
    expect(s.totals.prepaidUnused).toBe(
      p.amountReceived - p.prepaidFirstApplied - p.prepaidLastApplied,
    )
  })
  it('Owner direct operations reuse Manager modules and cannot access foreign finance', () => {
    expect(e.get(owner, id(10), 'invoices', id(5300))).toMatchObject({ id: id(5300) })
    expect(() => e.get(owner, id(10), 'invoices', id(5301))).toThrow()
    expect(() => e.list(owner, id(11), 'payments', new URLSearchParams())).toThrow()
  })
  it('Manager submits, Owner approves, original Invoice is byte-for-byte unchanged', () => {
    const invoice = e.tenant.state.invoices.find((i) => i.id === id(5300))!,
      before = JSON.stringify(invoice),
      p = o.requestAdjustment(manager, id(10), {
        invoiceId: invoice.id,
        proposedTotal: invoice.totalAmount - 50000,
        reason: note,
        evidence: [],
      })
    expect(() => o.decide(manager, p.id, { decision: 'APPROVED', reason: note })).toThrow()
    o.decide(owner, p.id, { decision: 'APPROVED', reason: note })
    expect(p.executionStatus).toBe('NOT_APPLIED')
    expect(p.status).toBe('APPROVED')
    expect(JSON.stringify(invoice)).toBe(before)
    expect(p.history).toHaveLength(1)
    expect(() => o.decide(owner, p.id, { decision: 'APPROVED', reason: note })).toThrow()
  })
  it('rejects stale, duplicate, draft, foreign and unchanged proposals', () => {
    const i = e.tenant.state.invoices.find((i) => i.id === id(5300))!,
      value = { invoiceId: i.id, proposedTotal: i.totalAmount - 10000, reason: note, evidence: [] }
    const p = o.requestAdjustment(manager, id(10), value)
    expect(() => o.requestAdjustment(manager, id(10), value)).toThrow()
    expect(() => o.requestAdjustment(manager, id(12), value)).toThrow()
    expect(() => o.decide(otherOwner, p.id, { decision: 'APPROVED', reason: note })).toThrow()
    i.totalAmount++
    expect(() => o.decide(owner, p.id, { decision: 'APPROVED', reason: note })).toThrow()
    expect(p.status).toBe('PENDING')
  })
  it('rejection is recorded without financial application', () => {
    const i = e.tenant.state.invoices.find((i) => i.id === id(5300))!,
      p = o.requestAdjustment(manager, id(10), {
        invoiceId: i.id,
        proposedTotal: 1,
        reason: note,
        evidence: [],
      })
    o.decide(owner, p.id, { decision: 'REJECTED', reason: note })
    expect(p.status).toBe('REJECTED')
    expect(p.executionStatus).toBe('NOT_APPLIED')
  })
  it('Tenant manual evidence remains pending until trusted Manager review', () => {
    o.saveQr(owner, id(10), { image, version: 1 })
    const value = {
      amount: 50000,
      payerName: tenantUser.fullName,
      reference: `TP-MQR-${id(5300)}`,
      providerTransactionId: 'CLAIM-DEMO-991',
      evidence: [image],
      idempotencyKey: id(9950),
    }
    const p = o.submitManual(tenantUser.id, id(5100), id(5300), value)
    expect(p.status).toBe('PENDING')
    expect(o.submitManual(tenantUser.id, id(5100), id(5300), value).id).toBe(p.id)
    expect(o.summary(owner, null, '2026-10').totals.receipts).toBe(0)
    expect(() =>
      o.submitManual(user.id, id(5100), id(5300), { ...value, idempotencyKey: id(9951) }),
    ).toThrow()
    e.action(manager, id(10), 'payments', p.id, '', {
      decision: 'verify',
      note,
      reference: value.reference,
      amount: 50000,
      providerTransactionId: value.providerTransactionId,
    })
    expect(o.summary(owner, null, '2026-10').totals.receipts).toBe(50000)
  })
  it('shared activity remains scoped, safe and deterministic across reset', () => {
    o.scanActivity()
    const count = o.state.activity.length
    o.scanActivity()
    expect(o.state.activity.length).toBe(count)
    expect(JSON.stringify(o.state.activity)).not.toMatch(/passwordHash|accessToken/)
    o.invite(owner, invite())
    e.reset()
    expect(o.state.invitations).toEqual([])
    expect(e.db.policy(id(10)).version).toBe(1)
    expect(o.branches(owner)).toHaveLength(2)
  })
  it('rolls back shared mutations when persistence fails', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {},
    })
    const count = e.state.branches.length
    expect(() => o.saveBranch(owner, null, draft())).toThrow()
    expect(e.state.branches).toHaveLength(count)
    expect(o.state.activity).toHaveLength(0)
  })
})
