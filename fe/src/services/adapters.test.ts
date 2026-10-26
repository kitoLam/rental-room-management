import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
const roomId = '20000000-0000-4000-8000-000000000001'
const branchId = '20000000-0000-4000-8000-000000000002'
const typeId = '20000000-0000-4000-8000-000000000003'
const realSession = {
  accessToken: 'real-access-test-only',
  expiresIn: 900,
  accountId: roomId,
  email: 'qa@example.com',
  fullName: 'Nguyễn An',
  role: 'USER',
}
const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({ code: status === 200 ? 0 : status, status, message: 'Server error', data }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', 'real')
  vi.stubGlobal('window', { location: { search: '' } })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('real/hybrid API boundaries', () => {
  it('uses zero-based requests, normalizes real room data, and leaves availability unknown', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        number: 2,
        size: 6,
        totalElements: 9,
        totalPages: 2,
        content: [
          {
            branchId,
            branchName: 'Chi nhánh test',
            address: 'Thủ Đức',
            roomTypeName: 'Studio',
            room: {
              id: roomId,
              branchId,
              roomTypeId: typeId,
              code: 'A-01',
              rentalMode: 'ROOM',
              capacity: 2,
              areaSqm: 22,
              floorNumber: 1,
              referencePrice: 3000000,
              description: null,
              amenities: ['Wifi'],
              imageRefs: ['https://example.com/room.jpg'],
              operationalStatus: 'ACTIVE',
            },
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetcher)
    const { catalogService, defaultFilters } = await import('./guest-user')
    const page = await catalogService.rooms({ ...defaultFilters, page: 2, sort: 'price-asc' })
    expect(fetcher.mock.calls[0][0]).toContain('page=1')
    expect(fetcher.mock.calls[0][0]).toContain('sort=referencePrice%2Casc')
    expect(page.number).toBe(2)
    expect(page.content[0].rentalMode).toBe('ROOM')
    expect(page.content[0].status).toBe('UNKNOWN')
    expect(page.content[0].availableSlots).toBeNull()
    expect(page.content[0].services).toEqual([])
  })
  it('rejects unsupported real filters before sending an invented request', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const { catalogService, defaultFilters } = await import('./guest-user')
    await expect(catalogService.rooms({ ...defaultFilters, mode: 'SLOT' })).rejects.toThrow(
      /chưa khả dụng/,
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([401, 403, 404, 409, 500])('does not fall back to mocks for HTTP %i', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(json(null, status))
    vi.stubGlobal('fetch', fetcher)
    const { request } = await import('./http')
    await expect(
      request('catalog', '/api/v1/public/rooms', z.unknown(), {}, false),
    ).rejects.toMatchObject({ status })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/public/rooms')
  })
  it('auth uses credentialed requests and keeps the actual selected role', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ ...realSession, role: 'OWNER' }))
    vi.stubGlobal('fetch', fetcher)
    const { authService } = await import('./guest-user')
    const session = await authService.login({ email: 'qa@example.com', password: 'password-test' })
    expect(session.user.roles).toEqual(['OWNER'])
    expect(fetcher.mock.calls[0][1].credentials).toBe('include')
    expect(session).not.toHaveProperty('refreshToken')
  })
  it('deduplicates simultaneous refresh requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(realSession))
    vi.stubGlobal('fetch', fetcher)
    const { recoverSession } = await import('./http')
    await Promise.all([recoverSession(), recoverSession()])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('preserves a server failure after successful refresh instead of clearing a valid session', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(null, 401))
      .mockResolvedValueOnce(json(realSession))
      .mockResolvedValueOnce(json(null, 500))
    vi.stubGlobal('fetch', fetcher)
    const { request } = await import('./http')
    const { useSession } = await import('@/features/auth/session-store')
    await expect(
      request(
        'notifications',
        '/api/notifications/unread-count',
        z.object({ unreadCount: z.number() }),
      ),
    ).rejects.toMatchObject({ status: 500 })
    expect(useSession.getState().accessToken).toBe(realSession.accessToken)
  })
  it('adapts the actual backend unreadCount field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ unreadCount: 3 })))
    const { notificationService } = await import('./guest-user')
    expect(await notificationService.unread()).toEqual({ count: 3 })
  })
  it('hybrid routing is explicit per feature', async () => {
    vi.stubEnv('VITE_API_MODE', 'hybrid')
    const { provider, endpoint } = await import('./config')
    expect(provider('auth')).toBe('real')
    expect(provider('notifications')).toBe('real')
    expect(provider('catalog')).toBe('mock')
    expect(endpoint('leasing', '/api/bookings')).toBe('/__mock/api/bookings')
  })
})
