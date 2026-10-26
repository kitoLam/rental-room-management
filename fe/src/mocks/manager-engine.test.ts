import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { ManagerEngine } from './manager-engine'
import { MockDatabase } from './database'
import { MockInventory } from './inventory'
import { TenantEngine } from './tenant-engine'
import { managerUser as manager, ownerUser as owner, otherManager } from './manager-fixtures'
import { tenantUser } from './tenant-fixtures'
import { fixtureId as id, demoUser } from './fixtures'
import { managerSchemas, type ManagerResource, type ManagerContract } from '@/interfaces/manager'
import { invoiceSources, paymentViews, sumVnd } from './manager-finance'
import { saveZalo } from './manager-operations'
import { referenceLink } from '@/lib/activity'
let e: ManagerEngine
const b = id(10),
  shared = id(12),
  today = () => new Date().toISOString().slice(0, 10)
const month = (offset = 1) => {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toISOString().slice(0, 10)
}
const note = 'Đã đối chiếu hồ sơ và thỏa thuận hợp lệ.'
const act = (
  resource: ManagerResource,
  resourceId: string | null,
  value: unknown,
  action = '',
  branch = b,
  method = 'POST',
) => e.action(manager, branch, resource, resourceId, action, value, method) as { id: string }
const tenancy = () => e.tenancy(b, id(5100))
const roomInput = () => {
  const room = e.room(b, id(109))
  return {
    ...room,
    code: 'TD-NEW',
    roomTypeId: e.inventory.state.types.find((t) => t.branchId === b)!.id,
    isPublic: false,
  }
}
const chargeInput = (branch = shared) => {
  const t = e.tenancy(branch, branch === shared ? id(5101) : id(5100)),
    s = e.state.services.find((s) => s.branchId === branch && s.type === 'ELECTRICITY')!
  return {
    roomId: t.roomId,
    serviceId: s.id,
    billingMonth: month(),
    segments: [
      {
        startDate: month(),
        endDate: month(2),
        previousReading: 0,
        currentReading: 101,
        quantity: 101,
        unitPrice: 3501,
        reason: 'NORMAL',
        meterId: e.meterId(t.roomId, s.id, 0),
      },
    ],
    evidence: [],
  }
}
const invoiceInput = (branch = shared, tenantId = id(5101)) => ({
  contractTenantId: tenantId,
  billingMonth: month(),
  dueDate: month(2),
  rentAmount: e.tenancy(branch, tenantId).monthlyRent,
  rentApprovalNote: note,
  sources: [],
  adjustment: 0,
  adjustmentReason: '',
  prepaidAmount: 0,
  prepaidSourcePaymentId: null,
  prepaidBucket: 'FIRST_MONTH',
})
const newContract = () =>
  act('contracts', null, {
    code: 'TP-NEW',
    roomId: id(109),
    startDate: today(),
    endDate: month(3),
    terms: note,
  })
const tenantInput = () => ({
  userId: demoUser.id,
  roomSlotId: null,
  role: 'REPRESENTATIVE',
  startDate: today(),
  endDate: month(3),
  monthlyRent: 3000000,
  firstMonthRent: 3000000,
  lastMonthRent: 3000000,
  prepaidFirstRequired: 3000000,
  prepaidLastRequired: 3000000,
  terms: note,
})
beforeEach(() => {
  const inventory = new MockInventory(),
    db = new MockDatabase(undefined, inventory),
    tenant = new TenantEngine(undefined, inventory)
  e = new ManagerEngine(db, tenant, inventory)
  e.tenant.state.workflowMode = 'managed'
})
afterEach(() => vi.unstubAllGlobals())
describe('Manager authorization and coherent read models', () => {
  it('permits only assigned branches linked to the correct owner', () => {
    expect(e.branches(manager).map((b) => b.id)).toEqual([b, shared])
    expect(() => e.list(manager, id(11), 'rooms')).toThrow(/quyền/)
    e.state.ownerManagers = []
    expect(e.branches(manager)).toEqual([])
  })
  it('never grants operational scope to a USER or TENANT role', () => {
    expect(() => e.scope(demoUser, b)).toThrow()
    expect(() => e.scope(tenantUser, b)).toThrow()
  })
  it('allows Owner operations only on own branches', () => {
    expect(e.scope(owner, b).ownerId).toBe(owner.id)
    expect(() => e.scope(owner, id(11))).toThrow()
    expect(() => e.scope(otherManager, b)).toThrow()
  })
  it('revocation denies reads and writes using an existing actor object', () => {
    e.revoke(owner, b)
    expect(() => e.get(manager, b, 'rooms', id(100))).toThrow()
    expect(() => act('rooms', null, roomInput())).toThrow()
    expect(() => e.revoke(manager, shared)).toThrow()
  })
  it('switches all scoped resources and does not expose cross-branch detail', () => {
    expect(
      (e.list(manager, b, 'tenants') as { branchId: string }[]).every((t) => t.branchId === b),
    ).toBe(true)
    expect((e.list(manager, shared, 'tenants') as unknown[]).length).toBe(2)
    expect(() => e.get(manager, b, 'tenants', id(5101))).toThrow()
  })
  it('validates every seeded manager resource against its public contract', () => {
    for (const branch of e.branches(manager))
      for (const resource of Object.keys(managerSchemas) as ManagerResource[])
        for (const record of e.list(manager, branch.id, resource))
          expect(
            managerSchemas[resource].safeParse(record).success,
            `${branch.id} ${resource}`,
          ).toBe(true)
  })
  it('binds all room types and slots to their actual room branch', () => {
    for (const r of e.inventory.state.rooms)
      expect(
        e.inventory.state.types.some((t) => t.id === r.roomTypeId && t.branchId === r.branchId),
      ).toBe(true)
    for (const s of e.inventory.state.slots)
      expect(e.room(s.branchId, s.roomId).rentalMode).toBe('SLOT')
  })
  it('shares active occupancy with public availability', () => {
    expect(e.db.availability(id(100), today(), month()).available).toBe(false)
    const available = e.db.availability(id(102), today(), month())
    expect(available.slots.filter((s) => !s.available)).toHaveLength(2)
  })
  it('filters real tenant/contract/slot and financial references', () => {
    expect(
      e.list(
        manager,
        shared,
        'tenants',
        new URLSearchParams({ contractId: id(5201), roomSlotId: id(1020) }),
      ),
    ).toHaveLength(1)
    expect(
      e.list(manager, shared, 'payments', new URLSearchParams({ invoiceId: id(5301) })),
    ).toHaveLength(1)
  })
  it('keeps manager inbox references branch-scoped and deduplicated', () => {
    e.scanInbox()
    const first = e.db.notifications(manager.id)
    expect(first.length).toBeGreaterThan(0)
    expect(
      first.every(
        (n) =>
          n.branchId &&
          referenceLink(n.referenceType, n.referenceId, n.contractTenantId, n.branchId)?.includes(
            `branchId=${n.branchId}`,
          ),
      ),
    ).toBe(true)
    e.scanInbox()
    expect(e.db.notifications(manager.id)).toHaveLength(first.length)
  })
  it('restores linked scenarios while preserving session, identity and manual receipt', () => {
    e.db.state.sessions.test = manager.id
    e.db.state.refreshUserId = manager.id
    e.revoke(owner, b)
    e.reset()
    expect(e.db.state.sessions.test).toBe(manager.id)
    expect(e.db.state.refreshUserId).toBe(manager.id)
    expect(e.scope(manager, b)).toBeDefined()
    expect(e.tenant.state.payments.filter((p) => p.id === id(7900))).toHaveLength(1)
    expect(paymentViews(e, shared).some((p) => p.id === id(7900))).toBe(true)
  })
  it('rolls back all related state and partial persisted writes on storage failure', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === 'tropro-tenant-v1') throw new Error('quota')
        storage.set(k, v)
      },
      removeItem: (k: string) => storage.delete(k),
    })
    const before = structuredClone({
      inventory: e.inventory.state,
      manager: e.state,
      tenant: e.tenant.state,
      db: e.db.state,
    })
    expect(() => act('rooms', null, roomInput())).toThrow(/Bộ nhớ/)
    expect({
      inventory: e.inventory.state,
      manager: e.state,
      tenant: e.tenant.state,
      db: e.db.state,
    }).toEqual(before)
    expect(storage.size).toBe(0)
  })
})
describe('Room and slot integrity', () => {
  it('creates a private room with mandatory electricity/water configurations', () => {
    const r = act('rooms', null, roomInput())
    expect(
      e.db.listRooms({
        q: 'TD-NEW',
        area: '',
        roomTypeId: '',
        mode: 'ALL',
        availableOnly: false,
        sort: 'recommended',
        page: 1,
      }),
    ).toHaveLength(0)
    expect(e.state.roomServices.filter((s) => s.roomId === r.id)).toHaveLength(2)
  })
  it('rejects duplicate room code case-insensitively', () =>
    expect(() =>
      act('rooms', null, { ...roomInput(), code: e.room(b, id(100)).code.toLowerCase() }),
    ).toThrow(/Mã phòng/))
  it('rejects room type from another branch', () =>
    expect(() =>
      act('rooms', null, {
        ...roomInput(),
        roomTypeId: e.inventory.state.types.find((t) => t.branchId === shared)!.id,
      }),
    ).toThrow())
  it('protects active occupancy from mode/capacity changes and deletion', () => {
    expect(() =>
      act('rooms', id(100), { ...e.room(b, id(100)), rentalMode: 'SLOT' }, '', b, 'PATCH'),
    ).toThrow()
    expect(() => act('rooms', id(100), {}, '', b, 'DELETE')).toThrow()
  })
  it('rejects SLOT attached to ROOM parent and cross-branch room', () => {
    const s = { roomId: id(100), code: 'S5', name: 'Chỗ mới', operationalStatus: 'ACTIVE' }
    expect(() => act('slots', null, s)).toThrow()
    expect(() => act('slots', null, { ...s, roomId: id(102) })).toThrow()
  })
  it('rejects exceeding capacity and disabling an occupied SLOT', () => {
    expect(() =>
      act(
        'slots',
        null,
        { roomId: id(102), code: 'S5', name: 'Chỗ mới', operationalStatus: 'ACTIVE' },
        '',
        shared,
      ),
    ).toThrow(/sức chứa/)
    expect(() =>
      act(
        'slots',
        id(1020),
        { roomId: id(102), code: 'S1', name: 'Chỗ 1', operationalStatus: 'INACTIVE' },
        '',
        shared,
        'PATCH',
      ),
    ).toThrow(/đang có/)
  })
  it('rejects non-image content at API boundary without mutating inventory', () => {
    const before = e.inventory.state.rooms.length
    expect(() =>
      act('rooms', null, { ...roomInput(), images: ['data:image/png;base64,dGVzdA=='] }),
    ).toThrow(/ảnh/)
    expect(e.inventory.state.rooms).toHaveLength(before)
  })
})
describe('USER to Manager to Tenant leasing', () => {
  it('shows USER appointment in queue and shares confirmed status/notification', () => {
    const a = e.db.createAppointment(
      {
        roomId: id(109),
        startAt: `${month()}T10:00:00+07:00`,
        endAt: `${month()}T10:30:00+07:00`,
        note: '',
      },
      demoUser.id,
    )
    expect(e.list(manager, b, 'appointments')).toContainEqual(expect.objectContaining(a))
    act('appointments', a.id, { status: 'CONFIRMED', reason: note })
    expect(e.db.own(e.db.state.appointments, a.id, demoUser.id).status).toBe('CONFIRMED')
    expect(e.db.notifications(demoUser.id).some((n) => n.referenceId === a.id)).toBe(true)
  })
  it('rejects conflicting manager appointments and illegal transitions', () => {
    const a = e.db.createAppointment(
      {
        roomId: id(109),
        startAt: `${month()}T10:00:00+07:00`,
        endAt: `${month()}T10:30:00+07:00`,
        note: '',
      },
      demoUser.id,
    )
    e.db.state.appointments.push({
      ...a,
      id: crypto.randomUUID(),
      roomId: id(103),
      status: 'CONFIRMED',
    })
    expect(() => act('appointments', a.id, { status: 'CONFIRMED', reason: note })).toThrow(/Trùng/)
    expect(() => act('appointments', a.id, { status: 'COMPLETED', reason: note })).toThrow()
  })
  it('cannot confirm a booking before verified hold or after expiry', () => {
    const booking = e.db.state.bookings.find((b) => b.id === id(303))!
    expect(() => act('bookings', booking.id, { decision: 'confirm', reason: note })).toThrow(
      /xác minh/,
    )
    e.db.state.bookings.find((b) => b.id === booking.id)!.paymentDueAt = '2020-01-01T00:00:00Z'
    expect(() => act('bookings', booking.id, { decision: 'confirm', reason: note })).toThrow(
      /hết hạn/,
    )
  })
  it('converts an eligible verified SLOT hold exactly once without reclassifying cash', () => {
    const booking = e.db.state.bookings.find((b) => b.id === id(305))!,
      cash = e.db.state.payments.reduce((s, p) => s + p.amount, 0),
      c = act(
        'bookings',
        booking.id,
        {
          code: 'TP-CONVERT',
          terms: note,
          monthlyRent: 1900000,
          firstMonthRent: 1900000,
          lastMonthRent: 1900000,
        },
        'convert',
        shared,
      )
    const t = e.tenant.state.tenancies.find((t) => t.contractId === c.id)!
    expect(t.roomSlotId).toBe(booking.roomSlotId)
    expect(t.status).toBe('DRAFT')
    expect(e.db.state.payments.reduce((s, p) => s + p.amount, 0)).toBe(cash)
    expect(() =>
      act('bookings', booking.id, { code: 'TP-REPEAT', terms: note }, 'convert', shared),
    ).toThrow(/đã được/)
    expect(e.tenant.state.payments.some((p) => p.contractTenantId === t.id)).toBe(false)
  })
  it('requires exactly one representative and verified prepaid before activation', () => {
    const c = newContract()
    expect(() => act('contracts', c.id, { reason: note }, 'activate')).toThrow(/đại diện/)
    act('tenants', null, { ...tenantInput(), contractId: c.id })
    expect(() => act('contracts', c.id, { reason: note }, 'activate')).toThrow(/trả trước/)
  })
  it('completes DRAFT prepay with trusted provider then activates individual obligations', () => {
    const c = newContract(),
      result = act('tenants', null, { ...tenantInput(), contractId: c.id })
    for (const bucket of ['FIRST_MONTH', 'LAST_MONTH']) {
      const t = e.tenancy(b, result.id),
        p = e.tenant.prepay(t, {
          bucket,
          amount: 3000000,
          payerName: demoUser.fullName,
          idempotencyKey: crypto.randomUUID(),
        })
      expect(p.status).toBe('PENDING')
      e.tenant.tick(vi.fn(), p.settlementAt + 1)
      expect(p.verifiedAt).not.toBeNull()
    }
    act('contracts', c.id, { reason: note }, 'activate')
    expect(e.tenancy(b, result.id).status).toBe('ACTIVE')
    expect(e.db.state.users.find((u) => u.id === demoUser.id)?.roles).toContain('TENANT')
  })
  it('prevents duplicate and excess prepay with idempotent retries', () => {
    const c = newContract(),
      t = e.tenancy(b, act('tenants', null, { ...tenantInput(), contractId: c.id }).id),
      input = {
        bucket: 'FIRST_MONTH',
        amount: 3000000,
        payerName: demoUser.fullName,
        idempotencyKey: crypto.randomUUID(),
      }
    expect(e.tenant.prepay(t, input).id).toBe(e.tenant.prepay(t, input).id)
    expect(() => e.tenant.prepay(t, { ...input, idempotencyKey: crypto.randomUUID() })).toThrow()
    expect(() => e.tenant.prepay(t, { ...input, amount: 2 })).toThrow()
  })
  it('keeps shared SLOT obligations and only one representative during change', () => {
    act('tenants', id(5103), { contractId: id(5201) }, 'representative', shared)
    expect(
      e.tenant.state.tenancies.filter(
        (t) => t.contractId === id(5201) && t.role === 'REPRESENTATIVE',
      ),
    ).toHaveLength(1)
    expect(e.tenancy(shared, id(5103)).role).toBe('REPRESENTATIVE')
    expect(e.tenancy(shared, id(5101)).monthlyRent).toBe(2300000)
  })
  it('does not edit active financial terms or end contracts before expiry', () => {
    expect(() => act('tenants', id(5100), { ...tenantInput(), contractId: id(5200) })).toThrow()
    expect(() => act('contracts', id(5200), { reason: note }, 'end')).toThrow()
    expect(() =>
      act('contracts', id(5200), {
        code: 'EDIT',
        roomId: id(100),
        startDate: today(),
        endDate: month(3),
        terms: note,
      }),
    ).toThrow()
  })
})
describe('Service approval and segmented charges', () => {
  it.each(['approve', 'reject'])(
    'keeps Tenant optional service pending until Manager %s',
    (decision) => {
      const t = tenancy(),
        s = e.tenant.service(t, {
          serviceId: id(5602),
          startDate: today(),
          endDate: t.endDate,
          note: '',
        })
      e.tenant.tick(vi.fn(), s.decisionAt + 100)
      expect(s.status).toBe('PENDING')
      act('service-requests', s.id, { contractTenantId: t.id, decision, reason: note })
      expect(
        e.tenant.state.services.find((s) => s.id === id(5602) && s.contractTenantId === t.id)
          ?.status,
      ).toBe(decision === 'approve' ? 'APPROVED' : 'REJECTED')
    },
  )
  it('protects mandatory electricity/water from Manager cancellation', () =>
    expect(() =>
      act('service-requests', id(5600), {
        contractTenantId: id(5100),
        decision: 'approve',
        reason: note,
      }),
    ).toThrow(/bắt buộc/))
  it('preserves effective price history when room-service price changes', () => {
    const config = e.state.roomServices.find(
      (s) => s.roomId === id(100) && s.serviceId === id(5600),
    )!
    act('room-services', config.id, {
      roomId: config.roomId,
      serviceId: config.serviceId,
      startDate: month(),
      endDate: '2030-01-01',
      unitPrice: 4000,
    })
    expect(e.state.roomServices.find((s) => s.id === config.id)?.endDate).toBe(month())
    expect(e.state.roomServices.find((s) => s.id === config.id)?.unitPrice).toBe(3500)
  })
  it('creates exact integer charge and default allocations to individual tenants', () => {
    const c = act('utility-charges', null, chargeInput(), ' ', shared)
    act('utility-charges', c.id, { reason: note }, 'finalize', shared)
    const projections = e.tenant.state.charges.filter((v) => v.id === c.id)
    expect(projections).toHaveLength(2)
    expect(projections.reduce((s, p) => s + p.myAmount, 0)).toBe(353601)
    expect(projections[0].participants.reduce((s, p) => s + p.amount, 0)).toBe(353601)
  })
  it('rejects negative consumption, excess precision and foreign meter', () => {
    for (const segment of [
      { currentReading: -1 },
      { currentReading: 0 },
      { currentReading: 1.0001 },
      { meterId: crypto.randomUUID() },
    ]) {
      const data = chargeInput()
      expect(() =>
        act(
          'utility-charges',
          null,
          { ...data, segments: [{ ...data.segments[0], ...segment }] },
          '',
          shared,
        ),
      ).toThrow()
    }
  })
  it('rejects overlapping/gapped segments and non-continuous normal readings', () => {
    const data = chargeInput()
    for (const startDate of [month(), month(2)])
      expect(() =>
        act(
          'utility-charges',
          null,
          {
            ...data,
            segments: [
              { ...data.segments[0], endDate: month().slice(0, 8) + '15' },
              { ...data.segments[0], startDate, previousReading: 100, currentReading: 200 },
            ],
          },
          '',
          shared,
        ),
      ).toThrow()
  })
  it('supports resetting a meter through a contiguous zero-start segment', () => {
    const data = chargeInput()
    const c = act(
      'utility-charges',
      null,
      {
        ...data,
        segments: [
          { ...data.segments[0], endDate: month().slice(0, 8) + '15' },
          {
            ...data.segments[0],
            startDate: month().slice(0, 8) + '15',
            previousReading: 0,
            currentReading: 3,
            reason: 'METER_RESET',
          },
        ],
      },
      '',
      shared,
    )
    expect(e.state.charges.find((v) => v.id === c.id)?.totalAmount).toBe(364104)
  })
  it('supports a registered replacement meter, rejects replacement with same meter', () => {
    const data = chargeInput(),
      segments = [
        { ...data.segments[0], endDate: month().slice(0, 8) + '15' },
        {
          ...data.segments[0],
          startDate: month().slice(0, 8) + '15',
          previousReading: 20,
          currentReading: 30,
          reason: 'METER_REPLACEMENT',
        },
      ]
    expect(() => act('utility-charges', null, { ...data, segments }, '', shared)).toThrow(
      /thiết bị/,
    )
    segments[1].meterId = e.meterId(data.roomId, data.serviceId, 1)
    expect(act('utility-charges', null, { ...data, segments }, '', shared).id).toBeDefined()
  })
  it('does not edit finalized charges or finalize overlapping periods twice', () => {
    const data = chargeInput(),
      c = act('utility-charges', null, data, '', shared)
    act('utility-charges', c.id, { reason: note }, 'finalize', shared)
    expect(() => act('utility-charges', c.id, data, '', shared)).toThrow()
    const second = act('utility-charges', null, data, '', shared)
    expect(() => act('utility-charges', second.id, { reason: note }, 'finalize', shared)).toThrow(
      /chồng lấn/,
    )
  })
  it('approves exact proposals while preserving already-issued financial documents', () => {
    const t = tenancy(),
      c = e.tenant.state.charges.find((c) => c.contractTenantId === t.id)!,
      before = structuredClone(e.tenant.invoice(t, id(5300))),
      p = e.tenant.propose(t, {
        chargeId: c.id,
        method: 'APPROVED_CUSTOM',
        reason: note,
        shares: c.participants.map((v) => ({ id: v.id, amount: v.amount })),
      })
    act('cost-allocations', p.id, { decision: 'approve', reason: note })
    expect(e.tenant.invoice(tenancy(), id(5300))).toEqual(before)
  })
  it('refuses malformed proposals even when directly inserted by an adversarial client', () => {
    e.tenant.state.proposals.push({
      id: id(7999),
      contractTenantId: id(5101),
      chargeId: id(5810),
      method: 'APPROVED_CUSTOM',
      reason: note,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decision: null,
      shares: [{ id: id(5101), amount: 1 }],
      decisionAt: 0,
    })
    expect(() =>
      act('cost-allocations', id(7999), { decision: 'approve', reason: note }, '', shared),
    ).toThrow(/tổng/)
  })
})
describe('Invoice sources and payment reconciliation', () => {
  it('saves a DRAFT and issues it to only the correct ContractTenant', () => {
    const c = act('invoices', null, invoiceInput(), '', shared)
    expect(e.tenant.invoice(e.tenancy(shared, id(5101)), c.id).documentStatus).toBe('DRAFT')
    act('invoices', c.id, { reason: note }, 'issue', shared)
    expect(e.tenant.invoice(e.tenancy(shared, id(5101)), c.id).documentStatus).toBe('ISSUED')
    expect(() => e.tenant.invoice(e.tenancy(shared, id(5103)), c.id)).toThrow()
    expect(
      e.db
        .notifications(tenantUser.id)
        .some((n) => n.referenceId === c.id && n.contractTenantId === id(5101)),
    ).toBe(true)
  })
  it('enforces one non-cancelled invoice per individual month', () => {
    act('invoices', null, invoiceInput(), '', shared)
    expect(() => act('invoices', null, invoiceInput(), '', shared)).toThrow(/Mỗi quan hệ/)
    expect(act('invoices', null, invoiceInput(shared, id(5103)), '', shared).id).toBeDefined()
  })
  it('rejects duplicate fee sources, unapproved repairs and mismatched rent', () => {
    const data = invoiceInput()
    expect(() => act('invoices', null, { ...data, rentAmount: 1 }, '', shared)).toThrow(
      /lịch đã duyệt/,
    )
    expect(() =>
      act('invoices', null, { ...data, sources: [{ type: 'REPAIR', id: id(6203) }] }, '', shared),
    ).toThrow(/Nguồn phí/)
    expect(() =>
      act(
        'invoices',
        null,
        {
          ...data,
          sources: [
            { type: 'UTILITY', id: id(5810) },
            { type: 'UTILITY', id: id(5810) },
          ],
        },
        '',
        shared,
      ),
    ).toThrow(/trùng/)
  })
  it('revalidates changed allocation amounts at issue and refuses stale snapshots', () => {
    const data = chargeInput(),
      c = act('utility-charges', null, data, '', shared)
    act('utility-charges', c.id, { reason: note }, 'finalize', shared)
    const i = act(
      'invoices',
      null,
      { ...invoiceInput(), sources: [{ type: 'UTILITY', id: c.id }] },
      '',
      shared,
    )
    e.tenant.state.charges.find(
      (v) => v.id === c.id && v.contractTenantId === id(5101),
    )!.myAmount += 1
    expect(() => act('invoices', i.id, { reason: note }, 'issue', shared)).toThrow(/đã thay đổi/)
    expect(e.tenant.state.invoices.find((v) => v.id === i.id)?.documentStatus).toBe('DRAFT')
  })
  it('applies eligible prepaid once without creating a cash receipt', () => {
    act('invoices', id(5350), { reason: note }, 'cancel')
    const input = {
        ...invoiceInput(b, id(5100)),
        prepaidAmount: 2000000,
        prepaidSourcePaymentId: id(5500),
      },
      cash = e.tenant.state.payments.length,
      c = act('invoices', null, input)
    act('invoices', c.id, { reason: note }, 'issue')
    expect(e.tenant.state.payments).toHaveLength(cash)
    expect(e.tenant.state.payments.find((p) => p.id === id(5500))?.prepaidFirstApplied).toBe(
      3200000,
    )
    expect(() => act('invoices', c.id, { reason: note }, 'issue')).toThrow()
  })
  it('does not allow Manager financial edits or cancellation after issuance', () => {
    for (const action of ['', 'cancel'])
      expect(() => act('invoices', id(5300), invoiceInput(b, id(5100)), action)).toThrow()
    expect(e.tenant.invoice(tenancy(), id(5300)).documentStatus).toBe('ISSUED')
  })
  it('pending and review receipts do not affect debt or cash totals', () => {
    const t = e.tenancy(shared, id(5101)),
      before = e.tenant.invoice(t, id(5301)).outstanding
    act('payments', id(7900), { decision: 'review', note }, '', shared)
    expect(e.tenant.invoice(t, id(5301)).outstanding).toBe(before)
    expect(e.summary(manager, shared, today().slice(0, 7)).receipts).toBe(0)
  })
  it('verifies a partial manual receipt only for its own invoice and once', () => {
    const before = e.tenant.invoice(e.tenancy(shared, id(5101)), id(5301)).outstanding,
      input = {
        decision: 'verify',
        note,
        reference: 'TP-QR-DEMO-01',
        amount: 50000,
        providerTransactionId: 'BANK-DEMO-0001',
      }
    act('payments', id(7900), input, '', shared)
    expect(e.tenant.invoice(e.tenancy(shared, id(5101)), id(5301)).outstanding).toBe(before - 50000)
    expect(e.tenant.invoice(e.tenancy(shared, id(5103)), id(5303)).outstanding).toBe(2505000)
    expect(() => act('payments', id(7900), input, '', shared)).toThrow(/lần hai/)
  })
  it.each([{ reference: 'WRONG' }, { amount: 1 }, { providerTransactionId: 'OTHER' }])(
    'rejects mismatched receipt %j',
    (mismatch) =>
      expect(() =>
        act(
          'payments',
          id(7900),
          {
            decision: 'verify',
            note,
            reference: 'TP-QR-DEMO-01',
            amount: 50000,
            providerTransactionId: 'BANK-DEMO-0001',
            ...mismatch,
          },
          '',
          shared,
        ),
      ).toThrow(/không khớp/),
  )
  it('refuses duplicate provider transaction across obligations', () => {
    const p = structuredClone(e.tenant.state.payments.find((p) => p.id === id(7900))!)
    p.id = crypto.randomUUID()
    p.status = 'VERIFIED'
    p.allocatedAmount = 50000
    e.tenant.state.payments.push(p)
    e.state.paymentMeta[p.id] = { ...e.state.paymentMeta[id(7900)] }
    expect(() =>
      act(
        'payments',
        id(7900),
        {
          decision: 'verify',
          note,
          reference: 'TP-QR-DEMO-01',
          amount: 50000,
          providerTransactionId: 'BANK-DEMO-0001',
        },
        '',
        shared,
      ),
    ).toThrow(/nhà cung cấp/)
  })
  it('refuses manual verification of sandbox receipts', () => {
    const t = tenancy(),
      p = e.tenant.pay(t, id(5300), {
        amount: 100000,
        payerName: tenantUser.fullName,
        idempotencyKey: crypto.randomUUID(),
      })
    expect(() => act('payments', p.id, { decision: 'verify', note })).toThrow(/sandbox/)
  })
  it('excludes sandbox and booking hold from actual rental receipts', () => {
    const summary = e.summary(manager, b, month(-1).slice(0, 7))
    expect(summary.receipts).toBe(0)
    expect(summary.sandboxReceipts).toBe(9400000)
    expect(summary.series.at(-1)?.receipts).toBe(0)
  })
  it('validates exact integer totals and reporting dates', () => {
    expect(sumVnd([100, 200, -50])).toBe(250)
    expect(() => sumVnd([1.1])).toThrow()
    expect(() => sumVnd([Number.MAX_SAFE_INTEGER, 1])).toThrow()
    expect(() => e.summary(manager, b, '2026-99')).toThrow()
  })
})
describe('Additional domain boundaries', () => {
  it('preserves a room referenced by an empty draft contract before tenants are added', () => {
    const r = act('rooms', null, roomInput())
    act('contracts', null, {
      code: 'EMPTY-ROOM-REF',
      roomId: r.id,
      startDate: today(),
      endDate: month(3),
      terms: note,
    })
    expect(() => act('rooms', r.id, {}, '', b, 'DELETE')).toThrow(/hồ sơ/)
    expect(() => act('rooms', r.id, { ...roomInput(), rentalMode: 'SLOT' })).toThrow(/hợp đồng/)
  })
  it('uses ContractTenant allocation rather than a converted booking as an ongoing hold', () => {
    const booking = e.db.state.bookings.find((v) => v.id === id(305))!
    act(
      'bookings',
      booking.id,
      {
        code: 'CONVERTED-SCOPE',
        terms: note,
        monthlyRent: 1900000,
        firstMonthRent: 1900000,
        lastMonthRent: 1900000,
      },
      'convert',
      shared,
    )
    const converted = e.db.state.bookings.find((v) => v.id === booking.id)!
    expect(e.db.bookingAllocationActive(converted)).toBe(false)
    expect(
      e.db
        .availability(converted.roomId, converted.startDate, converted.endDate)
        .slots.find((s) => s.id === converted.roomSlotId)?.available,
    ).toBe(false)
  })
  it('updates rental mode when an empty draft contract changes its room', () => {
    const c = newContract(),
      room = act('rooms', null, { ...roomInput(), code: 'SLOT-DRAFT-NEW', rentalMode: 'SLOT' })
    act('contracts', c.id, {
      code: 'TP-NEW',
      roomId: room.id,
      startDate: today(),
      endDate: month(3),
      terms: note,
    })
    expect(e.contract(b, c.id).rentalMode).toBe('SLOT')
  })
  it('reserves assigned DRAFT contract resources consistently across public and Manager views', () => {
    const c = newContract()
    act('tenants', null, { ...tenantInput(), contractId: c.id })
    expect(e.db.availability(id(109), today(), month()).available).toBe(false)
    const r = e.occupancy(e.room(b, id(109)), today(), month())
    expect(r.heldResources).toBe(1)
    expect(r.occupiedResources).toBe(0)
    expect(r.availability).toBe('HELD')
  })
  it('shows a converted DRAFT SLOT as held until activation, without losing reservation', () => {
    const booking = e.db.state.bookings.find((v) => v.id === id(305))!
    act(
      'bookings',
      booking.id,
      {
        code: 'TP-DRAFT-SLOT',
        terms: note,
        monthlyRent: 1900000,
        firstMonthRent: 1900000,
        lastMonthRent: 1900000,
      },
      'convert',
      shared,
    )
    const rows = e.list(
      manager,
      shared,
      'slots',
      new URLSearchParams({
        roomId: booking.roomId,
        startDate: booking.startDate,
        endDate: booking.endDate,
      }),
    ) as { id: string; availability: string }[]
    expect(rows.find((s) => s.id === booking.roomSlotId)?.availability).toBe('HELD')
    expect(
      e.db
        .availability(booking.roomId, booking.startDate, booking.endDate)
        .slots.find((s) => s.id === booking.roomSlotId)?.available,
    ).toBe(false)
  })
  it('cannot apply prepaid rent to utility or repair amounts beyond the rent source', () => {
    act('invoices', id(5350), { reason: note }, 'cancel')
    const data = invoiceInput(b, id(5100))
    e.state.rentSchedules.find(
      (s) => s.contractTenantId === id(5100) && s.billingMonth === month(),
    )!.amount = 100
    const c = act('utility-charges', null, chargeInput(b))
    act('utility-charges', c.id, { reason: note }, 'finalize')
    expect(() =>
      act('invoices', null, {
        ...data,
        rentAmount: 100,
        sources: [{ type: 'UTILITY', id: c.id }],
        prepaidAmount: 101,
        prepaidSourcePaymentId: id(5500),
      }),
    ).toThrow(/phần tiền thuê/)
  })
  it('does not expose or accept public requests for a private room', () => {
    const room = act('rooms', null, roomInput()),
      policy = e.db.policy(b),
      startDate = today(),
      endDate = month()
    expect(() => e.db.availability(room.id, startDate, endDate)).toThrow(/công khai/)
    expect(() =>
      e.db.createBooking(
        {
          roomId: room.id,
          rentalMode: 'ROOM',
          startDate,
          endDate,
          policyId: policy.id,
          policyVersion: policy.version,
          acknowledged: true,
        },
        demoUser.id,
      ),
    ).toThrow(/công khai/)
    expect(() =>
      e.db.createAppointment(
        {
          roomId: room.id,
          startAt: `${month()}T10:00:00+07:00`,
          endAt: `${month()}T10:30:00+07:00`,
          note: '',
        },
        demoUser.id,
      ),
    ).toThrow(/công khai/)
  })
  it('deletes an unreferenced room and dependent configs without orphaned records', () => {
    const room = act('rooms', null, roomInput())
    act('rooms', room.id, {}, '', b, 'DELETE')
    expect(e.state.roomServices.some((s) => s.roomId === room.id)).toBe(false)
    expect(e.inventory.state.slots.some((s) => s.roomId === room.id)).toBe(false)
  })
  it('protects rooms referenced by historical appointments', () => {
    const room = act('rooms', null, { ...roomInput(), isPublic: true }),
      a = e.db.createAppointment(
        {
          roomId: room.id,
          startAt: `${month()}T10:00:00+07:00`,
          endAt: `${month()}T10:30:00+07:00`,
          note: '',
        },
        demoUser.id,
      )
    a.status = 'CANCELLED'
    expect(() => act('rooms', room.id, {}, '', b, 'DELETE')).toThrow(/hồ sơ/)
  })
  it('does not collect a second last-period prepaid bucket for an exact one-month rental', () => {
    const c = act('contracts', null, {
      code: 'ONE-MONTH',
      roomId: id(109),
      startDate: month(),
      endDate: month(2),
      terms: note,
    })
    const input = { ...tenantInput(), contractId: c.id, startDate: month(), endDate: month(2) }
    expect(() => act('tenants', null, input)).toThrow(/đúng một tháng/)
    expect(
      act('tenants', null, { ...input, lastMonthRent: 0, prepaidLastRequired: 0 }).id,
    ).toBeDefined()
  })
  it('does not cancel or reassign financial terms while prepaid is pending', () => {
    const c = newContract(),
      t = e.tenancy(b, act('tenants', null, { ...tenantInput(), contractId: c.id }).id)
    e.tenant.prepay(t, {
      bucket: 'FIRST_MONTH',
      amount: 100,
      payerName: demoUser.fullName,
      idempotencyKey: crypto.randomUUID(),
    })
    expect(() => act('contracts', c.id, { reason: note }, 'cancel')).toThrow(/giao dịch/)
    expect(() =>
      act('tenants', t.id, { ...tenantInput(), contractId: c.id, monthlyRent: 2 }),
    ).toThrow(/giao dịch/)
  })
  it('revalidates an approved rent schedule at invoice issuance', () => {
    const i = act('invoices', null, invoiceInput(), '', shared)
    e.state.rentSchedules.find(
      (s) => s.contractTenantId === id(5101) && s.billingMonth === month(),
    )!.amount += 1
    expect(() => act('invoices', i.id, { reason: note }, 'issue', shared)).toThrow(/Lịch tiền thuê/)
    expect(e.tenant.state.invoices.find((v) => v.id === i.id)?.documentStatus).toBe('DRAFT')
  })
  it('refuses duplicate provider transactions already used by a booking hold', () => {
    const hold = e.db.state.payments.find((p) => p.status === 'VERIFIED')!
    e.state.paymentMeta[hold.id] = { ...e.state.paymentMeta[id(7900)] }
    expect(() =>
      act(
        'payments',
        id(7900),
        {
          decision: 'verify',
          note,
          reference: 'TP-QR-DEMO-01',
          amount: 50000,
          providerTransactionId: 'BANK-DEMO-0001',
        },
        '',
        shared,
      ),
    ).toThrow(/nhà cung cấp/)
  })
  it('hides inactive optional catalogs and rejects direct Tenant registration', () => {
    const service = e.state.services.find((s) => s.id === id(5602))!
    act('services', service.id, { ...service, active: false })
    expect(e.tenant.servicesFor(tenancy()).some((s) => s.id === service.id)).toBe(false)
    expect(() =>
      e.tenant.service(tenancy(), {
        serviceId: service.id,
        startDate: today(),
        endDate: month(2),
        note: '',
      }),
    ).toThrow(/không còn/)
  })
  it('quotes the room-specific effective service price while retaining old history', () => {
    const config = e.state.roomServices.find(
      (s) => s.roomId === id(100) && s.serviceId === id(5602),
    )!
    act('room-services', config.id, {
      roomId: config.roomId,
      serviceId: config.serviceId,
      startDate: today(),
      endDate: '2030-01-01',
      unitPrice: 150000,
    })
    expect(
      e.tenant.service(tenancy(), {
        serviceId: id(5602),
        startDate: today(),
        endDate: month(2),
        note: '',
      }).unitPrice,
    ).toBe(150000)
    expect(e.state.roomServices.find((s) => s.id === config.id)?.unitPrice).toBe(120000)
  })
  it('previews a valid charge without saving or creating notifications', () => {
    const before = structuredClone({ manager: e.state, tenant: e.tenant.state, db: e.db.state })
    const preview = e.previewCharge(manager, shared, chargeInput()) as { totalAmount: number }
    expect(preview.totalAmount).toBe(353601)
    expect({ manager: e.state, tenant: e.tenant.state, db: e.db.state }).toEqual(before)
  })
  it('rejects forged evidence at the charge API boundary', () => {
    const input = chargeInput()
    expect(() =>
      act(
        'utility-charges',
        null,
        {
          ...input,
          evidence: [
            {
              id: crypto.randomUUID(),
              name: 'fake.png',
              mime: 'image/png',
              size: 4,
              url: 'data:image/png;base64,dGVzdA==',
            },
          ],
        },
        '',
        shared,
      ),
    ).toThrow(/ảnh/)
  })
  it('uses actual optional-service dates and includes pending cancellation until decided', () => {
    const t = e.tenancy(shared, id(5101)),
      service = e.state.services.find((s) => s.branchId === shared && s.type === 'INTERNET')!,
      start = month().slice(0, 8) + '15',
      registered = e.tenant.service(t, {
        serviceId: service.id,
        startDate: start,
        endDate: month(2),
        note: '',
      })
    act(
      'service-requests',
      registered.id,
      { contractTenantId: t.id, decision: 'approve', reason: note },
      '',
      shared,
    )
    e.tenant.cancelService(e.tenancy(shared, t.id), service.id)
    const c = act(
      'utility-charges',
      null,
      {
        roomId: t.roomId,
        serviceId: service.id,
        billingMonth: month(),
        segments: [
          {
            startDate: month(),
            endDate: month(2),
            previousReading: null,
            currentReading: null,
            quantity: 1,
            unitPrice: 120000,
            reason: 'NORMAL',
            meterId: null,
          },
        ],
        evidence: [],
      },
      '',
      shared,
    )
    act('utility-charges', c.id, { reason: note }, 'finalize', shared)
    const charge = e.tenant.state.charges.find((v) => v.id === c.id)!
    expect(charge.participants).toHaveLength(1)
    expect(charge.participants[0].startDate).toBe(start)
    expect(charge.myAmount).toBe(120000)
  })
})
describe('Maintenance, asset history and private settings', () => {
  const createReport = () =>
    e.tenant.report(tenancy(), {
      assetId: id(6100),
      category: 'FURNITURE',
      title: 'Máy lạnh cần kiểm tra',
      description: 'Máy lạnh phát tiếng ồn khi đang hoạt động.',
      priority: 'NORMAL',
      attachments: [],
    })
  it('shows Tenant request and processes multiple visible ReportRecords', () => {
    const r = createReport()
    expect(e.list(manager, b, 'maintenance')).toContainEqual(expect.objectContaining({ id: r.id }))
    act('maintenance', r.id, { reason: note, handler: 'Kỹ thuật Minh' }, 'accept')
    act('maintenance', r.id, { reason: note }, 'start')
    act(
      'maintenance',
      r.id,
      {
        reason: note,
        description: 'Thay bộ phận đã hỏng.',
        cost: 200000,
        responsibleParty: 'TENANT',
        evidence: [],
      },
      'record',
    )
    act('maintenance', r.id, { reason: note }, 'complete')
    const current = e.tenant.state.reports.find((v) => v.id === r.id)!
    expect(current.status).toBe('COMPLETED')
    expect(current.records).toHaveLength(5)
    expect(
      invoiceSources(e, b, id(5100), month()).sources.some(
        (s) => s.type === 'REPAIR' && s.id === current.records[3].id,
      ),
    ).toBe(false)
    act('maintenance', r.id, { reason: note, recordId: current.records[3].id }, 'cost-approve')
    expect(
      invoiceSources(e, b, id(5100), month()).sources.some((s) => s.id === current.records[3].id),
    ).toBe(true)
  })
  it('protects referenced Furniture and rejects invalid maintenance transitions', () => {
    const r = createReport()
    expect(() => act('furnitures', r.assetId, {}, '', b, 'DELETE')).toThrow(/lịch sử/)
    expect(() => act('maintenance', r.id, { reason: note }, 'complete')).toThrow()
    expect(() => act('maintenance', r.id, { reason: note }, 'start')).toThrow()
  })
  it('forbids own repair liability approval by a Manager-Tenant actor', () => {
    const r = createReport(),
      record = e.tenant.state.reports.find((v) => v.id === r.id)!.records[0]
    record.cost = 100
    record.responsibleParty = 'TENANT'
    record.approvalStatus = 'PENDING'
    const user = { ...manager, id: tenantUser.id }
    e.db.state.users.find(u=>u.id===user.id)!.roles.push('MANAGER')
    e.state.branches.find((v) => v.id === b)!.managerId = user.id
    e.state.ownerManagers.push({ ownerId: owner.id, managerId: user.id })
    expect(() =>
      e.action(user, b, 'maintenance', r.id, 'cost-approve', { recordId: record.id, reason: note }),
    ).toThrow(/chính mình/)
  })
  it('scopes Zalo setting to the authorized branch and active Tenant', () => {
    saveZalo(e, manager, b, { url: 'https://zalo.me/g/new-demo', enabled: true })
    expect(e.tenant.room(tenancy()).zaloUrl).toBe('https://zalo.me/g/new-demo')
    expect(e.tenant.room(e.tenancy(shared, id(5101))).zaloUrl).toBeNull()
    expect(() =>
      saveZalo(e, manager, id(11), { url: 'https://zalo.me/g/x', enabled: true }),
    ).toThrow()
    expect(() => saveZalo(e, manager, b, { url: 'javascript:alert(1)', enabled: true })).toThrow()
  })
  it('keeps historical warranties and disallows unsupported active-contract amendments', () => {
    const asset = e.state.assets.find((a) => a.branchId === b)!
    act(
      'furnitures',
      asset.id,
      {
        provider: 'Nhà cung cấp demo',
        reference: 'BH-DEMO',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        terms: note,
      },
      'warranty-save',
    )
    const warranty = e.state.assets.find((a) => a.id === asset.id)!.warranties.at(-1)!
    expect(() =>
      act('furnitures', asset.id, { warrantyId: warranty.id }, 'warranty-delete'),
    ).toThrow(/lịch sử/)
    expect((e.get(manager, b, 'contracts', id(5200)) as ManagerContract).status).toBe('ACTIVE')
  })
})
