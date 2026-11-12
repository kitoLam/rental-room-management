import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { viewingConfigurationInputSchema } from './viewing-dependencies'

const room = '710000000000000000000001'
const periods = [
  { type: 'MORNING' as const, startTime: '08:00', endTime: '10:00', isActive: true },
  { type: 'AFTERNOON' as const, startTime: '14:00', endTime: '16:00', isActive: true },
  { type: 'EVENING' as const, startTime: '18:00', endTime: '20:00', isActive: true },
]
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', 'hybrid')
  vi.stubEnv('VITE_AUTH_PROVIDER', 'mock')
  vi.stubEnv('VITE_VIEWING_PROVIDER', 'real')
  vi.stubEnv('DEV', true)
  vi.stubGlobal('window', { location: { search: '' } })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('three viewing periods', () => {
  it('accepts adjacent periods and rejects overlaps even when disabled', () => {
    const adjacent = periods.map((p) => ({ ...p }))
    adjacent[0].endTime = '14:00'
    expect(
      viewingConfigurationInputSchema.safeParse({ version: 0, periods: adjacent }).success,
    ).toBe(true)
    adjacent[0].endTime = '15:00'
    adjacent[0].isActive = false
    expect(
      viewingConfigurationInputSchema.safeParse({ version: 0, periods: adjacent }).success,
    ).toBe(false)
  })
  it('rejects duplicate types, fourth periods, overnight hours and client-supplied capacity', () => {
    for (const invalid of [
      [periods[0], periods[0], periods[2]],
      [...periods, periods[0]],
      [{ ...periods[0], startTime: '22:00', endTime: '02:00' }, periods[1], periods[2]],
      [{ ...periods[0], maxAppointments: 2 }, periods[1], periods[2]],
    ])
      expect(
        viewingConfigurationInputSchema.safeParse({ version: 0, periods: invalid }).success,
      ).toBe(false)
  })
  it('sends only version and the three editable period properties to the real BE', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            roomId: room,
            branchId: '700000000000000000000001', roomNumber: '101', branchName: 'Chi nhánh thử',
            version: 1,
            existingAppointments: [],
            periods: periods.map((p, i) => ({ ...p, id: `73000000000000000000000${i + 1}` })),
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetcher)
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    await viewingDependenciesService.updateConfiguration(room, { version: 0, periods })
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/shifts/rooms/${room}`)
    expect(fetcher.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ version: 0, periods })
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('X-Viewing-Dev-Account')
  })
  it('does not fall back to mock or retry a stale configuration save', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            errorCode: 'SHIFT_VERSION_CONFLICT',
            message: 'Cấu hình ca đã thay đổi.',
          }),
          { status: 409 },
        ),
      )
    vi.stubGlobal('fetch', fetcher)
    const { viewingDependenciesService } = await import('./viewing-dependencies')
    await expect(
      viewingDependenciesService.updateConfiguration(room, { version: 0, periods }),
    ).rejects.toMatchObject({ status: 409 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
