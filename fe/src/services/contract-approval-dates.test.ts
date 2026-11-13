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
  it('uploads the signed file and submits the returned Cloudinary URL', async () => {
    const evidenceUrl = 'https://res.cloudinary.com/demo/image/upload/signed.pdf'
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ secureUrl: evidenceUrl }))
      .mockResolvedValueOnce(json({
        id: contractId, roomId: branchId, roomSlotId: slotId, bookingId, tenantId, managerId,
        contractNumber: 'HD-000034', startDate: null, endDate: null, rentPrice: 1000000,
        contractDepositAmount: 1166667, terms: null, paymentDueDay: null, signedFileUrl: null,
        status: 'DRAFT', signedEvidenceUrl: evidenceUrl,
      }))
    vi.stubGlobal('fetch', fetcher)
    const { submitContractEvidence } = await import('@/features/leasing/contract-evidence-file')
    await expect(submitContractEvidence(contractId, new File(['sample'], 'signed.txt', { type: 'text/plain' }), 6))
      .rejects.toThrow('Chọn file PDF, JPG hoặc PNG')
    expect(fetcher).not.toHaveBeenCalled()
    const file = new File(['sample'], 'signed.pdf', { type: 'application/pdf' })
    await expect(submitContractEvidence(contractId, file, 6)).resolves.toMatchObject({ signedEvidenceUrl: evidenceUrl })
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/public/upload?folder=contract-evidence')
    expect(fetcher.mock.calls[0][1].body.get('file')).toBe(file)
    expect(fetcher.mock.calls[1][0]).toBe(`/api/v1/contracts/${contractId}/evidence`)
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ evidenceUrl, termMonths: 6 })
  })

  it('chốt kỳ hạn rồi lấy link PDF qua API cho người thuê và quản lý', async () => {
    const pdfUrl = 'https://api.cloudinary.com/v1_1/demo/raw/download?signature=example'
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({
        id: contractId,
        roomId: branchId,
        roomSlotId: slotId,
        bookingId,
        tenantId,
        managerId: null,
        contractNumber: 'HD-000030',
        startDate: '2026-11-15',
        endDate: '2027-05-15',
        rentPrice: 1000000,
        contractDepositAmount: 1000000,
        paymentDueDay: null,
        terms: null,
        signedFileUrl: null,
        termMonths: 6,
        generatedPdf: true,
        contractUrl: null,
        status: 'DRAFT',
      }))
      .mockResolvedValueOnce(json(pdfUrl))
      .mockResolvedValueOnce(json(pdfUrl))
    vi.stubGlobal('fetch', fetcher)
    const { contractService } = await import('./guest-user')
    await expect(contractService.chooseTerm(contractId, 6)).resolves.toMatchObject({
      termMonths: 6,
      endDate: '2027-05-15',
      generatedPdf: true,
      contractUrl: null,
    })
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/contracts/${contractId}/term`)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: '{"termMonths":6}' })
    await expect(contractService.downloadPdf(contractId)).resolves.toBe(pdfUrl)
    await expect(contractService.downloadPdf(contractId, 'manager')).resolves.toBe(pdfUrl)
    expect(fetcher.mock.calls.slice(1).map(([path]) => path)).toEqual([
      `/api/v1/contracts/${contractId}/pdf`,
      `/api/v1/contracts/${contractId}/pdf`,
    ])
  })

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
