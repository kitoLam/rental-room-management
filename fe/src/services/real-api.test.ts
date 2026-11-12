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

  it('supports a fully offline mock application outside tests', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_API_MODE', 'mock')
    const { provider, hasMocks } = await import('./config')
    expect(provider('auth')).toBe('mock')
    expect(provider('catalog')).toBe('mock')
    expect(hasMocks).toBe(true)
  })

  it('accepts registration HTTP 202 without creating a login session', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(null, 202))
    vi.stubGlobal('fetch', fetcher)
    const { authService } = await import('./guest-user')
    const payload = {
      fullName: 'Nguyễn An',
      email: 'an@example.com',
      password: 'Test@1234',
      phone: '0901234567',
      dateOfBirth: '1999-05-20',
      permanentAddress: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      cccdNumber: '001234567890',
      cccdIssueDate: '2021-08-15',
      cccdIssuePlace: 'Cục Cảnh sát QLHC về TTXH',
      cccdFrontImageUrl: 'data:image/png;base64,abc',
      cccdBackImageUrl: 'data:image/png;base64,def',
      confirmPassword: 'Test@1234',
      termsAccepted: true,
    }
    await expect(authService.register(payload)).resolves.toBeNull()
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/auth/signup')
    expect(fetcher.mock.calls[0][1].method).toBe('POST')
    expect(fetcher.mock.calls[0][1].credentials).toBe('include')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      dateOfBirth: '1999-05-20',
      permanentAddress: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      cccdIssueDate: '2021-08-15',
      cccdIssuePlace: 'Cục Cảnh sát QLHC về TTXH',
    })
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
    ['utilities', '/api/meter-charges', 'POST'],
    ['notifications', '/api/notifications/send', 'POST'],
  ] as const)('blocks pending %s contract %s without sending or mocking success', async (feature, path, method) => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const { request } = await import('./http')
    await expect(request(feature, path, z.unknown(), { method })).rejects.toMatchObject({ status: 501 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('allows owner access and assign endpoint on report-requests', async () => {
    const { realApiIssue } = await import('./real-api')
    const reqId = '60c72b2f9b1d8b2bad000001'
    expect(realApiIssue('owner', '/api/v1/report-requests?page=1&size=8', 'GET')).toBeNull()
    expect(realApiIssue('owner', `/api/v1/report-requests/${reqId}/assign`, 'POST')).toBeNull()
    expect(realApiIssue('manager', `/api/v1/report-requests/${reqId}/assign`, 'POST')).toBeNull()
    expect(realApiIssue('manager', `/api/v1/report-requests/${reqId}/escalate-admin`, 'POST')).not.toBeNull()
  })

  it('throws on real reportRequestService.search error instead of falling back to mock and maps page/tenantName', async () => {
    const okFetcher = vi.fn().mockResolvedValue(json({
      content: [{
        id: '60c72b2f9b1d8b2bad000001',
        tenantId: id,
        tenantName: 'Nguyễn Văn A',
        roomId: id,
        roomName: 'P101',
        type: 'REPAIR',
        title: 'Hỏng đèn',
        content: 'Đèn nhấp nháy',
        priority: 'HIGH',
        status: 'ESCALATED_ADMIN',
        timeline: [{ id: 'rec-1', reportRequestId: '60c72b2f9b1d8b2bad000001', actorId: 'u1', actorRole: 'TENANT', action: null, createdAt: '2026-11-12T00:00:00Z' }],
        createdAt: '2026-11-12T00:00:00Z',
        updatedAt: '2026-11-12T00:00:00Z',
      }],
      number: 1,
      size: 8,
      totalElements: 1,
      totalPages: 1,
    }))
    vi.stubGlobal('fetch', okFetcher)
    const { reportRequestService } = await import('./report-request')
    const page = await reportRequestService.search({ page: 0, size: 8 }, 'manager')
    expect(okFetcher.mock.calls[0][0]).toContain('/api/v1/report-requests?page=1&size=8')
    expect(page.number).toBe(0)
    expect(page.content[0].tenantName).toBe('Nguyễn Văn A')
    expect(page.content[0].status).toBe('RESOLVED')

    const errFetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Server error' }), { status: 500 }))
    vi.stubGlobal('fetch', errFetcher)
    await expect(reportRequestService.search({ page: 0, size: 8 }, 'tenant')).rejects.toMatchObject({ status: 500 })
  })

  it('validates permanentAddress, dateOfBirth, cccdIssueDate, and cccdIssuePlace in registerSchema', async () => {
    const { registerSchema } = await import('@/lib/validation')
    const base = {
      fullName: 'Nguyễn An',
      email: 'an@example.com',
      phone: '0901234567',
      dateOfBirth: '1999-05-20',
      permanentAddress: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      cccdNumber: '001234567890',
      cccdIssueDate: '2021-08-15',
      cccdIssuePlace: 'Cục Cảnh sát QLHC về TTXH',
      cccdFrontImageUrl: 'data:image/png;base64,abc',
      cccdBackImageUrl: 'data:image/png;base64,def',
      password: 'Test@1234',
      confirmPassword: 'Test@1234',
      termsAccepted: true,
    }
    expect(registerSchema.safeParse(base).success).toBe(true)
    expect(registerSchema.safeParse({ ...base, permanentAddress: 'HN' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, dateOfBirth: '2099-01-01' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, cccdIssueDate: '1995-01-01' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, cccdIssuePlace: '' }).success).toBe(false)
  })
})
