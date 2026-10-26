import { afterEach, describe, expect, it, vi } from 'vitest'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})
describe('Owner API provider contracts', () => {
  it('uses mock Owner alongside real auth in hybrid mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'hybrid')
    vi.resetModules()
    const { provider, endpoint } = await import('./config')
    expect(provider('owner')).toBe('mock')
    expect(provider('auth')).toBe('real')
    expect(endpoint('owner', '/api/owner/branches')).toBe('/__mock/api/owner/branches')
  })
  it('honors explicit Owner provider override', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    vi.stubEnv('VITE_OWNER_PROVIDER', 'real')
    vi.resetModules()
    expect((await import('./config')).provider('owner')).toBe('real')
  })
  it('does not replace a failed real Owner mutation with mock success', async () => {
    vi.stubEnv('VITE_API_MODE', 'real')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    vi.resetModules()
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 404, message: 'Not found', data: null }), {
          status: 404,
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const { ownerApi } = await import('./owner')
    await expect(ownerApi.mutate('/branches', { code: 'TEST' })).rejects.toMatchObject({
      status: 501,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps financial reports unavailable until their real contract exists', async () => {
    vi.stubEnv('VITE_API_MODE', 'real')
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 0, data: { totals: { receipts: 'wrong' } } }), {
            status: 200,
          }),
        ),
    )
    const { ownerApi } = await import('./owner')
    await expect(ownerApi.summary({ month: '2026-10' })).rejects.toMatchObject({ status: 501 })
  })
})
