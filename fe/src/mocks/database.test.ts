import { beforeEach, describe, expect, it } from 'vitest'
import { MockDatabase, overlaps } from './database'
import { demoUser, fixtureId, policies, rooms } from './fixtures'
import { addDays, bookingInputSchema, dateRangeSchema, safeRedirect } from '@/lib/validation'
import { parseFilters } from '@/features/rooms/search-filters'
import type { BookingInput } from '@/interfaces/domain'

let db: MockDatabase
const input = (index = 0): BookingInput => ({
  roomId: rooms[index].id,
  rentalMode: rooms[index].rentalMode,
  startDate: addDays(3),
  endDate: addDays(34),
  policyId: policies[index % 3].id,
  policyVersion: 1,
  acknowledged: true,
})
beforeEach(() => {
  db = new MockDatabase()
})
describe('rental domain and trusted payment simulation', () => {
  it('creates ROOM booking without an appointment or slot and snapshots its branch policy', () => {
    const b = db.createBooking(input(1), demoUser.id)
    expect(b.status).toBe('AWAITING_PAYMENT')
    expect(b.roomSlotId).toBeNull()
    expect(b.holdAmount).toBe(policies[1].bookingHoldAmount)
    expect(b.policySnapshot).not.toBe(policies[1])
    expect(b.policySnapshot.version).toBe(1)
  })
  it('requires a valid date-sensitive SLOT and rejects occupied/wrong slots', () => {
    const base = input(2)
    expect(() => db.createBooking(base, demoUser.id)).toThrow()
    expect(() => db.createBooking({ ...base, roomSlotId: fixtureId(999) }, demoUser.id)).toThrow()
    expect(() => db.createBooking({ ...base, roomSlotId: fixtureId(1020) }, demoUser.id)).toThrow()
    const valid = db
      .availability(base.roomId, base.startDate, base.endDate)
      .slots.find((s) => s.available)!
    const b = db.createBooking({ ...base, roomSlotId: valid.id }, demoUser.id)
    expect(b.roomSlotId).toBe(valid.id)
    expect(() => db.createBooking({ ...base, roomSlotId: valid.id }, fixtureId(2))).toThrow(
      /giữ\/thuê/,
    )
  })
  it('rejects overlapping ROOM requests and allows adjacent [start,end) intervals', () => {
    const b = db.createBooking(input(), demoUser.id)
    expect(() => db.createBooking(input(), fixtureId(2))).toThrow()
    expect(
      db.createBooking({ ...input(), startDate: b.endDate, endDate: addDays(65) }, demoUser.id)
        .status,
    ).toBe('AWAITING_PAYMENT')
  })
  it('rejects reversed, past, impossible dates and resource/mode mismatches', () => {
    expect(dateRangeSchema.safeParse({ startDate: addDays(10), endDate: addDays(2) }).success).toBe(
      false,
    )
    expect(dateRangeSchema.safeParse({ startDate: addDays(-1), endDate: addDays(2) }).success).toBe(
      false,
    )
    expect(
      dateRangeSchema.safeParse({ startDate: '2099-02-30', endDate: '2099-03-31' }).success,
    ).toBe(false)
    expect(() =>
      db.createBooking(
        { ...input(), rentalMode: 'SLOT', roomSlotId: fixtureId(1000) },
        demoUser.id,
      ),
    ).toThrow()
    expect(bookingInputSchema.safeParse({ ...input(), roomSlotId: fixtureId(1000) }).success).toBe(
      false,
    )
  })
  it('rejects maintenance/inactive and stale/unacknowledged policies', () => {
    expect(() => db.createBooking(input(10), demoUser.id)).toThrow()
    expect(() => db.createBooking(input(11), demoUser.id)).toThrow()
    expect(() => db.createBooking({ ...input(), policyVersion: 2 }, demoUser.id)).toThrow(
      /Chính sách/,
    )
    expect(() => db.createBooking({ ...input(), acknowledged: false }, demoUser.id)).toThrow()
  })
  it('does not confirm on initiation; trusted simulation verifies and notifies', () => {
    const b = db.createBooking(input(), demoUser.id)
    const p = db.initiatePayment(b.id, demoUser.id, 'success')
    expect(p.status).toBe('PENDING')
    expect(b.status).toBe('AWAITING_PAYMENT')
    db.tick(Date.now() + 7000)
    expect(p.status).toBe('VERIFIED')
    expect(b.status).toBe('CONFIRMED')
    expect(db.notifications(demoUser.id).some((n) => n.title === 'Giữ chỗ đã được xác nhận')).toBe(
      true,
    )
    expect(() => db.cancelBooking(b.id, demoUser.id)).toThrow()
  })
  it('late payment becomes REVIEW and never restores an expired booking', () => {
    const b = db.createBooking(input(), demoUser.id)
    const p = db.initiatePayment(b.id, demoUser.id, 'late')
    db.tick(Date.now() + 4000)
    expect(b.status).toBe('EXPIRED')
    expect(p.status).toBe('PENDING')
    db.tick(Date.now() + 12000)
    expect(p.status).toBe('REVIEW')
    expect(b.status).toBe('EXPIRED')
    expect(() => db.initiatePayment(b.id, demoUser.id, 'success')).toThrow()
  })
  it('failed or pending payment never confirms and initiation is idempotent', () => {
    const b = db.createBooking(input(), demoUser.id)
    const p = db.initiatePayment(b.id, demoUser.id, 'failure')
    expect(db.initiatePayment(b.id, demoUser.id, 'success').id).toBe(p.id)
    db.tick(Date.now() + 7000)
    expect(p.status).toBe('FAILED')
    expect(b.status).toBe('AWAITING_PAYMENT')
  })
  it('enforces ownership and releases cancelled resources', () => {
    const b = db.createBooking(input(), demoUser.id)
    expect(() => db.cancelBooking(b.id, fixtureId(2))).toThrow(/quyền/)
    db.cancelBooking(b.id, demoUser.id)
    expect(db.availability(b.roomId, b.startDate, b.endDate).available).toBe(true)
  })
  it('a payment arriving after cancellation is reviewed, never confirmed', () => {
    const b = db.createBooking(input(), demoUser.id)
    const p = db.initiatePayment(b.id, demoUser.id, 'success')
    db.cancelBooking(b.id, demoUser.id)
    db.tick(Date.now() + 7000)
    expect(p.status).toBe('REVIEW')
    expect(b.status).toBe('CANCELLED')
  })
  it('creates PENDING appointment, enforces conflicts, opening hours and cancellation', () => {
    const appointment = {
      roomId: rooms[1].id,
      startAt: `${addDays(3)}T09:00:00+07:00`,
      endAt: `${addDays(3)}T09:30:00+07:00`,
      note: '',
    }
    const a = db.createAppointment(appointment, demoUser.id)
    expect(a.status).toBe('PENDING')
    expect(() => db.createAppointment(appointment, fixtureId(2))).toThrow(/lịch hẹn/)
    expect(() =>
      db.createAppointment(
        {
          ...appointment,
          startAt: `${addDays(4)}T07:00:00+07:00`,
          endAt: `${addDays(4)}T07:30:00+07:00`,
        },
        demoUser.id,
      ),
    ).toThrow()
    expect(() => db.cancelAppointment(a.id, fixtureId(2))).toThrow()
    expect(db.cancelAppointment(a.id, demoUser.id).status).toBe('CANCELLED')
    expect(() => db.cancelAppointment(a.id, demoUser.id)).toThrow()
  })
  it('compares timestamps by instant, not offset spelling', () => {
    expect(
      overlaps(
        '2026-10-20T09:00:00+07:00',
        '2026-10-20T09:30:00+07:00',
        '2026-10-20T02:15:00Z',
        '2026-10-20T02:45:00Z',
      ),
    ).toBe(true)
  })
})
describe('boundary validation', () => {
  it('rejects external and authentication-loop redirects', () => {
    for (const path of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/login?redirect=/login',
    ])
      expect(safeRedirect(path)).toBe('/user/dashboard')
    expect(safeRedirect('/rooms/abc/bookings/new?slot=one')).toBe(
      '/rooms/abc/bookings/new?slot=one',
    )
  })
  it('normalizes URL filters and rejects invalid ranges/modes/pages', () => {
    expect(
      parseFilters(new URLSearchParams('mode=ROOM&price=2000000-3000000&page=2')).success,
    ).toBe(true)
    for (const value of [
      'mode=WHOLE_ROOM',
      'minPrice=900&maxPrice=100',
      'page=-1',
      'minPrice=NaN',
      'roomTypeId=invalid',
    ])
      expect(parseFilters(new URLSearchParams(value)).success).toBe(false)
  })
})
