import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TenantEngine } from './tenant-engine'
import { tenantUser, roommateUser, seedTenant } from './tenant-fixtures'
import { demoUser, fixtureId as id } from './fixtures'
import { allocateVnd, financialSummary, residentDays, safeZalo } from '@/lib/tenant-finance'
import {
  tenancySchema,
  invoiceSchema,
  tenantRoomSchema,
  reportSchema,
  chargeSchema,
} from '@/interfaces/tenant'
import { referenceLink } from '@/lib/activity'
import type { Tenancy } from '@/interfaces/tenant'

let engine: TenantEngine, t: Tenancy
const payment = (amount = 100000, outcome = 'success') => ({
  amount,
  outcome,
  payerName: 'Nguyễn Hoài Nam',
  idempotencyKey: crypto.randomUUID(),
})
const report = () => ({
  assetId: id(6100),
  category: 'FURNITURE',
  title: 'Điều hòa bị rò nước',
  description: 'Dàn lạnh có nước chảy liên tục khi đang hoạt động.',
  priority: 'NORMAL',
  attachments: [],
})
const service = () => ({
  serviceId: id(5602),
  startDate: new Date().toISOString().slice(0, 10),
  endDate: t.endDate,
  note: 'Cần đường truyền riêng để học tập.',
})
const proposal = () => {
  const c = engine.state.charges.find((c) => c.contractTenantId === t.id)!
  return {
    chargeId: c.id,
    method: 'RESIDENT_DAYS',
    reason: 'Đối chiếu ngày cư trú thực tế.',
    shares: allocateVnd(c.totalAmount, c.participants),
  }
}
beforeEach(() => {
  engine = new TenantEngine()
  t = engine.own(tenantUser.id, id(5100))
})
describe('Tenant scope and model', () => {
  it('never authorizes furniture from another room or another assigned slot', () => {
    const slot = engine.own(tenantUser.id, id(5101))
    const roommate = engine.own(roommateUser.id, id(5103))
    const foreignAsset = engine.assets(roommate).find((a) => a.name.includes('Giường'))!
    expect(() => engine.report(slot, { ...report(), assetId: foreignAsset.id })).toThrow()
    expect(() => engine.report(t, { ...report(), assetId: engine.assets(slot)[0].id })).toThrow()
  })
  it('seeds coherent ROOM, SLOT, historical and private roommate relationships', () => {
    expect(engine.state.tenancies.filter((v) => v.userId === tenantUser.id)).toHaveLength(3)
    engine.state.tenancies.forEach((v) => expect(tenancySchema.safeParse(v).success).toBe(true))
    expect(tenantRoomSchema.safeParse(engine.room(t)).success).toBe(true)
  })
  it('does not grant tenancy to a normal USER with a confirmed booking', () =>
    expect(() => engine.own(demoUser.id, t.id)).toThrow(/quan hệ thuê/))
  it('rejects a foreign tenancy and malformed identifier', () => {
    expect(() => engine.own(roommateUser.id, t.id)).toThrow()
    expect(() => engine.own(tenantUser.id, 'invalid')).toThrow()
  })
  it('isolates roommate invoices in the same shared contract', () => {
    const slot = engine.own(tenantUser.id, id(5101))
    expect(() => engine.invoice(slot, id(5303))).toThrow()
    expect(engine.invoice(slot, id(5301)).contractTenantId).toBe(slot.id)
  })
  it('does not reveal another context resource for the same account', () =>
    expect(() => engine.invoice(t, id(5301))).toThrow())
  it('permits historical read but denies active actions', () => {
    const old = engine.own(tenantUser.id, id(5102))
    expect(engine.invoice(old, id(5302))).toBeDefined()
    expect(() => engine.pay(old, id(5302), payment())).toThrow(/hiệu lực/)
    expect(() => engine.report(old, report())).toThrow()
  })
  it('returns branch private Zalo only to an active eligible tenancy', () => {
    expect(safeZalo(engine.room(t).zaloUrl)).toContain('zalo.me/g/')
    expect(engine.room(engine.own(tenantUser.id, id(5102))).zaloUrl).toBeNull()
    expect(engine.room(engine.own(tenantUser.id, id(5101))).zaloUrl).toBeNull()
  })
  it.each([
    'http://zalo.me/g/123',
    'https://zalo.me.evil.test/g/1',
    'javascript:alert(1)',
    'https://evil@zalo.me/g/1',
  ])('rejects unsafe Zalo URL %s', (url) => expect(safeZalo(url)).toBeNull())
  it('scopes notification links and keeps unknown references inert', () => {
    expect(referenceLink('TENANT_INVOICE', id(5300), t.id)).toBe(
      `/tenant/invoices/${id(5300)}?tenancyId=${t.id}`,
    )
    expect(referenceLink('TENANT_INVOICE', id(5300))).toBeNull()
  })
})
describe('Tenant invoice finance and trusted settlement', () => {
  it('settles the complete remaining balance and never applies it twice', () => {
    const invoice = engine.invoice(t, id(5300)),
      p = engine.pay(t, invoice.id, payment(invoice.outstanding))
    engine.tick(vi.fn(), p.settlementAt + 1)
    expect(engine.invoice(t, invoice.id).financialStatus).toBe('PAID')
    expect(engine.invoice(t, invoice.id).outstanding).toBe(0)
    expect(() => engine.pay(t, invoice.id, payment())).toThrow()
  })
  it('uses approved invoice totals and verified allocated partial payment', () => {
    const i = engine.invoice(t, id(5300))
    expect(invoiceSchema.safeParse(i).success).toBe(true)
    expect(i.verifiedAllocated).toBe(1000000)
    expect(i.prepaidApplied).toBe(1200000)
    expect(i.outstanding).toBe(i.totalAmount - 2200000)
    expect(i.financialStatus).toBe('PARTIAL')
  })
  it.each(['PENDING', 'REVIEW', 'FAILED'] as const)(
    'does not subtract %s cash from debt',
    (status) => {
      const before = engine.invoice(t, id(5300)).outstanding,
        p = engine.pay(t, id(5300), payment())
      p.status = status
      expect(engine.invoice(t, id(5300)).outstanding).toBe(before)
    },
  )
  it('reserves pending amounts against duplicate overpayment', () => {
    const p = engine.pay(t, id(5300), payment())
    expect(engine.invoice(t, id(5300)).availableToPay).toBe(
      engine.invoice(t, id(5300)).outstanding - p.amountReceived,
    )
    expect(() =>
      engine.pay(t, id(5300), payment(engine.invoice(t, id(5300)).outstanding)),
    ).toThrow()
  })
  it('verifies a partial payment with a different payer atomically', () => {
    const before = engine.invoice(t, id(5300)).outstanding,
      p = engine.pay(t, id(5300), payment())
    engine.tick(vi.fn(), p.settlementAt + 1)
    expect(p.status).toBe('VERIFIED')
    expect(p.allocatedAmount).toBe(100000)
    expect(p.verifiedAt).not.toBeNull()
    expect(engine.invoice(t, id(5300)).outstanding).toBe(before - 100000)
    engine.tick(vi.fn(), Date.now() + 99999)
    expect(engine.invoice(t, id(5300)).outstanding).toBe(before - 100000)
  })
  it.each(['pending', 'review', 'failure'])(
    'keeps debt unchanged after sandbox %s result',
    (outcome) => {
      const before = engine.invoice(t, id(5300)).outstanding,
        p = engine.pay(t, id(5300), payment(100000, outcome))
      engine.tick(vi.fn(), p.settlementAt + 1)
      expect(p.allocatedAmount).toBe(0)
      expect(engine.invoice(t, id(5300)).outstanding).toBe(before)
    },
  )
  it('deduplicates retries and rejects reused keys with a different payload', () => {
    const input = payment(),
      p = engine.pay(t, id(5300), input)
    expect(engine.pay(t, id(5300), input).id).toBe(p.id)
    expect(() => engine.pay(t, id(5300), { ...input, amount: 2 })).toThrow(/đã được dùng/)
  })
  it.each([0, -1, 1.5, Number.NaN, 1000000001])('rejects invalid payment amount %s', (amount) =>
    expect(() => engine.pay(t, id(5300), payment(amount))).toThrow(),
  )
  it('never pays draft or canceled documents', () => {
    for (const invoice of [id(5350), id(5351)]) {
      expect(engine.invoice(t, invoice).outstanding).toBe(0)
      expect(() => engine.pay(t, invoice, payment())).toThrow()
    }
  })
  it('keeps prepaid receipt separate from invoice application', () => {
    const cash = engine.state.payments.reduce((s, p) => s + p.amountReceived, 0)
    engine.invoice(t, id(5300))
    expect(engine.state.payments.reduce((s, p) => s + p.amountReceived, 0)).toBe(cash)
    const p = engine.state.payments.find((p) => p.id === id(5500))!
    expect(p.allocatedAmount).toBe(0)
    expect(p.prepaidFirstApplied).toBe(1200000)
    expect(p.prepaidFirstApplied).toBeLessThanOrEqual(p.prepaidFirstAmount)
  })
  it('derives overdue and rejects inconsistent financial totals', () => {
    expect(financialSummary(100, 0, 0, '2020-01-01', 'ISSUED').financialStatus).toBe('OVERDUE')
    expect(() => financialSummary(100, 90, 20, '2020-01-01', 'ISSUED')).toThrow()
  })
})
describe('Tenant services, allocations and maintenance', () => {
  it('registers optional service pending, then trusted workflow approves', () => {
    const s = engine.service(t, service())
    expect(s.status).toBe('PENDING')
    expect(() => engine.service(t, service())).toThrow()
    engine.tick(vi.fn(), s.decisionAt + 1)
    expect(s.status).toBe('APPROVED')
  })
  it('supports rejection without activating optional service', () => {
    const s = engine.service(t, service())
    engine.tick(vi.fn(), s.decisionAt + 1, true)
    expect(s.status).toBe('REJECTED')
  })
  it('enforces mandatory services and active cancellation approval', () => {
    expect(() => engine.cancelService(t, id(5600))).toThrow(/bắt buộc/)
    expect(() => engine.cancelService(t, id(5601))).toThrow()
    const s = engine.service(t, service())
    expect(() => engine.cancelService(t, s.id)).toThrow()
    engine.tick(vi.fn(), s.decisionAt + 1)
    engine.cancelService(t, s.id)
    expect(s.status).toBe('CANCEL_REQUESTED')
    engine.tick(vi.fn(), s.decisionAt + 1)
    expect(s.status).toBe('CANCELLED')
  })
  it('rejects service dates outside tenancy and reversed intervals', () => {
    expect(() => engine.service(t, { ...service(), endDate: t.startDate })).toThrow()
    expect(() => engine.service(t, { ...service(), startDate: '2020-01-01' })).toThrow()
    expect(() => engine.service(t, { ...service(), endDate: '2099-01-01' })).toThrow()
  })
  it('allocates exact integer VND with deterministic UUID tie breaks', () => {
    expect(
      allocateVnd(10, [
        { id: 'b', days: 1 },
        { id: 'a', days: 1 },
        { id: 'c', days: 1 },
      ]),
    ).toEqual([
      { id: 'b', amount: 3 },
      { id: 'a', amount: 4 },
      { id: 'c', amount: 3 },
    ])
    expect(residentDays('2026-01-01', '2026-02-01', '2026-01-16', '2026-03-01')).toBe(16)
  })
  it('rejects zero residence and duplicate allocation participants', () => {
    expect(() => allocateVnd(100, [{ id: 'a', days: 0 }])).toThrow()
    expect(() =>
      allocateVnd(100, [
        { id: 'a', days: 1 },
        { id: 'a', days: 2 },
      ]),
    ).toThrow()
  })
  it('displays multi-segment charge snapshots summing to source', () =>
    engine.state.charges.forEach((c) => {
      expect(chargeSchema.safeParse(c).success).toBe(true)
      expect(c.segments.reduce((s, p) => s + p.amount, 0)).toBe(c.totalAmount)
      expect(c.participants.reduce((s, p) => s + p.amount, 0)).toBe(c.totalAmount)
    }))
  it('holds proposals pending without altering issued invoices after approval', () => {
    const before = engine.invoice(t, id(5300)),
      p = engine.propose(t, proposal())
    expect(p.status).toBe('PENDING')
    engine.tick(vi.fn(), p.decisionAt + 1)
    expect(p.status).toBe('APPROVED')
    expect(engine.invoice(t, id(5300))).toEqual(before)
  })
  it('rejects invalid totals, foreign participants and duplicate pending proposals', () => {
    const p = proposal()
    expect(() => engine.propose(t, { ...p, shares: [{ id: t.id, amount: 1 }] })).toThrow()
    expect(() =>
      engine.propose(t, { ...p, shares: [{ id: roommateUser.id, amount: 350000 }] }),
    ).toThrow()
    engine.propose(t, p)
    expect(() => engine.propose(t, p)).toThrow()
  })
  it('creates a report in the scoped list and progresses through multiple records', () => {
    const r = engine.report(t, report())
    expect(reportSchema.safeParse(r).success).toBe(true)
    expect(engine.resource(engine.state.reports, r.id, t).status).toBe('OPEN')
    for (const status of ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']) {
      engine.tick(vi.fn(), r.workflowAt + 1)
      expect(r.status).toBe(status)
    }
    expect(r.records).toHaveLength(4)
    expect(r.records.at(-1)?.evidence.length).toBeGreaterThan(0)
  })
  it('rejects affected assets and category mismatches', () => {
    expect(() => engine.report(t, { ...report(), assetId: id(9999) })).toThrow()
    expect(() => engine.report(t, { ...report(), category: 'SERVICE' })).toThrow()
  })
  it('validates report content, image size, count and actual MIME signature', () => {
    expect(() => engine.report(t, { ...report(), description: 'x' })).toThrow()
    const a = {
      id: crypto.randomUUID(),
      name: 'fake.png',
      mime: 'image/png',
      size: 4,
      url: 'data:image/png;base64,dGVzdA==',
    }
    expect(() => engine.report(t, { ...report(), attachments: [a] })).toThrow(/Nội dung ảnh/)
    expect(() =>
      engine.report(t, { ...report(), attachments: [{ ...a, size: 1048577 }] }),
    ).toThrow()
    expect(() => engine.report(t, { ...report(), attachments: Array(4).fill(a) })).toThrow()
  })
  it('permits only OPEN report cancellation and blocks historical mutations', () => {
    const r = engine.report(t, report())
    engine.cancelReport(t, r.id)
    expect(r.status).toBe('CANCELLED')
    expect(() => engine.cancelReport(t, r.id)).toThrow()
    expect(() => engine.report(engine.own(tenantUser.id, id(5102)), report())).toThrow()
  })
  it('never adds pending repair liability to invoice debt', () => {
    const before = engine.invoice(t, id(5300)),
      r = engine.resource(engine.state.reports, id(6000), t)
    expect(
      r.records.some((r) => r.responsibleParty === 'TENANT' && r.approvalStatus === 'PENDING'),
    ).toBe(true)
    engine.tick(vi.fn())
    expect(engine.invoice(t, id(5300))).toEqual(before)
  })
  it('resets the linked dataset and creates scoped notifications once', () => {
    engine.report(t, report())
    const notify = vi.fn()
    engine.tick(notify)
    const count = notify.mock.calls.length
    engine.tick(notify)
    expect(notify.mock.calls).toHaveLength(count)
    engine.reset()
    expect(engine.state.reports.length).toBe(seedTenant().reports.length)
    expect(engine.state.payments.length).toBe(2)
    engine.state.invoices.forEach((i) =>
      expect(engine.state.tenancies.some((t) => t.id === i.contractTenantId)).toBe(true),
    )
  })
})
