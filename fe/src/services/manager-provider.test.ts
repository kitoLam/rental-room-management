import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
const user = {
  id: '10000000-0000-4000-8000-000000007000',
  email: 'manager@tropro.demo',
  fullName: 'Nguyễn Quang Minh',
  roles: ['MANAGER' as const],
  phone: null,
  gender: null,
  dateOfBirth: null,
  status: 'ACTIVE' as const,
}
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})
describe('Manager provider and session boundaries', () => {
  it('uses explicit hybrid Manager mock while keeping auth and notifications real', async () => {
    vi.stubEnv('VITE_API_MODE', 'hybrid')
    vi.resetModules()
    const { provider, endpoint } = await import('./config')
    expect(provider('manager')).toBe('mock')
    expect(provider('auth')).toBe('real')
    expect(provider('notifications')).toBe('real')
    expect(endpoint('manager', '/api/manager/branches')).toBe('/__mock/api/manager/branches')
  })
  it('surfaces missing real Manager API without retrying a fake successful write', async () => {
    vi.stubEnv('VITE_API_MODE', 'real')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    vi.resetModules()
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 404, code: 404, message: 'Not found', data: null }), {
          status: 404,
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const { request } = await import('./http')
    await expect(
      request('manager', '/api/manager/branches', z.array(z.unknown())),
    ).rejects.toMatchObject({ status: 501 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps the pending Manager API unavailable even if a fetch mock could return data', async () => {
    vi.stubEnv('VITE_API_MODE', 'real')
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 0, data: [{ id: 'not-uuid' }] }), { status: 200 }),
        ),
    )
    const { managerApi } = await import('./manager')
    await expect(managerApi.branches()).rejects.toMatchObject({ status: 501 })
  })
  it('does not let a delayed old-session 401 clear a newly signed-in account', async () => {
    vi.stubEnv('VITE_API_MODE', 'real')
    vi.resetModules()
    let resolve!: (r: Response) => void
    const fetch = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const { useSession } = await import('@/features/auth/session-store')
    const { request } = await import('./http')
    useSession.getState().setSession({ accessToken: 'old-session', expiresIn: 900, user })
    const pending = request('notifications', '/api/notifications', z.array(z.unknown()))
    useSession.getState().setSession({ accessToken: 'new-session', expiresIn: 900, user })
    resolve(new Response(JSON.stringify({ code: 401, data: null }), { status: 401 }))
    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(useSession.getState().accessToken).toBe('new-session')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
