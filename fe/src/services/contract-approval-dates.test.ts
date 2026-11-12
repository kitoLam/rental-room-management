import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const branchId = '20000000-0000-4000-8000-000000000002'
const contractId = '20000000-0000-4000-8000-000000000010'
const bookingId = '20000000-0000-4000-8000-000000000020'
const managerId = '20000000-0000-4000-8000-000000000030'
const tenantId = '20000000-0000-4000-8000-000000000040'
const slotId = '20000000-0000-4000-8000-000000000050'
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ code: status === 200 ? 0 : status, status, message: '', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', 'real')
  vi.stubGlobal('window', { location: { search: '' } })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('contract approval dates', () => {
  it('keeps a draft contract without approved evidence free of invented start/end dates', async () => {
    // Backend xóa startDate/endDate khi tenant nộp evidence; adapter không được thay bằng ngày hôm nay,
    // nếu không trang Manager mất ngày dọn vào của booking và gửi mùng 1 trước ngày hiệu lực.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          id: contractId,
          roomId: branchId,
          managerId,
          contractNumber: 'HD-2026-001',
          startDate: null,
          endDate: null,
          terms: null,
          status: 'DRAFT',
          tenantName: 'Nguyễn Văn A',
          signedFileUrl: null,
          bookingId,
          evidenceSubmittedAt: '2026-11-11T08:01:46Z',
          termMonths: 6,
        }),
      ),
    )
    const { managerApi } = await import('./manager')
    const contract = (await managerApi.get(branchId, 'contracts', contractId)) as unknown as {
      startDate: string | null
      endDate: string | null
      sourceBookingId: string | null
    }
    expect(contract.startDate).toBeNull()
    expect(contract.endDate).toBeNull()
    expect(contract.sourceBookingId).toBe(bookingId)
  })
  it('keeps a booking without a confirmed move-in date distinct from its display start date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          id: bookingId,
          tenantId,
          roomSlotId: slotId,
          slotCode: 'A-01',
          expectedMoveInDate: null,
          expectedMoveOutDate: null,
          holdingDepositAmount: 1000000,
          paymentDeadline: null,
          holdExpiresAt: null,
          cancellationPolicy: null,
          depositStatus: 'PAID',
          rejectReason: null,
          status: 'CONFIRMED',
          termsAcceptedAt: null,
          createdAt: '2026-11-01T03:00:00Z',
          updatedAt: null,
          requesterUserId: tenantId,
          requesterName: null,
          requesterEmail: null,
          requesterPhone: null,
          roomTitle: null,
          branchId,
          branchName: null,
          timeline: [],
          contractId,
        }),
      ),
    )
    const { bookingService } = await import('./guest-user')
    const { bookingMoveInDate } = await import('@/lib/activity')
    const booking = await bookingService.get(bookingId)
    expect(booking.expectedMoveInDate).toBeNull()
    // Ngày hiển thị vẫn có giá trị dự phòng, nhưng ngày hiệu lực thật phải là null để lùi về quy tắc backend.
    expect(booking.startDate).toBe('2026-11-01')
    expect(bookingMoveInDate(booking)).toBeUndefined()
  })
})