import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
const id = '10000000-0000-4000-8000-000000008000'
const user = {
  id,
  fullName: 'Nguyễn Thảo Vy',
  email: 'vy@example.test',
  phone: null,
  status: 'ACTIVE',
  createdAt: '2026-10-16T10:00:00Z',
}
const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({ status, code: status === 200 ? 0 : status, message: 'API result', data }),
    { status },
  )
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', 'real')
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})
describe('Admin provider compatibility', () => {
  it('hybrid intentionally routes supported users real and missing administration mock', async () => {
    vi.stubEnv('VITE_API_MODE', 'hybrid')
    const { provider } = await import('./config')
    expect(provider('adminUsers')).toBe('real')
    expect(provider('admin')).toBe('mock')
  })
  it('accepts explicit independent provider overrides', async () => {
    vi.stubEnv('VITE_ADMIN_USERS_PROVIDER', 'mock')
    vi.stubEnv('VITE_ADMIN_PROVIDER', 'mock')
    const { provider } = await import('./config')
    expect(provider('adminUsers')).toBe('mock')
    expect(provider('admin')).toBe('mock')
  })
  it('normalizes zero-based Spring pages and never sends unsupported search/filter parameters', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json({ content: [user], number: 2, size: 20, totalElements: 45, totalPages: 3 }),
      )
    vi.stubGlobal('fetch', fetch)
    const { adminApi } = await import('./admin')
    const result = await adminApi.users({
      page: '2',
      size: '20',
      q: 'secret-query',
      role: 'OWNER',
      status: 'ACTIVE',
    })
    expect(result.number).toBe(3)
    expect(result.content[0].roles).toBeUndefined()
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/api/users?page=2&size=20')
  })
  it('supports nullable contact fields in the actual UserResponse', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ ...user, email: null, phone: '+84912345000', status: 'INVITED' }),
        ),
    )
    const { adminApi } = await import('./admin')
    expect((await adminApi.user(id)).email).toBeNull()
  })
  it('POST real sends only compatible creation fields, null optional channels and no password or role', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ ...user, status: 'INVITED' }))
    vi.stubGlobal('fetch', fetch)
    const { adminApi } = await import('./admin')
    await adminApi.create({
      fullName: 'Nguyễn Thảo Vy',
      email: '',
      phone: '+84912345000',
      dateOfBirth: '',
      gender: '',
    })
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/api/users')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      fullName: 'Nguyễn Thảo Vy',
      email: null,
      phone: '+84912345000',
      dateOfBirth: null,
      gender: null,
    })
  })
  it('PATCH real sends Boolean active only, not a fictional arbitrary status/version contract', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ ...user, status: 'DISABLED' }))
    vi.stubGlobal('fetch', fetch)
    const { adminApi } = await import('./admin')
    await adminApi.status(id, false, 9, 'Note not supported by BE')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ active: false })
    expect(fetch.mock.calls[0][0]).toBe(`https://api.example.test/api/users/${id}/active-status`)
  })
  it.each([403, 404, 409, 422, 500])(
    'real %s errors stay errors without fake fallback',
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(json(null, status))
      vi.stubGlobal('fetch', fetch)
      const { adminApi } = await import('./admin')
      await expect(adminApi.status(id, false)).rejects.toMatchObject({ status })
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )
  it('rejects malformed user and Spring page DTOs', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ content: [{ id: 'bad' }], number: 0, size: 20, totalElements: 1, totalPages: 1 }),
        ),
    )
    const { adminApi } = await import('./admin')
    await expect(adminApi.users({})).rejects.toMatchObject({ status: 502 })
  })
})
