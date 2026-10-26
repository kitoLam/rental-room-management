import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { tenantDb } from './tenant-engine'
import { db, MockDatabase } from './database'
import { tenantUser } from './tenant-fixtures'
import { fixtureId as id, demoUser } from './fixtures'

const server = setupServer(...handlers),
  base = 'http://localhost/__mock'
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  tenantDb.reset()
  db.state = new MockDatabase().state
  db.state.users.push(tenantUser)
  db.state.sessions['test-tenant'] = tenantUser.id
  db.state.sessions['test-user'] = demoUser.id
})
async function call(path: string, method = 'GET', body?: unknown, token = 'test-tenant') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}
const scope = `/api/tenant/tenancies/${id(5100)}`
describe('Tenant MSW authorization boundary', () => {
  it('does not accept a forged demo identity header without a session', async () => {
    const response = await fetch(`${base}${scope}/invoices`, {
      headers: { 'X-TroPro-Demo-Identity': encodeURIComponent(JSON.stringify(tenantUser)) },
    })
    expect(response.status).toBe(401)
  })
  it('requires authentication and does not infer a relationship from a role or booking', async () => {
    expect((await call(`${scope}/invoices`, 'GET', undefined, 'missing')).status).toBe(401)
    expect((await call('/api/tenant/tenancies', 'GET', undefined, 'test-user')).body.data).toEqual(
      [],
    )
    expect((await call(`${scope}/invoices`, 'GET', undefined, 'test-user')).status).toBe(404)
  })
  it.each([
    'room',
    'invoices',
    'payments',
    'services',
    'utilities',
    'allocations',
    'maintenance',
  ] as const)('protects %s in foreign tenancy', async (resource) => {
    const result = await call(`/api/tenant/tenancies/${id(5103)}/${resource}`)
    expect(result.status).toBe(404)
    expect(result.body.data).toBeNull()
  })
  it('returns only owned invoices and payments in lists', async () => {
    const invoices = await call(`${scope}/invoices`),
      payments = await call(`${scope}/payments`)
    expect(invoices.status).toBe(200)
    expect(
      invoices.body.data.every(
        (v: { contractTenantId: string }) => v.contractTenantId === id(5100),
      ),
    ).toBe(true)
    expect(
      payments.body.data.every(
        (v: { contractTenantId: string }) => v.contractTenantId === id(5100),
      ),
    ).toBe(true)
  })
  it('rejects unauthorized individual contract and private payment IDs', async () => {
    expect((await call(`${scope}/contracts/${id(5201)}`)).status).toBe(404)
    expect((await call(`/api/tenant/tenancies/${id(5101)}/payments/${id(5500)}`)).status).toBe(404)
  })
  it.each([
    'payments/unknown/verify',
    'allocations/unknown/approve',
    'maintenance/unknown/approve-cost',
  ])('has no Tenant management endpoint %s', async (path) =>
    expect((await call(`${scope}/${path}`, 'POST', {})).status).toBe(404),
  )
  it('validates writes at the API and returns visible state conflicts', async () => {
    expect((await call(`${scope}/services/${id(5600)}/cancel`, 'POST')).status).toBe(422)
    expect(
      (
        await call(`${scope}/invoices/${id(5350)}/payments`, 'POST', {
          amount: 100,
          payerName: 'Test User',
          idempotencyKey: crypto.randomUUID(),
        })
      ).status,
    ).toBe(409)
    expect((await call(`${scope}/maintenance`, 'POST', { title: 'invalid' })).status).toBe(422)
  })
  it('reuses the owned notification inbox and marks scoped references read', async () => {
    await call('/api/tenant/tenancies')
    const inbox = await call('/api/notifications')
    expect(
      inbox.body.data.content.some(
        (v: { contractTenantId?: string }) => v.contractTenantId === id(5100),
      ),
    ).toBe(true)
    const notification = inbox.body.data.content[0]
    expect(
      (
        await call(
          '/api/notifications/mark-read',
          'PUT',
          { notificationIds: [notification.id] },
          'test-user',
        )
      ).status,
    ).toBe(403)
    expect(
      (await call('/api/notifications/mark-read', 'PUT', { notificationIds: [notification.id] }))
        .body.data[0].read,
    ).toBe(true)
  })
})
