import type {
  Appointment,
  AppointmentInput,
  Availability,
  Booking,
  BookingInput,
  Notification,
  Payment,
  PaymentScenario,
  RoomFilters,
  User,
  Branch,
  BranchPolicy,
} from '@/interfaces/domain'
import { appointmentInputSchema, bookingInputSchema, dateRangeSchema } from '@/lib/validation'
import { allocations, branches, demoUser, policies, seedActivity } from './fixtures'
import { inventory, type MockInventory } from './inventory'
import type { Allocation } from './fixtures'

export class MockError extends Error {
  status: number
  constructor(message: string, status = 422) {
    super(message)
    this.status = status
  }
}
type MockUser = User & { passwordHash?: string }
type MockPayment = Payment & { settlementAt: number; outcome: PaymentScenario }
type DbState = ReturnType<typeof seedActivity> & {
  users: MockUser[]
  sessions: Record<string, string>
  refreshUserId: string | null
  challenges: { token: string; userId: string; purpose: 'verify' | 'reset'; expiresAt: number }[]
  payments: MockPayment[]
}
const ACTIVE = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'CONVERTED']
export const overlaps = (a: string, b: string, c: string, d: string) =>
  Date.parse(a) < Date.parse(d) && Date.parse(c) < Date.parse(b)
export class MockDatabase {
  state: DbState
  inventory: MockInventory
  occupancyProvider: () => Allocation[] = () => []
  bookingAllocationActive: (booking: Booking) => boolean = () => true
  policyProvider: () => BranchPolicy[] = () => policies
  branchProvider: () => Branch[] = () => branches
  branchVisible: (id: string) => boolean = () => true
  branchQr: (id: string) => string | null = () => null
  constructor(state?: DbState, catalog = inventory) {
    this.inventory = catalog
    this.state = state || {
      ...seedActivity(),
      users: [structuredClone(demoUser)],
      sessions: {},
      refreshUserId: null,
      challenges: [],
      payments: [],
    }
    if (!state) {
      this.state.payments = this.state.bookings
        .filter((b) => b.status === 'CONFIRMED')
        .map((b) => ({
          id: crypto.randomUUID(),
          bookingId: b.id,
          amount: b.holdAmount,
          reference: `DEMO-${b.id.slice(0, 8).toUpperCase()}`,
          status: 'VERIFIED',
          environment: 'SANDBOX',
          createdAt: b.createdAt,
          verifiedAt: b.createdAt,
          qrUrl: null,
          instructions: 'Giao dịch mẫu đã được xác minh trong môi trường demo.',
          settlementAt: 0,
          outcome: 'success',
        }))
    }
  }
  save() {
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem('tropro-demo-v2', JSON.stringify(this.state))
  }
  own<T extends { requesterUserId: string }>(items: T[], id: string, userId: string): T {
    const record = items.find((v) => 'id' in v && v.id === id)
    if (!record) throw new MockError('Không tìm thấy dữ liệu.', 404)
    if (record.requesterUserId !== userId)
      throw new MockError('Bạn không có quyền truy cập dữ liệu này.', 403)
    return record
  }
  notify(
    userId: string,
    title: string,
    message: string,
    referenceType: string,
    referenceId: string,
    contractTenantId?: string,
    branchId?: string,
  ) {
    this.state.notifications.unshift({
      id: crypto.randomUUID(),
      recipientUserId: userId,
      title,
      message,
      referenceType,
      referenceId,
      ...(contractTenantId ? { contractTenantId } : {}),
      ...(branchId ? { branchId } : {}),
      read: false,
      type: referenceType,
      createdAt: new Date().toISOString(),
    })
  }
  tick(now = Date.now()) {
    for (const booking of this.state.bookings) {
      if (
        ['REQUESTED', 'AWAITING_PAYMENT'].includes(booking.status) &&
        now >= Math.min(Date.parse(booking.paymentDueAt), Date.parse(booking.temporaryHoldUntil))
      ) {
        booking.status = 'EXPIRED'
        booking.timeline.push({
          status: 'EXPIRED',
          at: new Date(now).toISOString(),
          note: 'Quá hạn thanh toán; tài nguyên đã được giải phóng.',
        })
        this.notify(
          booking.requesterUserId,
          'Yêu cầu giữ chỗ đã hết hạn',
          'Vui lòng kiểm tra lại phòng trước khi tạo yêu cầu mới.',
          'BOOKING',
          booking.id,
        )
      }
      if (
        booking.status === 'CONFIRMED' &&
        booking.confirmedHoldUntil &&
        now >= Date.parse(booking.confirmedHoldUntil)
      ) {
        booking.status = 'EXPIRED'
        booking.timeline.push({
          status: 'EXPIRED',
          at: new Date(now).toISOString(),
          note: 'Đã hết thời hạn giữ chỗ đã xác nhận.',
        })
      }
    }
    for (const payment of this.state.payments) {
      if (
        payment.status !== 'PENDING' ||
        now < payment.settlementAt ||
        payment.outcome === 'pending'
      )
        continue
      const booking = this.state.bookings.find((b) => b.id === payment.bookingId)!
      if (payment.outcome === 'failure') {
        payment.status = 'FAILED'
        this.notify(
          booking.requesterUserId,
          'Thanh toán demo chưa thành công',
          'Bạn có thể thử lại khi yêu cầu giữ chỗ còn hiệu lực.',
          'BOOKING',
          booking.id,
        )
      } else if (
        booking.status !== 'AWAITING_PAYMENT' ||
        now >= Date.parse(booking.paymentDueAt) ||
        now >= Date.parse(booking.temporaryHoldUntil)
      ) {
        payment.status = 'REVIEW'
        this.notify(
          booking.requesterUserId,
          'Giao dịch cần đối soát',
          'Yêu cầu giữ chỗ không được tự khôi phục. Liên hệ chi nhánh để được xử lý.',
          'BOOKING',
          booking.id,
        )
      } else {
        payment.status = 'VERIFIED'
        payment.verifiedAt = new Date(now).toISOString()
        booking.status = 'CONFIRMED'
        booking.confirmedHoldUntil = new Date(
          now + booking.policySnapshot.confirmedHoldMinutes * 60000,
        ).toISOString()
        booking.timeline.push({
          status: 'CONFIRMED',
          at: new Date(now).toISOString(),
          note: 'Bộ mô phỏng đã xác minh đủ khoản giữ chỗ.',
        })
        this.notify(
          booking.requesterUserId,
          'Giữ chỗ đã được xác nhận',
          'Khoản giữ chỗ demo đã được xác minh. Chi nhánh sẽ liên hệ để trao đổi hợp đồng.',
          'BOOKING',
          booking.id,
        )
      }
    }
    this.save()
  }
  room(id: string) {
    const room = this.inventory.state.rooms.find((v) => v.id === id)
    if (!room) throw new MockError('Không tìm thấy phòng.', 404)
    return room
  }
  policy(branchId: string) {
    const policy = this.policyProvider()
      .filter((v) => v.branchId === branchId && Date.parse(v.effectiveFrom) <= Date.now())
      .sort((a, b) => b.version - a.version)[0]
    if (!policy) throw new MockError('Chi nhánh chưa có chính sách hiệu lực.', 409)
    return policy
  }
  availability(roomId: string, startDate: string, endDate: string): Availability {
    dateRangeSchema.parse({ startDate, endDate })
    this.tick()
    const room = this.room(roomId)
    if (!room.isPublic || !this.branchVisible(room.branchId)) throw new MockError('Phòng không còn được công khai.', 404)
    const blocked = [
      ...allocations,
      ...this.occupancyProvider(),
      ...this.state.bookings
        .filter((b) => ACTIVE.includes(b.status) && this.bookingAllocationActive(b))
        .map((b) => ({
          roomId: b.roomId,
          roomSlotId: b.roomSlotId,
          startDate: b.startDate,
          endDate: b.endDate,
        })),
    ].filter((b) => b.roomId === roomId && overlaps(startDate, endDate, b.startDate, b.endDate))
    const operational = room.operationalStatus === 'ACTIVE'
    const slots =
      room.rentalMode === 'SLOT'
        ? this.inventory.state.slots
            .filter((s) => s.roomId === room.id)
            .map((slot) => {
              const id = slot.id
              return {
                id,
                label: slot.name,
                available:
                  operational &&
                  slot.operationalStatus === 'ACTIVE' &&
                  !blocked.some((b) => !b.roomSlotId || b.roomSlotId === id),
              }
            })
        : []
    const available =
      operational &&
      (room.rentalMode === 'SLOT' ? slots.some((s) => s.available) : blocked.length === 0)
    return {
      roomId,
      startDate,
      endDate,
      available,
      slots,
      reason: available
        ? null
        : !operational
          ? 'Phòng đang bảo trì hoặc tạm ngừng cho thuê.'
          : 'Phòng hoặc chỗ ở đã có lịch thuê/giữ chỗ trong khoảng ngày này.',
    }
  }
  listRooms(filters: RoomFilters) {
    const data = this.inventory.state.rooms
      .filter((r) => r.isPublic && this.branchVisible(r.branchId))
      .map((room) => {
        const date = new Date()
        const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        date.setDate(date.getDate() + 1)
        const end = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const available = this.availability(room.id, start, end)
        const held =
          this.occupancyProvider().some(
            (a) =>
              a.roomId === room.id && a.reserved && overlaps(start, end, a.startDate, a.endDate),
          ) ||
          this.state.bookings.some(
            (b) =>
              b.roomId === room.id &&
              ACTIVE.includes(b.status) &&
              b.status !== 'CONVERTED' &&
              overlaps(start, end, b.startDate, b.endDate),
          )
        return {
          ...room,
          availableSlots:
            room.rentalMode === 'SLOT'
              ? available.slots.filter((s) => s.available).length
              : available.available
                ? 1
                : 0,
          status:
            room.operationalStatus !== 'ACTIVE'
              ? room.operationalStatus
              : available.available
                ? ('AVAILABLE' as const)
                : held
                  ? ('HELD' as const)
                  : ('OCCUPIED' as const),
        }
      })
      .filter(
        (r) =>
          (!filters.q ||
            `${r.title} ${r.address} ${r.branchName}`
              .toLocaleLowerCase('vi')
              .includes(filters.q.toLocaleLowerCase('vi'))) &&
          (!filters.area ||
            r.areaKey === filters.area ||
            (filters.area === 'thu-duc' && r.address.includes('Thủ Đức'))) &&
          (!filters.branchId || r.branchId === filters.branchId) &&
          (filters.mode === 'ALL' || r.rentalMode === filters.mode) &&
          (!filters.roomTypeId || r.roomTypeId === filters.roomTypeId) &&
          (filters.minPrice === undefined || r.price >= filters.minPrice) &&
          (filters.maxPrice === undefined || r.price <= filters.maxPrice) &&
          (!filters.minCapacity || r.capacity >= filters.minCapacity) &&
          (!filters.availableOnly || r.status === 'AVAILABLE'),
      )
    data.sort((a, b) =>
      filters.sort === 'price-asc'
        ? a.price - b.price
        : filters.sort === 'price-desc'
          ? b.price - a.price
          : filters.sort === 'area-desc'
            ? (b.sizeM2 || 0) - (a.sizeM2 || 0)
            : a.code.localeCompare(b.code),
    )
    return data
  }
  createAppointment(input: AppointmentInput, userId: string) {
    appointmentInputSchema.parse(input)
    const room = this.room(input.roomId)
    if (!room.isPublic || !this.branchVisible(room.branchId)) throw new MockError('Phòng không còn được công khai.', 404)
    if (room.operationalStatus !== 'ACTIVE')
      throw new MockError('Phòng đang tạm ngừng nhận lịch xem.', 409)
    const policy = this.policy(room.branchId)
    const start = new Date(input.startAt)
    const end = new Date(input.endAt)
    const local = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
    const startLocal = local(start)
    const endLocal = local(end)
    if (
      startLocal.getHours() < policy.appointmentPolicy.openingHour ||
      endLocal.getHours() > policy.appointmentPolicy.closingHour ||
      (endLocal.getHours() === policy.appointmentPolicy.closingHour && endLocal.getMinutes() > 0) ||
      startLocal.toDateString() !== endLocal.toDateString() ||
      end.getTime() - start.getTime() > policy.appointmentPolicy.maxDurationMinutes * 60000
    )
      throw new MockError('Lịch xem phải trong giờ tiếp khách và không vượt thời lượng cho phép.')
    if (
      this.state.appointments.some(
        (a) =>
          ['PENDING', 'CONFIRMED'].includes(a.status) &&
          (a.roomId === input.roomId || a.requesterUserId === userId) &&
          overlaps(input.startAt, input.endAt, a.startAt, a.endAt),
      )
    )
      throw new MockError('Khoảng giờ này đã có lịch hẹn. Vui lòng chọn thời gian khác.', 409)
    const createdAt = new Date().toISOString()
    const record: Appointment = {
      ...input,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      id: crypto.randomUUID(),
      requesterUserId: userId,
      roomTitle: room.title,
      branchName: room.branchName,
      status: 'PENDING',
      assignedManager: null,
      policySnapshot: structuredClone(policy),
      createdAt,
      timeline: [
        { status: 'PENDING', at: createdAt, note: 'Đã gửi lịch hẹn; đang chờ chi nhánh xác nhận.' },
      ],
    }
    this.state.appointments.unshift(record)
    this.notify(
      userId,
      'Đã gửi lịch xem phòng',
      'Chi nhánh sẽ phản hồi lịch hẹn của bạn.',
      'APPOINTMENT',
      record.id,
    )
    this.save()
    return record
  }
  cancelAppointment(id: string, userId: string) {
    const record = this.own(this.state.appointments, id, userId)
    if (
      !['PENDING', 'CONFIRMED'].includes(record.status) ||
      Date.parse(record.startAt) - Date.now() <
        record.policySnapshot.appointmentPolicy.cancellationHours * 3600000
    )
      throw new MockError('Lịch hẹn không còn trong thời gian được phép hủy.', 409)
    record.status = 'CANCELLED'
    record.timeline.push({
      status: 'CANCELLED',
      at: new Date().toISOString(),
      note: 'Người đặt đã hủy lịch hẹn.',
    })
    this.notify(
      userId,
      'Đã hủy lịch xem phòng',
      'Bạn có thể chọn một lịch khác phù hợp hơn.',
      'APPOINTMENT',
      id,
    )
    this.save()
    return record
  }
  createBooking(input: BookingInput, userId: string) {
    const parsed = bookingInputSchema.safeParse(input)
    if (!parsed.success) throw new MockError(parsed.error.issues[0].message)
    const room = this.room(input.roomId)
    if (!room.isPublic || !this.branchVisible(room.branchId)) throw new MockError('Phòng không còn được công khai.', 404)
    const policy = this.policy(room.branchId)
    if (input.policyId !== policy.id || input.policyVersion !== policy.version)
      throw new MockError('Chính sách đã thay đổi. Tải lại và xác nhận chính sách mới.', 409)
    if (input.rentalMode !== room.rentalMode)
      throw new MockError('Hình thức thuê không khớp phòng.')
    const availability = this.availability(room.id, input.startDate, input.endDate)
    if (
      !availability.available ||
      (room.rentalMode === 'SLOT' &&
        !availability.slots.some((s) => s.id === input.roomSlotId && s.available))
    )
      throw new MockError('Phòng hoặc chỗ ở vừa được giữ/thuê. Vui lòng chọn lại.', 409)
    const createdAt = new Date().toISOString()
    const paymentDueAt = new Date(Date.now() + policy.paymentWindowMinutes * 60000).toISOString()
    const record: Booking = {
      id: crypto.randomUUID(),
      requesterUserId: userId,
      roomId: room.id,
      roomTitle: room.title,
      branchId: room.branchId,
      branchName: room.branchName,
      roomSlotId: input.roomSlotId || null,
      slotLabel: availability.slots.find((s) => s.id === input.roomSlotId)?.label || null,
      rentalMode: room.rentalMode,
      startDate: input.startDate,
      endDate: input.endDate,
      holdAmount: policy.bookingHoldAmount,
      paymentDueAt,
      temporaryHoldUntil: new Date(Date.now() + policy.temporaryHoldMinutes * 60000).toISOString(),
      confirmedHoldUntil: null,
      status: 'AWAITING_PAYMENT',
      policySnapshot: structuredClone(policy),
      paymentEnvironment: 'SANDBOX',
      createdAt,
      timeline: [
        { status: 'REQUESTED', at: createdAt, note: 'Đã tiếp nhận yêu cầu giữ chỗ.' },
        {
          status: 'AWAITING_PAYMENT',
          at: createdAt,
          note: 'Đã giữ tạm tài nguyên; đang chờ thanh toán được xác minh.',
        },
      ],
      contractId: null,
    }
    this.state.bookings.unshift(record)
    this.notify(
      userId,
      'Yêu cầu giữ chỗ đang chờ thanh toán',
      'Kiểm tra khoản giữ chỗ và thời hạn thanh toán.',
      'BOOKING',
      record.id,
    )
    this.save()
    return record
  }
  cancelBooking(id: string, userId: string) {
    this.tick()
    const record = this.own(this.state.bookings, id, userId)
    if (!['REQUESTED', 'AWAITING_PAYMENT'].includes(record.status))
      throw new MockError(
        'Trạng thái hiện tại không cho phép tự hủy. Liên hệ chi nhánh để được hỗ trợ.',
        409,
      )
    record.status = 'CANCELLED'
    record.timeline.push({
      status: 'CANCELLED',
      at: new Date().toISOString(),
      note: 'Người đặt đã hủy; tài nguyên được giải phóng.',
    })
    this.notify(
      userId,
      'Đã hủy yêu cầu giữ chỗ',
      'Phòng hoặc chỗ ở đã được giải phóng.',
      'BOOKING',
      id,
    )
    this.save()
    return record
  }
  initiatePayment(id: string, userId: string, scenario: PaymentScenario) {
    this.tick()
    const booking = this.own(this.state.bookings, id, userId)
    if (booking.status !== 'AWAITING_PAYMENT')
      throw new MockError('Yêu cầu này không thể thanh toán.', 409)
    const existing = this.state.payments.find(
      (p) => p.bookingId === id && ['PENDING', 'VERIFIED'].includes(p.status),
    )
    if (existing) return existing
    const payment: MockPayment = {
      id: crypto.randomUUID(),
      bookingId: id,
      amount: booking.holdAmount,
      reference: `DEMO-${id.slice(0, 8).toUpperCase()}`,
      status: 'PENDING',
      environment: 'SANDBOX',
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      qrUrl: null,
      instructions:
        'Môi trường mô phỏng. Không chuyển tiền thật. Không có tài khoản ngân hàng hoặc mã QR nhận tiền.',
      outcome: scenario,
      settlementAt: Date.now() + (scenario === 'late' ? 10000 : 6000),
    }
    if (scenario === 'late') {
      booking.paymentDueAt = new Date(Date.now() + 3000).toISOString()
      booking.temporaryHoldUntil = booking.paymentDueAt
    }
    this.state.payments.unshift(payment)
    this.save()
    return payment
  }
  notifications(userId: string): Notification[] {
    return this.state.notifications.filter((n) => n.recipientUserId === userId)
  }
  branch(id: string) {
    const branch = this.branchProvider().find((b) => b.id === id && this.branchVisible(id))
    if (!branch) throw new MockError('Không tìm thấy chi nhánh.', 404)
    return branch
  }
}
let persisted: DbState | undefined
try {
  if (typeof sessionStorage !== 'undefined')
    persisted = JSON.parse(sessionStorage.getItem('tropro-demo-v2') || 'null') || undefined
} catch {
  /* New session when demo storage is unavailable. */
}
export const db = new MockDatabase(persisted)
