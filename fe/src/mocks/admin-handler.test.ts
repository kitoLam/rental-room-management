import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { adminDb as a, adminUser as admin, secondAdmin, applicant } from './admin-engine'
import { fixtureId as id, demoUser } from './fixtures'
import { managerUser, ownerUser } from './manager-fixtures'
import { tenantUser } from './tenant-fixtures'
const server = setupServer(...handlers),
  base = 'http://localhost/__mock'
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  a.e.reset()
  for (const u of [admin, secondAdmin, applicant, demoUser, managerUser, ownerUser, tenantUser]) {
    const canonical = a.target(u.id)
    Object.assign(canonical, structuredClone(u))
    a.e.db.state.sessions[u.id] = u.id
  }
  a.ensure()
})
async function call(path: string, method = 'GET', body?: unknown, token = admin.id) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}
describe('Admin HTTP boundary', () => {
  it.each([demoUser, tenantUser, managerUser, ownerUser])(
    'rejects direct admin requests from $email',
    async (actor) => {
      expect((await call('/api/users', 'GET', undefined, actor.id)).status).toBe(403)
      expect((await call('/api/admin/dashboard', 'GET', undefined, actor.id)).status).toBe(403)
      expect(
        (
          await call(
            `/api/admin/owner-verifications/${applicant.id}/document`,
            'GET',
            undefined,
            actor.id,
          )
        ).status,
      ).toBe(403)
    },
  )
  it('requires authentication and returns Spring pagination with no secret fields', async () => {
    expect((await call('/api/users', 'GET', undefined, 'missing')).status).toBe(401)
    const list = await call('/api/users?page=1&size=2')
    expect(list.body.data.number).toBe(1)
    expect(list.body.data.content).toHaveLength(2)
    expect(JSON.stringify(list.body.data)).not.toMatch(
      /passwordHash|sessions|refreshToken|verification_secret/,
    )
    expect((await call('/api/users?size=101')).status).toBe(422)
  })
  it('phone-only invite is INVITED, cannot login or force activate, and hard delete is unavailable', async () => {
    const created = await call('/api/users', 'POST', {
      fullName: 'Lê Thanh Hải',
      email: null,
      phone: '+84912345600',
      dateOfBirth: null,
      gender: null,
    })
    expect(created.status).toBe(201)
    expect(created.body.data.email).toBeNull()
    expect(created.body.data.status).toBe('INVITED')
    expect(
      (await call(`/api/users/${created.body.data.id}/active-status`, 'PATCH', { active: true }))
        .status,
    ).toBe(409)
    expect((await call(`/api/users/${created.body.data.id}`, 'DELETE')).status).toBe(405)
  })
  it('entitlement responses strip credential fields from the canonical Admin', async () => {
    const canonical = a.target(admin.id)
    const original = canonical.passwordHash
    canonical.passwordHash = 'private-credential-marker'
    try {
      const response = await call('/api/admin/entitlements')
      expect(response.status).toBe(200)
      expect(response.body.data.user.roles).toContain('ADMIN')
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|private-credential-marker/)
    } finally {
      canonical.passwordHash = original
    }
  })
  it('disabled actors lose all cross-role APIs despite an old token', async () => {
    expect(
      (
        await call(`/api/users/${managerUser.id}/active-status`, 'PATCH', {
          active: false,
          version: 1,
        })
      ).status,
    ).toBe(200)
    expect(
      (await call(`/api/manager/branches/${id(10)}/rooms`, 'GET', undefined, managerUser.id))
        .status,
    ).toBe(401)
    expect((await call('/api/me', 'GET', undefined, managerUser.id)).status).toBe(401)
    expect(
      (
        await call(`/api/users/${managerUser.id}/active-status`, 'PATCH', {
          active: true,
          version: 2,
        })
      ).status,
    ).toBe(200)
    expect((await call('/api/me', 'GET', undefined, managerUser.id)).status).toBe(401)
  })
  it('concurrent review chooses one result, one audit, one applicant notification', async () => {
    const before = await call(`/api/admin/owner-verifications/${applicant.id}`),
      body = {
        decision: 'APPROVED',
        reason: 'Đã kiểm tra đầy đủ hồ sơ mẫu.',
        version: before.body.data.version,
      }
    const responses = await Promise.all([
      call(`/api/admin/owner-verifications/${applicant.id}/decision`, 'POST', body),
      call(
        `/api/admin/owner-verifications/${applicant.id}/decision`,
        'POST',
        { ...body, decision: 'REJECTED' },
        secondAdmin.id,
      ),
    ])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    expect(
      a.state.events.filter((a) => a.entityId === applicant.id && a.action.startsWith('OWNER_')),
    ).toHaveLength(1)
    expect(
      a.e.db.notifications(applicant.id).filter((n) => n.referenceType === 'OWNER_VERIFICATION'),
    ).toHaveLength(1)
  })
  it('Owner submission → Admin decision updates canonical role, own status and safe audit', async () => {
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvZkAAAAASUVORK5CYII='
    expect(
      (
        await call(
          '/api/owner/verification',
          'POST',
          {
            fullName: demoUser.fullName,
            phone: '+84901234567',
            document: {
              name: 'mock.png',
              mime: 'image/png',
              size: atob(image.split(',')[1]).length,
              url: image,
            },
          },
          demoUser.id,
        )
      ).status,
    ).toBe(201)
    const pending = await call(`/api/admin/owner-verifications/${demoUser.id}`)
    const approved = await call(`/api/admin/owner-verifications/${demoUser.id}/decision`, 'POST', {
      decision: 'APPROVED',
      reason: 'Đã kiểm tra đầy đủ tài liệu mẫu.',
      version: pending.body.data.version,
    })
    expect(approved.status).toBe(200)
    expect((await call('/api/me', 'GET', undefined, demoUser.id)).body.data.roles).toContain(
      'OWNER',
    )
    expect(
      (await call('/api/owner/verification', 'GET', undefined, demoUser.id)).body.data.eligible,
    ).toBe(true)
    const event = approved.body.data.history[0]
    expect((await call(`/api/admin/activity/${event.id}`)).body.data.detail.provisionedOwner).toBe(
      true,
    )
    expect((await call(`/api/admin/activity/${event.id}`, 'DELETE')).status).toBe(404)
  })
  it('ADMIN has read-only Branch summaries and no financial operational bypass', async () => {
    const list = await call('/api/admin/branches')
    expect(list.status).toBe(200)
    expect(JSON.stringify(list.body.data)).not.toMatch(/invoice|payment|zalo|qrUrl/)
    expect((await call(`/api/owner/branches/${id(10)}`, 'PATCH', {})).status).toBe(403)
    expect((await call(`/api/manager/branches/${id(10)}/payments`)).status).toBe(403)
    expect(
      (await call('/api/admin/roles/grant', 'POST', { role: 'ADMIN', userId: demoUser.id })).status,
    ).toBe(404)
  })
  it('validates date ranges and missing review resources safely', async () => {
    expect((await call('/api/admin/owner-verifications?from=bad')).status).toBe(422)
    expect((await call('/api/admin/activity?from=2026-10-20&to=2026-10-10')).status).toBe(422)
    expect((await call(`/api/admin/owner-verifications/${id(999999)}`)).status).toBe(404)
  })
  it('actual mock registration and email verification can enter the Admin approval journey', async () => {
    const email = `new-admin-journey-${crypto.randomUUID()}@example.test`
    expect(
      (
        await call('/api/auth/register', 'POST', {
          fullName: 'Nguyễn Bảo Thanh',
          email,
          password: 'TestJourney@123',
        })
      ).status,
    ).toBe(202)
    const user = a.e.db.state.users.find((u) => u.email === email)!,
      challenge = a.e.db.state.challenges.find((c) => c.userId === user.id)!
    expect(user.status).toBe('PENDING_VERIFICATION')
    expect((await call('/api/auth/verify-email', 'POST', { token: challenge.token })).status).toBe(
      200,
    )
    const login = await call('/api/auth/login', 'POST', { email, password: 'TestJourney@123' })
    expect(login.status).toBe(200)
    expect(login.body.data.user.roles).toEqual(['USER'])
    expect((await call('/api/users', 'GET', undefined, login.body.data.accessToken)).status).toBe(
      403,
    )
  })
})
