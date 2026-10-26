import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { managerDb as e } from './manager-engine'
import { ownerDb as o, otherOwner } from './owner-engine'
import { ownerUser, managerUser } from './manager-fixtures'
import { demoUser, fixtureId as id } from './fixtures'
const server = setupServer(...handlers),
  base = 'http://localhost/__mock'
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  e.reset()
  if (!e.db.state.users.some((u) => u.id === otherOwner.id))
    e.db.state.users.push(structuredClone(otherOwner))
  for (const u of [ownerUser, otherOwner, managerUser, demoUser])
    e.db.state.sessions[u.email] = u.id
})
async function call(
  path: string,
  method = 'GET',
  body?: unknown,
  actor = ownerUser.email,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${actor}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}
describe('Owner MSW boundary', () => {
  it('requires a session and Owner eligibility for private reads', async () => {
    expect((await call('/api/owner/branches', 'GET', undefined, 'missing')).status).toBe(401)
    expect((await call('/api/owner/branches', 'GET', undefined, demoUser.email)).status).toBe(403)
  })
  it('returns only owned branches, Manager relations and private payments', async () => {
    const bs = await call('/api/owner/branches')
    expect(bs.status).toBe(200)
    expect(bs.body.data.content.map((b: { id: string }) => b.id).sort()).toEqual(
      [id(10), id(12)].sort(),
    )
    expect((await call('/api/owner/branches/' + id(11))).status).toBe(403)
    expect((await call('/api/owner/payments?branchId=' + id(11))).status).toBe(403)
    expect((await call('/api/owner/managers/' + id(7002))).status).toBe(404)
  })
  it('validates pagination and refuses unsupported or injected privileged routes', async () => {
    expect((await call('/api/owner/branches?size=1000')).status).toBe(422)
    expect(
      (await call('/api/owner/verification/approve', 'POST', { userId: ownerUser.id })).status,
    ).toBe(404)
    expect((await call('/api/owner/admin/approve', 'POST', {})).status).toBe(404)
  })
  it('normal User can inspect own verification but cannot self-entitle', async () => {
    const v = await call('/api/owner/verification', 'GET', undefined, demoUser.email)
    expect(v.body.data.status).toBe('NOT_SUBMITTED')
    expect(v.body.data.eligible).toBe(false)
    expect(
      (
        await call(
          '/api/owner/verification',
          'PATCH',
          { eligible: true, status: 'APPROVED' },
          demoUser.email,
        )
      ).status,
    ).toBe(403)
  })
  it('restricts shared operations when explicit Owner workspace header is present', async () => {
    expect(
      (
        await call('/api/manager/branches', 'GET', undefined, managerUser.email, {
          'X-TroPro-Workspace': 'OWNER',
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await call(`/api/manager/branches/${id(11)}/payments`, 'GET', undefined, ownerUser.email, {
          'X-TroPro-Workspace': 'OWNER',
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await call(`/api/manager/branches/${id(10)}/rooms`, 'GET', undefined, ownerUser.email, {
          'X-TroPro-Workspace': 'OWNER',
        })
      ).status,
    ).toBe(200)
  })
  it('Manager cannot approve an Owner financial proposal through HTTP', async () => {
    const i = e.tenant.state.invoices.find((i) => i.id === id(5300))!
    const created = await call(
      `/api/manager/branches/${id(10)}/adjustment-requests`,
      'POST',
      {
        invoiceId: i.id,
        proposedTotal: i.totalAmount - 1,
        reason: 'Điều chỉnh theo chứng cứ được kiểm tra.',
        evidence: [],
      },
      managerUser.email,
    )
    expect(created.status).toBe(201)
    const p = created.body.data
    expect(
      (
        await call(
          `/api/owner/approvals/${p.id}`,
          'POST',
          { decision: 'APPROVED', reason: 'Đã kiểm tra đầy đủ chứng cứ.' },
          managerUser.email,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await call(`/api/owner/approvals/${p.id}`, 'POST', {
          decision: 'APPROVED',
          reason: 'Đã kiểm tra đầy đủ chứng cứ.',
        })
      ).status,
    ).toBe(200)
    expect(i.totalAmount).toBe(p.originalTotal)
  })
  it('foreign Owner cannot cancel invitation or accept for another identity', async () => {
    const i = o.invite(ownerUser, {
      email: demoUser.email,
      fullName: demoUser.fullName,
      phone: '',
      branchIds: [],
      note: '',
    })
    expect(
      (await call(`/api/owner/invitations/${i.id}/cancel`, 'POST', {}, otherOwner.email)).status,
    ).toBe(404)
    expect((await call(`/api/owner/my-invitations/${i.id}/accept`, 'POST', {})).status).toBe(403)
    expect(
      (await call(`/api/owner/my-invitations/${i.id}/accept`, 'POST', {}, demoUser.email)).status,
    ).toBe(200)
  })
  it('revoked verification removes Owner operational access despite valid token', async () => {
    o.state.verification.find((v) => v.userId === ownerUser.id)!.status = 'PENDING'
    expect((await call('/api/owner/summary?month=2026-10')).status).toBe(403)
    expect((await call(`/api/manager/branches/${id(10)}/invoices`)).status).toBe(403)
  })
})
