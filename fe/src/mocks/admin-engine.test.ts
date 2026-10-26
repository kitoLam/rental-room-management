import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { AdminEngine, adminUser as admin, secondAdmin, applicant } from './admin-engine'
import { OwnerEngine } from './owner-engine'
import { ManagerEngine } from './manager-engine'
import { MockDatabase } from './database'
import { MockInventory } from './inventory'
import { TenantEngine } from './tenant-engine'
import { demoUser as user, fixtureId as id } from './fixtures'
import { managerUser as manager, ownerUser as owner } from './manager-fixtures'
import { tenantUser as tenant } from './tenant-fixtures'
import { adminSummarySchema, adminUserSchema, auditSchema, reviewSchema } from '@/interfaces/admin'
import type { User } from '@/interfaces/domain'
let a: AdminEngine, o: OwnerEngine, e: ManagerEngine
const note = 'Đã kiểm tra đầy đủ thông tin và tài liệu mẫu.'
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvZkAAAAASUVORK5CYII='
const document = {
  name: 'ho-so-mau.png',
  mime: 'image/png',
  size: atob(image.split(',')[1]).length,
  url: image,
}
const create = (changes: Record<string, unknown> = {}) => ({
  fullName: 'Nguyễn Hồng Nhung',
  email: 'nhung@example.test',
  phone: '',
  dateOfBirth: '',
  gender: '',
  ...changes,
})
const submit = (actor = user) =>
  o.submitVerification(actor, { fullName: actor.fullName, phone: '+84901234567', document })
const decide = (actor = admin, target = user.id, decision: 'APPROVED' | 'REJECTED' = 'APPROVED') =>
  a.decide(actor, target, { decision, reason: note, version: a.review(admin, target).version })
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))
  const inventory = new MockInventory(),
    db = new MockDatabase(undefined, inventory),
    tenants = new TenantEngine(undefined, inventory)
  e = new ManagerEngine(db, tenants, inventory)
  e.tenant.state.workflowMode = 'managed'
  o = new OwnerEngine(e)
  a = new AdminEngine(o)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('Admin canonical authorization and separation', () => {
  it.each([user, tenant, manager, owner])(
    'rejects non-admin $email even with forged role claim',
    (actor) => {
      expect(() => a.summary(actor)).toThrow()
      expect(() => a.summary({ ...actor, roles: ['ADMIN'] })).toThrow()
    },
  )
  it('requires a canonical active Admin and ignores invented identities', () => {
    expect(() => a.summary({ ...admin, id: crypto.randomUUID() })).toThrow()
    a.target(admin.id).status = 'DISABLED'
    expect(() => a.summary(admin)).toThrow()
  })
  it('does not give ADMIN blanket Owner/Manager operational scope', () => {
    expect(e.branches(admin)).toEqual([])
    expect(() => e.scope(admin, id(10))).toThrow()
    expect(() => o.savePolicy(admin, id(10), {})).toThrow()
    expect(() => e.get(admin, id(10), 'invoices', id(5300))).toThrow()
  })
  it('supports legitimate multi-role Admin only within its own business scope', () => {
    submit(admin)
    expect(() => decide(admin, admin.id)).toThrow()
    decide(secondAdmin, admin.id)
    const canonical = a.target(admin.id)
    expect(canonical.roles).toEqual(['USER', 'ADMIN', 'OWNER'])
    expect(o.eligible(canonical)).toBe(true)
    expect(e.branches(canonical)).toEqual([])
    expect(() => e.scope(canonical, id(10))).toThrow()
    expect(a.summary(canonical).totalUsers).toBeGreaterThan(0)
  })
})
describe('Admin User lifecycle', () => {
  it('creates INVITED with no credentials or privileged role and persists reads', () => {
    const u = a.create(admin, create())
    expect(u.status).toBe('INVITED')
    expect(u.roles).toEqual(['USER'])
    expect(a.target(u.id).passwordHash).toBeUndefined()
    expect(u.canActivate).toBe(false)
    expect(adminUserSchema.safeParse(u).success).toBe(true)
    expect(a.users(admin, new URLSearchParams({ q: 'Hồng Nhung' })).map((u) => u.id)).toEqual([
      u.id,
    ])
  })
  it('supports email-only and phone-only invitations without fake delivery', () => {
    const u = a.create(admin, create({ email: '', phone: '+84912345000' }))
    expect(u.email).toBeNull()
    expect(u.phone).toBe('+84912345000')
    expect(e.db.notifications(u.id)).toHaveLength(0)
    expect(a.target(u.id).email).toBe('')
  })
  it('normalizes optional null API fields and contacts', () => {
    const u = a.create(admin, {
      fullName: '  Lê Thanh Trúc  ',
      email: 'TRUC@example.test',
      phone: null,
      dateOfBirth: null,
      gender: null,
    })
    expect(u.email).toBe('truc@example.test')
    expect(u.fullName).toBe('Lê Thanh Trúc')
  })
  it.each([
    { fullName: '' },
    { email: 'invalid' },
    { email: '', phone: '' },
    { phone: '0901234567' },
    { dateOfBirth: '2099-01-01' },
    { dateOfBirth: '2026-02-30' },
    { gender: 'INVALID' },
    { roles: ['ADMIN'] },
    { password: 'KnownPassword@123' },
  ])('rejects invalid/injected invitation %j', (input) =>
    expect(() => a.create(admin, create(input))).toThrow(),
  )
  it('rejects duplicate email and phone', () => {
    a.create(admin, create({ phone: '+84912345000' }))
    expect(() => a.create(admin, create({ email: 'NHUNG@example.test' }))).toThrow()
    expect(() =>
      a.create(admin, create({ email: 'another@example.test', phone: '+84912345000' })),
    ).toThrow()
  })
  it('disables account, revokes tokens and rejects stale actor operations', () => {
    e.db.state.sessions['old-manager'] = manager.id
    e.db.state.refreshUserId = manager.id
    const m = a.project(manager.id)
    a.status(admin, m.id, { active: false, version: m.version, reason: note })
    expect(a.target(m.id).status).toBe('DISABLED')
    expect(e.db.state.sessions['old-manager']).toBeUndefined()
    expect(e.db.state.refreshUserId).toBeNull()
    expect(() => e.scope(manager, id(10))).toThrow()
    expect(a.state.events[0].action).toBe('USER_DISABLED')
  })
  it('valid activation restores scope but never resurrects revoked session tokens', () => {
    a.status(admin, manager.id, { active: false, version: 1 })
    const m = a.project(manager.id)
    expect(m.canActivate).toBe(true)
    a.status(admin, m.id, { active: true, version: m.version })
    expect(e.scope(manager, id(10)).id).toBe(id(10))
    expect(a.state.events[0].action).toBe('USER_ACTIVATED')
  })
  it('protects normal self-disable and last effective Admin', () => {
    expect(() => a.status(admin, admin.id, { active: false })).toThrow()
    a.status(admin, secondAdmin.id, { active: false })
    expect(() => a.status(admin, admin.id, { active: false })).toThrow()
    expect(a.target(admin.id).status).toBe('ACTIVE')
  })
  it.each(['INVITED', 'PENDING_VERIFICATION', 'LOCKED'] as const)(
    'cannot force %s account activation',
    (status) => {
      const invited = a.create(admin, create())
      a.target(invited.id).status = status
      expect(() => a.status(admin, invited.id, { active: true })).toThrow()
    },
  )
  it('does not activate unverified disabled accounts even if credentials exist', () => {
    const invited = a.create(admin, create())
    a.target(invited.id).status = 'DISABLED'
    a.target(invited.id).passwordHash = 'test-only-hash'
    expect(() => a.status(admin, invited.id, { active: true })).toThrow()
  })
  it('rejects stale updates, repeated deactivation and arbitrary statuses', () => {
    a.status(admin, manager.id, { active: false, version: 1 })
    expect(() => a.status(admin, manager.id, { active: true, version: 1 })).toThrow()
    expect(() => a.status(admin, manager.id, { active: false, version: 2 })).toThrow()
    expect(() => a.status(admin, user.id, { active: false, status: 'LOCKED' })).toThrow()
  })
  it('lists only safe projected fields, global mock filters and valid date ranges', () => {
    a.target(user.id).passwordHash = 'secret-test'
    const rows = a.users(admin, new URLSearchParams({ role: 'ADMIN' }))
    expect(rows.map((u) => u.id)).toEqual([admin.id, secondAdmin.id])
    expect(JSON.stringify(a.project(user.id))).not.toContain('secret-test')
    expect(() => a.users(admin, new URLSearchParams({ from: 'wrong' }))).toThrow()
    expect(() =>
      a.users(admin, new URLSearchParams({ from: '2026-10-20', to: '2026-10-10' })),
    ).toThrow()
  })
})
describe('Admin Owner review: trusted transition, safe documents and concurrency', () => {
  it('shared submission appears in Admin view and generates deduplicated Admin notifications', () => {
    submit()
    a.scan()
    const count = e.db.notifications(admin.id).length
    a.scan()
    expect(e.db.notifications(admin.id)).toHaveLength(count)
    expect(a.review(admin, user.id).verification.status).toBe('PENDING')
    expect(
      e.db
        .notifications(admin.id)
        .some((n) => n.referenceId === user.id && n.referenceType === 'ADMIN_VERIFICATION'),
    ).toBe(true)
    expect(
      e.db.notifications(tenant.id).some((n) => n.referenceType === 'ADMIN_VERIFICATION'),
    ).toBe(false)
  })
  it('trusted approval provisions canonical OWNER, latest reviewer metadata, one audit and proper inboxes', () => {
    submit()
    const before = e.tenant.state.invoices.length
    const r = decide()
    expect(r.verification.status).toBe('APPROVED')
    expect(r.verification.reviewedBy).toBe(admin.id)
    expect(r.reviewerName).toBe(admin.fullName)
    expect(r.verification.eligible).toBe(true)
    expect(a.target(user.id).roles).toContain('OWNER')
    expect(r.history).toHaveLength(1)
    expect(r.history[0].detail.provisionedOwner).toBe(true)
    expect(e.db.notifications(user.id).some((n) => n.referenceType === 'OWNER_VERIFICATION')).toBe(
      true,
    )
    expect(e.tenant.state.invoices).toHaveLength(before)
    expect(reviewSchema.safeParse(r).success).toBe(true)
  })
  it('rejection needs reason, does not provision and permits a new submission with new version', () => {
    submit()
    const old = a.review(admin, user.id)
    expect(() =>
      a.decide(admin, user.id, { decision: 'REJECTED', reason: '', version: old.version }),
    ).toThrow()
    decide(admin, user.id, 'REJECTED')
    expect(a.target(user.id).roles).not.toContain('OWNER')
    expect(o.verification(user).reason).toBe(note)
    submit()
    expect(a.review(admin, user.id).version).not.toBe(old.version)
    expect(() =>
      a.decide(admin, user.id, { decision: 'APPROVED', reason: note, version: old.version }),
    ).toThrow()
  })
  it('rejects duplicate competing reviews with no extra events or notifications', () => {
    submit()
    const version = a.review(admin, user.id).version
    a.decide(admin, user.id, { decision: 'APPROVED', reason: note, version })
    const events = a.state.events.length,
      notifications = e.db.state.notifications.length
    expect(() =>
      a.decide(secondAdmin, user.id, { decision: 'REJECTED', reason: note, version }),
    ).toThrow()
    expect(a.state.events).toHaveLength(events)
    expect(e.db.state.notifications).toHaveLength(notifications)
    expect(o.verification(user).status).toBe('APPROVED')
  })
  it('rejects stale document changes, missing evidence and disabled applicant', () => {
    submit()
    const version = a.review(admin, user.id).version
    o.state.verification.find((v) => v.userId === user.id)!.document!.resourceId =
      'mock-private/replaced'
    expect(() =>
      a.decide(admin, user.id, { decision: 'APPROVED', reason: note, version }),
    ).toThrow()
    o.state.verification.find((v) => v.userId === user.id)!.document = null
    expect(() => decide()).toThrow()
  })
  it('disabled applicant cannot be reviewed until valid activation', () => {
    submit()
    a.status(admin, user.id, { active: false })
    expect(() => decide()).toThrow()
    a.status(admin, user.id, { active: true })
    expect(decide().verification.status).toBe('APPROVED')
  })
  it('documents are Admin-only, short lived, sample only and not persisted', () => {
    submit()
    expect(() => a.document(owner, user.id)).toThrow()
    expect(() => a.document(user, user.id)).toThrow()
    const doc = a.document(admin, user.id)
    expect(Date.parse(doc.expiresAt) - Date.now()).toBe(60000)
    expect(doc.content).toContain('TÀI LIỆU MẪU')
    expect(JSON.stringify(a.state)).not.toContain('<svg')
    expect(JSON.stringify(o.state)).not.toContain(image)
    expect(() => a.document(admin, manager.id)).toThrow()
  })
  it('not submitted and self applications cannot be approved', () => {
    expect(() => decide()).toThrow()
    submit(admin)
    expect(() => decide(admin, admin.id)).toThrow()
  })
})
describe('Admin read-only directories, activity and reset', () => {
  it('complete USER → ADMIN → OWNER → MANAGER → TENANT journey shares contracts, service, payment, maintenance and summaries', () => {
    submit()
    decide()
    const newOwner = a.target(user.id)
    const draft = {
      code: 'JOURNEY',
      name: 'TroPro hành trình',
      address: '15 Đường số 2',
      province: '',
      district: '',
      ward: '',
      latitude: null,
      longitude: null,
      description: 'Chi nhánh thử nghiệm',
      rules: [],
      publicPhone: '',
      publicEmail: '',
      images: [],
      isPublic: true,
      status: 'DRAFT' as const,
      managerId: null,
    }
    const branch = o.saveBranch(newOwner, null, draft),
      base = o.state.policies[0]
    o.savePolicy(newOwner, branch.id, {
      effectiveFrom: new Date().toISOString(),
      collectionDay: 5,
      paymentGraceDays: 3,
      bookingHoldAmount: 500000,
      paymentWindowMinutes: 15,
      temporaryHoldMinutes: 30,
      confirmedHoldMinutes: 1440,
      appointmentPolicy: base.appointmentPolicy,
      cancellationTerms: note,
    })
    const operator: User = {
        ...applicant,
        id: id(8030),
        email: 'journey-manager@example.test',
        fullName: 'Võ Trọng Nam',
        roles: ['USER'],
      },
      renter: User = {
        ...user,
        id: id(8031),
        email: 'journey-tenant@example.test',
        fullName: 'Lê Bảo Ngọc',
        roles: ['USER'],
      }
    e.db.state.users.push(structuredClone(operator), structuredClone(renter))
    const invite = o.invite(newOwner, {
      fullName: operator.fullName,
      email: operator.email,
      phone: '',
      branchIds: [branch.id],
      note,
    })
    const linked = o.accept(operator, invite.id).user
    o.assign(newOwner, branch.id, linked.id, branch.version, note)
    const active = o.branch(newOwner, branch.id)
    o.saveBranch(
      newOwner,
      branch.id,
      { ...draft, status: 'ACTIVE', managerId: linked.id },
      active.version,
    )
    const act = (
      resource: import('@/interfaces/manager').ManagerResource,
      target: string | null,
      value: unknown,
      action = '',
    ) => e.action(linked, branch.id, resource, target, action, value) as { id: string }
    const type = act('room-types', null, {
      code: 'TYPE-J',
      name: 'Phòng hành trình',
      defaultCapacity: 2,
      description: '',
      active: true,
    })
    const electric = act('services', null, {
      code: 'ELEC-J',
      name: 'Điện',
      unit: 'kWh',
      type: 'ELECTRICITY',
      billingMethod: 'METERED',
      unitPrice: 3500,
      mandatory: true,
      active: true,
    })
    act('services', null, {
      code: 'WATER-J',
      name: 'Nước',
      unit: 'm³',
      type: 'WATER',
      billingMethod: 'METERED',
      unitPrice: 15000,
      mandatory: true,
      active: true,
    })
    const internet = act('services', null, {
      code: 'NET-J',
      name: 'Internet',
      unit: 'tháng',
      type: 'INTERNET',
      billingMethod: 'FIXED',
      unitPrice: 100000,
      mandatory: false,
      active: true,
    })
    const room = act('rooms', null, {
      code: 'J-01',
      title: 'Phòng mới hành trình',
      roomTypeId: type.id,
      rentalMode: 'ROOM',
      capacity: 2,
      sizeM2: 25,
      floor: 1,
      price: 3000000,
      description: 'Phòng thử nghiệm liên vai trò.',
      amenities: [],
      images: [],
      operationalStatus: 'ACTIVE',
      isPublic: true,
    })
    act('room-services', null, {
      roomId: room.id,
      serviceId: internet.id,
      startDate: '2026-10-16',
      endDate: '2027-01-01',
      unitPrice: 100000,
    })
    const policy = e.db.policy(branch.id),
      booking = e.db.createBooking(
        {
          roomId: room.id,
          rentalMode: 'ROOM',
          startDate: '2026-10-16',
          endDate: '2026-11-16',
          policyId: policy.id,
          policyVersion: policy.version,
          acknowledged: true,
        },
        renter.id,
      )
    const hold = e.db.initiatePayment(booking.id, renter.id, 'success')
    e.db.tick(hold.settlementAt + 1)
    const contract = act(
        'bookings',
        booking.id,
        {
          code: 'CT-JOURNEY',
          terms: note,
          monthlyRent: 3000000,
          firstMonthRent: 3000000,
          lastMonthRent: 0,
        },
        'convert',
      ),
      t = e.tenant.state.tenancies.find((t) => t.contractId === contract.id)!
    const prepay = e.tenant.prepay(t, {
      bucket: 'FIRST_MONTH',
      amount: 3000000,
      payerName: renter.fullName,
      idempotencyKey: crypto.randomUUID(),
    })
    e.tenant.tick(vi.fn(), prepay.settlementAt + 1)
    act('contracts', contract.id, { reason: note }, 'activate')
    expect(e.tenant.own(renter.id, t.id).status).toBe('ACTIVE')
    expect(a.target(renter.id).roles).toContain('TENANT')
    const request = e.tenant.service(t, {
      serviceId: internet.id,
      startDate: t.startDate,
      endDate: t.endDate,
      note,
    })
    act('service-requests', request.id, {
      contractTenantId: t.id,
      decision: 'approve',
      reason: note,
    })
    expect(request.status).toBe('APPROVED')
    const invoice = act('invoices', null, {
      contractTenantId: t.id,
      billingMonth: '2026-10-01',
      dueDate: '2026-10-31',
      rentAmount: 3000000,
      rentApprovalNote: note,
      sources: [],
      adjustment: 0,
      adjustmentReason: '',
      prepaidAmount: 0,
      prepaidSourcePaymentId: null,
      prepaidBucket: 'FIRST_MONTH',
    })
    act('invoices', invoice.id, { reason: note }, 'issue')
    const payment = e.tenant.pay(t, invoice.id, {
      amount: 50000,
      payerName: renter.fullName,
      idempotencyKey: crypto.randomUUID(),
    })
    e.tenant.tick(vi.fn(), payment.settlementAt + 1)
    expect(e.tenant.invoice(t, invoice.id).outstanding).toBe(2950000)
    const repair = e.tenant.report(t, {
      assetId: electric.id,
      category: 'SERVICE',
      title: 'Kiểm tra điện trong phòng',
      description: 'Cần kiểm tra nguồn điện tại khu vực sinh hoạt.',
      priority: 'NORMAL',
      attachments: [],
    })
    for (const action of ['accept', 'start', 'complete'])
      act('maintenance', repair.id, { reason: note }, action)
    expect(repair.status).toBe('COMPLETED')
    const summary = o.summary(newOwner, branch.id, '2026-10')
    expect(summary.totals.billed).toBe(3000000)
    expect(summary.totals.receipts).toBe(0)
    expect(summary.totals.sandboxReceipts).toBe(3050000)
    expect(summary.totals.activeContracts).toBe(1)
    expect(
      a.branches(admin, new URLSearchParams({ ownerId: newOwner.id })).map((b) => b.id),
    ).toEqual([branch.id])
    expect(() => e.get(admin, branch.id, 'invoices', invoice.id)).toThrow()
  })
  it('reports the five exact roles with coherent counts and no grant interface', () => {
    const roles = a.roles(admin)
    expect(roles.map((r) => r.id)).toEqual(['USER', 'TENANT', 'MANAGER', 'OWNER', 'ADMIN'])
    expect(roles.find((r) => r.id === 'ADMIN')!.userCount).toBe(2)
    expect(auditSchema.safeParse({}).success).toBe(false)
  })
  it('shows Owner/Branch summaries only, including Branch created through Owner engine', () => {
    const b = o.saveBranch(owner, null, {
      code: 'ADMIN-VIEW',
      name: 'TroPro Linh Trung',
      address: '15 Đường số 2',
      province: '',
      district: '',
      ward: '',
      latitude: null,
      longitude: null,
      description: '',
      rules: [],
      publicPhone: '',
      publicEmail: '',
      images: [],
      isPublic: false,
      status: 'DRAFT',
      managerId: null,
    })
    expect(a.branches(admin, new URLSearchParams({ q: 'ADMIN-VIEW' })).map((v) => v.id)).toEqual([
      b.id,
    ])
    expect(a.owners(admin, new URLSearchParams()).some((v) => v.id === owner.id)).toBe(true)
    expect(JSON.stringify(a.branches(admin, new URLSearchParams()))).not.toMatch(
      /payments|invoice|tenantSnapshot|qrUrl|zaloUrl/,
    )
    expect(() => o.assign(admin, b.id, manager.id, b.version, note)).toThrow()
  })
  it('consumes safe Owner assignment events once and exposes no raw audit secrets', () => {
    const i = o.invite(owner, {
      fullName: user.fullName,
      email: user.email,
      phone: '',
      branchIds: [],
      note: '',
    })
    o.accept(user, i.id)
    o.assign(owner, id(10), user.id, o.branch(owner, id(10)).version, note)
    a.scan()
    const count = a.state.events.length
    a.scan()
    expect(a.state.events).toHaveLength(count)
    expect(a.state.events.some((v) => v.action === 'MANAGER_ASSIGNMENT')).toBe(true)
    const event = a.record(admin, 'USER_INVITED', user.id, 'Tài khoản được mời.', null, {
      status: 'INVITED',
      passwordHash: 'secret',
      refreshToken: 'secret',
    } as never)
    expect(event.detail).toEqual({ status: 'INVITED' })
    expect(JSON.stringify(a.activity(admin, new URLSearchParams()))).not.toContain('secret')
  })
  it('dashboard totals use shared users, account states and Branches', () => {
    const s = a.summary(admin)
    expect(s.totalUsers).toBe(e.db.state.users.length)
    expect(s.accounts.reduce((n, c) => n + c.count, 0)).toBe(s.totalUsers)
    expect(s.branches.reduce((n, c) => n + c.count, 0)).toBe(e.state.branches.length)
    expect(adminSummarySchema.safeParse(s).success).toBe(true)
    expect(JSON.stringify(s)).not.toMatch(/revenue|debt|receipts/)
  })
  it('controlled reset restores domain and Admin seed states without resurrecting stale tokens', () => {
    a.status(admin, secondAdmin.id, { active: false })
    a.create(admin, create())
    a.reset(admin)
    expect(a.state.events).toHaveLength(0)
    expect(a.target(secondAdmin.id).status).toBe('ACTIVE')
    expect(a.review(admin, applicant.id).verification.status).toBe('PENDING')
    expect(e.state.branches).toHaveLength(3)
    expect(() => a.reset(secondAdmin)).toThrow()
  })
  it('storage failures roll back invitation and review atomically', () => {
    submit()
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
    })
    const count = e.db.state.users.length
    expect(() => a.create(admin, create())).toThrow()
    expect(e.db.state.users).toHaveLength(count)
    expect(() => decide()).toThrow()
    expect(o.verification(user).status).toBe('PENDING')
    expect(a.target(user.id).roles).not.toContain('OWNER')
    expect(a.state.events).toHaveLength(0)
  })
})
