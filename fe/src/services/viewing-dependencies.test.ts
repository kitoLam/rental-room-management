import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const roomId = '710000000000000000000001'
const context = {
  accountId: 'external-account-id',
  tenantProfileId: '720000000000000000000001',
  fullName: 'Khách thử',
  phone: '0900000001',
  roles: ['TENANT'],
  canRequest: true,
  manageableBranchIds: [],
}
const eligibility = {
  roomId, branchId: '700000000000000000000001', roomNumber: '101',
  branchName: 'Chi nhánh thử', publicContactPhone: '0900000000',
  rentalMode: 'ROOM', canReceiveRequest: false, reason: 'TEMPORARY_HOLD',
}
const response = (data: unknown, status = 200) => new Response(
  JSON.stringify({ success: status < 400, message: 'Test', data }), { status },
)

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', 'hybrid')
  vi.stubEnv('VITE_AUTH_PROVIDER', 'mock')
  vi.stubEnv('VITE_VIEWING_PROVIDER', 'real')
  vi.stubEnv('VITE_API_BASE_URL', '')
  vi.stubGlobal('window', { location: { search: '' } })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('viewing integration boundaries', () => {
  it('reads the BE context without equating account and Tenant IDs or changing FE identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(context))
    vi.stubGlobal('fetch', fetcher)
    const { useSession } = await import('@/features/auth/session-store')
    const before = useSession.getState()
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    const result = await viewingDependenciesService.context()
    expect(result.accountId).toBe('external-account-id')
    expect(result.tenantProfileId).toBe('720000000000000000000001')
    expect(useSession.getState()).toBe(before)
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/appointments/context')
  })

  it('uses ObjectId room IDs and preserves temporary hold eligibility from the BE', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(eligibility))
    vi.stubGlobal('fetch', fetcher)
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    await expect(viewingDependenciesService.eligibility(roomId)).resolves.toMatchObject({
      canReceiveRequest: false, reason: 'TEMPORARY_HOLD',
    })
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/appointments/rooms/${roomId}/eligibility`)
    expect(fetcher.mock.calls[0][1].method).toBeUndefined()
  })

  it('rejects legacy demo UUIDs before sending a request', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    expect(() => viewingDependenciesService.eligibility('10000000-0000-4000-8000-000000000001'))
      .toThrow('ID phòng không hợp lệ.')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not claim success with FE fixtures when the inventory integration is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(null, 501))
    vi.stubGlobal('fetch', fetcher)
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    await expect(viewingDependenciesService.eligibility(roomId)).rejects.toMatchObject({ status: 501 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed source contracts rather than inventing room eligibility', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...eligibility, rentalMode: 'UNKNOWN' })))
    vi.stubGlobal('console', { ...console, error: vi.fn() })
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    await expect(viewingDependenciesService.eligibility(roomId)).rejects.toMatchObject({ status: 502 })
  })

  it('does not turn offline FE mock mode into a simulated successful backend integration', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    await expect(viewingDependenciesService.context()).rejects.toMatchObject({ status: 501 })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
