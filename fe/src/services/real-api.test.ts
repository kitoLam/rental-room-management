import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const id = '20000000-0000-4000-8000-000000000001'
const json = (data: unknown, status = 200) => new Response(
  JSON.stringify({ status, code: 0, data }), { status },
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

describe('verified real API contracts', () => {
  it.each(['development', 'production'])('defaults %s to real for every feature', async (mode) => {
    vi.stubEnv('MODE', mode)
    vi.stubEnv('VITE_API_MODE', '')
    const { provider, hasMocks } = await import('./config')
    expect(provider('auth')).toBe('real')
    expect(provider('catalog')).toBe('real')
    expect(provider('manager')).toBe('real')
    expect(provider('tenant')).toBe('real')
    expect(hasMocks).toBe(false)
  })

  it('rejects a mock application configuration outside tests', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_API_MODE', 'mock')
    await expect(import('./config')).rejects.toThrow(/kiểm thử/)
  })

  it('accepts registration HTTP 202 without creating a login session', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(null, 202))
    vi.stubGlobal('fetch', fetcher)
    const { authService } = await import('./guest-user')
    await expect(authService.register({ fullName: 'Nguyễn An', email: 'an@example.com', password: 'Test@1234' })).resolves.toBeNull()
    expect(fetcher.mock.calls[0][0]).toBe('/api/auth/register')
    expect(fetcher.mock.calls[0][1].method).toBe('POST')
    expect(fetcher.mock.calls[0][1].credentials).toBe('include')
  })

  it('keeps the backend public page number and never invents availability', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({
      number: 1, size: 6, totalElements: 1, totalPages: 1,
      content: [{ branchId: id, branchName: 'Central', address: 'Hà Nội', roomTypeName: 'Studio', room: {
        id, branchId: id, roomTypeId: id, code: 'A01', rentalMode: 'ROOM', capacity: 2,
        areaSqm: 20, floorNumber: 1, referencePrice: 3000000, description: null,
        amenities: [], imageRefs: [], operationalStatus: 'MAINTENANCE',
      } }],
    }))
    vi.stubGlobal('fetch', fetcher)
    const { catalogService, defaultFilters } = await import('./guest-user')
    const page = await catalogService.rooms(defaultFilters)
    expect(fetcher.mock.calls[0][0]).toContain('/api/v1/public/rooms?page=0')
    expect(page.number).toBe(1)
    expect(page.content[0].availableSlots).toBeNull()
    const { getRoomBadge } = await import('@/features/rooms/lib/room-display')
    expect(getRoomBadge(page.content[0]).label).toBe('Đang sửa chữa')
  })

  it('maps unreadCount and sends only notification IDs when marking read', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ unreadCount: 4 })).mockResolvedValueOnce(json([]))
    vi.stubGlobal('fetch', fetcher)
    const { notificationService } = await import('./guest-user')
    await expect(notificationService.unread()).resolves.toEqual({ count: 4 })
    await notificationService.read([id])
    expect(fetcher.mock.calls[1][0]).toBe('/api/notifications/mark-read')
    expect(fetcher.mock.calls[1][1].method).toBe('PUT')
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ notificationIds: [id] })
  })

  it.each([
    ['leasing', '/api/bookings', 'POST'],
    ['owner', '/api/owner/branches', 'POST'],
    ['manager', '/api/manager/branches', 'GET'],
    ['tenant', '/api/tenant/tenancies', 'GET'],
    ['recovery', '/api/auth/forgot-password', 'POST'],
    ['admin', '/api/admin/owner-verifications', 'GET'],
    ['utilities', '/api/contract-services/register', 'POST'],
    ['notifications', '/api/notifications/send', 'POST'],
  ] as const)('blocks pending %s contract %s without sending or mocking success', async (feature, path, method) => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const { request } = await import('./http')
    await expect(request(feature, path, z.unknown(), { method })).rejects.toMatchObject({ status: 501 })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
