import { describe, expect, it } from 'vitest'
import { addMonths, bookingMoveInDate, firstBillingStartDate } from '@/lib/activity'

describe('firstBillingStartDate', () => {
  const now = new Date('2026-11-10T05:00:00Z')
  const evidence = '2026-11-10T03:00:00Z'
  const cases: Array<[string, string]> = [
    ['2026-12-01', '2027-01-01'],
    ['2026-12-15', '2027-01-01'],
    ['2026-12-30', '2027-01-01'],
    ['2026-12-31', '2027-01-01'],
    ['2027-01-01', '2027-02-01'],
    ['2027-01-20', '2027-02-01'],
    ['2026-11-09', '2026-12-01'],
    ['2026-11-01', '2026-12-01'],
  ]

  it.each(cases)('starts the first billing period on the 1st of the month after %s', (from, expected) => {
    expect(firstBillingStartDate(evidence, now, from)).toBe(expected)
  })

  it('skips past months when the lease start is long gone', () => {
    expect(firstBillingStartDate(evidence, now, '2026-01-15')).toBe('2026-12-01')
  })

  it('falls back to the day after evidence was submitted when there is no lease start', () => {
    expect(firstBillingStartDate('2026-12-20T03:00:00Z', now)).toBe('2027-01-01')
  })

  it('never suggests a first billing day before the lease start (the 400 on approval)', () => {
    const evidenceAt = '2026-11-11T08:01:46Z'
    // Ngày dọn vào tháng 12: gợi ý cũ (mùng 1 tháng 12 tính từ hôm nay) rơi trước ngày hiệu lực → backend từ chối.
    expect(firstBillingStartDate(evidenceAt, now, '2026-12-05')).toBe('2027-01-01')
    expect(firstBillingStartDate(evidenceAt, now, '2026-12-01')).toMatch(/^\d{4}-\d{2}-01$/)
    for (const moveIn of ['2026-11-20', '2026-12-05', '2027-01-01', '2027-03-31'])
      expect(firstBillingStartDate(evidenceAt, now, moveIn) >= moveIn).toBe(true)
  })
})

describe('bookingMoveInDate', () => {
  it('prefers the confirmed move-in date and keeps null separate from the display fallback', () => {
    expect(bookingMoveInDate({ expectedMoveInDate: '2026-12-05', startDate: '2026-12-05' })).toBe('2026-12-05')
    expect(bookingMoveInDate({ expectedMoveInDate: null, startDate: '2026-11-01' })).toBeUndefined()
    // Mock không mang expectedMoveInDate nên dùng startDate đã gán sẵn.
    expect(bookingMoveInDate({ startDate: '2026-12-05' })).toBe('2026-12-05')
    expect(bookingMoveInDate(undefined)).toBeUndefined()
  })
})

describe('addMonths', () => {
  it('keeps the day and clamps to the last day of a shorter month like LocalDate.plusMonths', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-12-30', 3)).toBe('2027-03-30')
    expect(addMonths('2026-12-31', 12)).toBe('2027-12-31')
  })
})