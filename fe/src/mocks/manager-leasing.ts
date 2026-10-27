import { z } from 'zod'
import type { User } from '@/interfaces/domain'
import {
  contractInputSchema,
  tenancyInputSchema,
  type ManagerResource,
  type ManagerContract,
} from '@/interfaces/manager'
import type { Tenancy } from '@/interfaces/tenant'
import { MockError, overlaps } from './database'
import type { ManagerEngine } from './manager-engine'

function period(start: string, end: string) {
  if (end <= start) throw new MockError('Ngày kết thúc phải sau ngày bắt đầu.', 422)
}
export function eligibleUsers(e: ManagerEngine, branchId: string) {
  const ids = new Set([
    ...e.db.state.appointments
      .filter((a) =>
        e.inventory.state.rooms.some((r) => r.id === a.roomId && r.branchId === branchId),
      )
      .map((a) => a.requesterUserId),
    ...e.db.state.bookings.filter((b) => b.branchId === branchId).map((b) => b.requesterUserId),
    ...e.tenant.state.tenancies.filter((t) => t.branchId === branchId).map((t) => t.userId),
  ])
  return e.db.state.users
    .filter((u) => u.status === 'ACTIVE' && ids.has(u.id))
    .map(({ id, fullName, email, phone }) => ({ id, fullName, email, phone }))
}
function prepaidReady(e: ManagerEngine, t: Tenancy) {
  const payments = e.tenant.state.payments.filter(
    (p) => p.contractTenantId === t.id && p.status === 'VERIFIED' && !p.invoiceId,
  )
  if (
    payments.reduce((s, p) => s + p.prepaidFirstAmount, 0) < t.prepaidFirstRequired ||
    payments.reduce((s, p) => s + p.prepaidLastAmount, 0) < t.prepaidLastRequired
  )
    throw new MockError('Chưa có đủ tiền thuê trả trước đã xác minh cho quan hệ thuê.', 409)
}
function validateTenancy(e: ManagerEngine, c: ManagerContract, input: unknown, id?: string) {
  const data = tenancyInputSchema.parse(input)
  period(data.startDate, data.endDate)
  const [sy, sm, sd] = data.startDate.split('-').map(Number),
    [ey, em, ed] = data.endDate.split('-').map(Number)
  if (
    (ey - sy) * 12 + em - sm === 1 &&
    sd === ed &&
    (data.lastMonthRent !== 0 || data.prepaidLastRequired !== 0)
  )
    throw new MockError('Thuê đúng một tháng chỉ trả trước kỳ đầu; kỳ cuối phải bằng 0.', 422)
  if (data.startDate < c.startDate || data.endDate > c.endDate)
    throw new MockError('Thời hạn cá nhân phải nằm trong hợp đồng.', 422)
  if (!eligibleUsers(e, c.branchId).some((u) => u.id === data.userId))
    throw new MockError('Tài khoản chưa được cấp quyền tiếp nhận tại chi nhánh.', 422)
  const room = e.room(c.branchId, c.roomId)
  if (
    (c.rentalMode === 'ROOM' && data.roomSlotId) ||
    (c.rentalMode === 'SLOT' &&
      !e.inventory.state.slots.some(
        (s) => s.id === data.roomSlotId && s.roomId === room.id && s.operationalStatus === 'ACTIVE',
      ))
  )
    throw new MockError('Chọn chỗ hợp lệ theo hình thức thuê của phòng.', 422)
  if (
    data.prepaidFirstRequired !== data.firstMonthRent ||
    data.prepaidLastRequired !== data.lastMonthRent
  )
    throw new MockError('Nghĩa vụ trả trước phải khớp giá thuê kỳ đầu và kỳ cuối đã duyệt.', 422)
  const peers = e.tenant.state.tenancies.filter(
    (t) =>
      t.contractId === c.id &&
      t.id !== id &&
      ['DRAFT', 'ACTIVE'].includes(t.status) &&
      overlaps(t.startDate, t.endDate, data.startDate, data.endDate),
  )
  if (
    peers.some((t) => t.userId === data.userId) ||
    peers.length >= room.capacity ||
    (data.roomSlotId && peers.some((t) => t.roomSlotId === data.roomSlotId))
  )
    throw new MockError('Trùng tài khoản, chỗ ở hoặc vượt sức chứa trong khoảng thuê.', 409)
  if (data.role === 'REPRESENTATIVE' && peers.some((t) => t.role === 'REPRESENTATIVE'))
    throw new MockError('Hợp đồng chỉ có một người đại diện; dùng thao tác đổi đại diện.', 409)
  if (
    e.overlapsRoom(
      room.id,
      data.roomSlotId,
      data.startDate,
      data.endDate,
      c.id,
      c.sourceBookingId || undefined,
    )
  )
    throw new MockError('Phòng hoặc chỗ đã có nghĩa vụ thuê/giữ phòng chồng lấn.', 409)
  return data
}
function addTenancy(e: ManagerEngine, c: ManagerContract, input: unknown) {
  const data = validateTenancy(e, c, input),
    room = e.room(c.branchId, c.roomId),
    b = e.state.branches.find((b) => b.id === c.branchId)!,
    slot = e.inventory.state.slots.find((s) => s.id === data.roomSlotId)
  const t: Tenancy = {
    ...data,
    id: crypto.randomUUID(),
    contractId: c.id,
    branchId: c.branchId,
    roomId: c.roomId,
    branchName: b.name,
    roomName: room.title,
    slotName: slot?.name || null,
    rentalMode: c.rentalMode,
    status: 'DRAFT',
    contractStatus: c.status,
    code: c.code,
    actualLeaveDate: null,
    sharedTerms: c.terms,
    document: null,
  }
  e.tenant.state.tenancies.push(t)
  e.tenant.state.services.push(
    ...e.state.services
      .filter(
        (s) =>
          s.branchId === c.branchId &&
          s.active &&
          e.state.roomServices.some(
            (config) =>
              config.roomId === c.roomId &&
              config.serviceId === s.id &&
              overlaps(config.startDate, config.endDate, t.startDate, t.endDate),
          ),
      )
      .map((s) => ({
        id: s.id,
        contractTenantId: t.id,
        name: s.name,
        mandatory: s.mandatory,
        unit: s.unit,
        unitPrice: s.unitPrice,
        subscriptionId: s.mandatory ? crypto.randomUUID() : null,
        status: s.mandatory ? ('APPROVED' as const) : null,
        startDate: s.mandatory ? t.startDate : null,
        endDate: s.mandatory ? t.endDate : null,
        note: '',
        history: [],
        decisionAt: 0,
      })),
  )
  return t
}
export function leasingAction(
  e: ManagerEngine,
  actor: User,
  branchId: string,
  resource: ManagerResource,
  id: string | null,
  action: string,
  input: unknown,
): unknown {
  if (resource === 'appointments') {
    const a = e.db.state.appointments.find(
      (a) =>
        a.id === id &&
        e.inventory.state.rooms.some((r) => r.id === a.roomId && r.branchId === branchId),
    )
    if (!a) throw new MockError('Không tìm thấy lịch xem thuộc chi nhánh.', 404)
    const data = z
      .object({
        status: z.enum(['CONFIRMED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
        reason: z.string().trim().min(5).max(500),
        startAt: z.iso.datetime({ offset: true }).optional(),
        endAt: z.iso.datetime({ offset: true }).optional(),
      })
      .parse(input)
    const valid =
      (a.status === 'PENDING' && ['CONFIRMED', 'REJECTED', 'CANCELLED'].includes(data.status)) ||
      (a.status === 'CONFIRMED' && ['COMPLETED', 'CANCELLED'].includes(data.status))
    if (!valid) throw new MockError('Trạng thái lịch xem không cho phép thao tác này.', 409)
    if (data.status === 'COMPLETED' && Date.parse(a.endAt) > Date.now())
      throw new MockError('Chưa đến thời điểm hoàn tất lịch xem.', 409)
    const start = data.startAt || a.startAt,
      end = data.endAt || a.endAt
    if (data.status === 'CONFIRMED') {
      if (
        Date.parse(start) <= Date.now() ||
        Date.parse(end) <= Date.parse(start) ||
        Date.parse(end) - Date.parse(start) >
          a.policySnapshot.appointmentPolicy.maxDurationMinutes * 60000
      )
        throw new MockError('Thời gian lịch xem chưa hợp lệ.', 422)
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          hourCycle: 'h23',
          timeZone: 'Asia/Ho_Chi_Minh',
        }).format(new Date(start)),
      )
      if (
        hour < a.policySnapshot.appointmentPolicy.openingHour ||
        hour >= a.policySnapshot.appointmentPolicy.closingHour
      )
        throw new MockError('Lịch xem ngoài giờ tiếp nhận.', 422)
      const managed = new Set(e.branches(actor).map((b) => b.id))
      if (
        e.db.state.appointments.some(
          (other) =>
            other.id !== a.id &&
            ['PENDING', 'CONFIRMED'].includes(other.status) &&
            e.inventory.state.rooms.some(
              (r) => r.id === other.roomId && (r.id === a.roomId || managed.has(r.branchId)),
            ) &&
            Date.parse(start) < Date.parse(other.endAt) &&
            Date.parse(other.startAt) < Date.parse(end),
        )
      )
        throw new MockError('Trùng lịch xem tại phòng hoặc lịch làm việc của quản lý.', 409)
      a.startAt = start
      a.endAt = end
      a.assignedManager = actor.fullName
    }
    a.status = data.status
    a.timeline.push({ status: a.status, at: new Date().toISOString(), note: data.reason })
    e.db.notify(a.requesterUserId, 'Lịch xem phòng đã cập nhật', data.reason, 'APPOINTMENT', a.id)
    return a
  }
  if (resource === 'bookings') {
    const b = e.db.state.bookings.find((b) => b.id === id && b.branchId === branchId)
    if (!b) throw new MockError('Không tìm thấy giữ phòng thuộc chi nhánh.', 404)
    if (action === 'convert') {
      if (b.status === 'CONVERTED' || e.state.contracts.some((c) => c.sourceBookingId === b.id))
        throw new MockError('Giữ phòng đã được chuyển thành hợp đồng.', 409)
      if (
        b.status !== 'CONFIRMED' ||
        !b.confirmedHoldUntil ||
        Date.parse(b.confirmedHoldUntil) <= Date.now()
      )
        throw new MockError('Chỉ giữ phòng đã xác nhận và còn hạn mới được chuyển.', 409)
      if (
        !e.db.state.payments.some(
          (p) =>
            p.bookingId === b.id &&
            p.status === 'VERIFIED' &&
            p.amount >= b.holdAmount &&
            p.environment === b.paymentEnvironment,
        )
      )
        throw new MockError('Khoản giữ phòng chưa được xác minh đủ.', 409)
      const data = z
        .object({
          code: z.string().trim().min(3).max(50),
          terms: z.string().trim().min(10).max(4000),
          monthlyRent: z.number().int().positive(),
          firstMonthRent: z.number().int().nonnegative(),
          lastMonthRent: z.number().int().nonnegative(),
        })
        .parse(input)
      if (
        e.state.contracts.some(
          (c) => c.branchId === branchId && c.code.toLowerCase() === data.code.toLowerCase(),
        )
      )
        throw new MockError('Mã hợp đồng đã tồn tại.', 409)
      if (e.overlapsRoom(b.roomId, b.roomSlotId, b.startDate, b.endDate, undefined, b.id))
        throw new MockError('Tài nguyên thuê đã có nghĩa vụ chồng lấn.', 409)
      const c: ManagerContract = {
        id: crypto.randomUUID(),
        branchId,
        roomId: b.roomId,
        rentalMode: b.rentalMode,
        code: data.code,
        startDate: b.startDate,
        endDate: b.endDate,
        terms: data.terms,
        status: 'DRAFT',
        sourceBookingId: b.id,
        representativeName: null,
        tenantCount: 0,
        history: [
          e.audit(actor, 'Chuyển từ giữ phòng đã xác minh; chờ đủ trả trước để kích hoạt.'),
        ],
      }
      e.state.contracts.push(c)
      try {
        addTenancy(e, c, {
          userId: b.requesterUserId,
          roomSlotId: b.roomSlotId,
          role: 'REPRESENTATIVE',
          startDate: b.startDate,
          endDate: b.endDate,
          monthlyRent: data.monthlyRent,
          firstMonthRent: data.firstMonthRent,
          lastMonthRent: data.lastMonthRent,
          prepaidFirstRequired: data.firstMonthRent,
          prepaidLastRequired: data.lastMonthRent,
          terms: data.terms,
        })
      } catch (error) {
        e.state.contracts.pop()
        throw error
      }
      b.status = 'CONVERTED'
      b.contractId = c.id
      b.timeline.push({
        status: b.status,
        at: new Date().toISOString(),
        note: 'Đã tạo hợp đồng nháp và nghĩa vụ cá nhân; tiền giữ phòng không chuyển thành trả trước.',
      })
      e.db.notify(
        b.requesterUserId,
        'Đã tạo hồ sơ hợp đồng thuê',
        'Mở không gian thuê để xem và thanh toán nghĩa vụ trả trước.',
        'BOOKING',
        b.id,
      )
      return c
    }
    const data = z
      .object({
        decision: z.enum(['confirm', 'reject', 'cancel']),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(input)
    if (data.decision === 'confirm') {
      if (
        !['REQUESTED', 'AWAITING_PAYMENT'].includes(b.status) ||
        Date.parse(b.paymentDueAt) <= Date.now() ||
        Date.parse(b.temporaryHoldUntil) <= Date.now()
      )
        throw new MockError('Giữ phòng đã hết hạn hoặc đã xử lý.', 409)
      if (
        !e.db.state.payments.some(
          (p) =>
            p.bookingId === b.id &&
            p.status === 'VERIFIED' &&
            p.amount >= b.holdAmount &&
            p.environment === b.paymentEnvironment,
        )
      )
        throw new MockError('Không thể xác nhận trước khi xác minh đủ khoản giữ phòng.', 409)
      if (e.overlapsRoom(b.roomId, b.roomSlotId, b.startDate, b.endDate, undefined, b.id))
        throw new MockError('Tài nguyên giữ phòng đã có xung đột.', 409)
      b.status = 'CONFIRMED'
      b.confirmedHoldUntil = new Date(
        Date.now() + b.policySnapshot.confirmedHoldMinutes * 60000,
      ).toISOString()
    } else {
      if (
        !['REQUESTED', 'AWAITING_PAYMENT'].includes(b.status) ||
        e.db.state.payments.some((p) => p.bookingId === b.id && p.status === 'VERIFIED')
      )
        throw new MockError(
          'Chỉ xử lý từ chối/hủy giữ phòng chưa thu tiền; hoàn tiền cần quy trình được duyệt.',
          409,
        )
      b.status = data.decision === 'reject' ? 'REJECTED' : 'CANCELLED'
    }
    b.timeline.push({ status: b.status, at: new Date().toISOString(), note: data.reason })
    e.db.notify(b.requesterUserId, 'Giữ phòng đã cập nhật', data.reason, 'BOOKING', b.id)
    return b
  }
  if (resource === 'tenants') {
    const data = z.object({ contractId: z.string().uuid() }).parse(input),
      c = e.contract(branchId, data.contractId)
    if (action === 'representative') {
      const t = e.tenancy(branchId, id || '')
      if (t.contractId !== c.id || t.status !== 'ACTIVE' || c.status !== 'ACTIVE')
        throw new MockError('Chọn thành viên đang thuê trong hợp đồng hiệu lực.', 409)
      for (const other of e.tenant.state.tenancies.filter(
        (t) => t.contractId === c.id && t.status === 'ACTIVE',
      ))
        other.role = other.id === t.id ? 'REPRESENTATIVE' : 'MEMBER'
      c.history.push(e.audit(actor, 'Đổi người đại diện hợp đồng.'))
      return t
    }
    if (action === 'activate') {
      const t = e.tenancy(branchId, id || '')
      if (c.status !== 'ACTIVE' || t.contractId !== c.id || t.status !== 'DRAFT')
        throw new MockError('Quan hệ thuê chưa thể kích hoạt.', 409)
      prepaidReady(e, t)
      if (
        t.role === 'REPRESENTATIVE' &&
        e.tenant.state.tenancies.some(
          (p) => p.contractId === c.id && p.status === 'ACTIVE' && p.role === 'REPRESENTATIVE',
        )
      )
        throw new MockError('Hợp đồng đã có đại diện.', 409)
      t.status = 'ACTIVE'
      const user = e.user(t.userId)
      if (!user.roles.includes('TENANT')) user.roles.push('TENANT')
      c.history.push(e.audit(actor, 'Kích hoạt thành viên sau khi đủ trả trước.'))
      return t
    }
    if (c.status === 'ENDED' || c.status === 'CANCELLED')
      throw new MockError('Hợp đồng đã kết thúc, chỉ được xem hồ sơ.', 409)
    if (id) {
      const t = e.tenancy(branchId, id)
      if (t.contractId !== c.id || t.status !== 'DRAFT')
        throw new MockError('Không sửa trực tiếp nghĩa vụ đang hiệu lực.', 409)
      const updated = validateTenancy(e, c, input, id)
      if (
        e.tenant.state.payments.some(
          (p) =>
            p.contractTenantId === t.id && ['PENDING', 'REVIEW', 'VERIFIED'].includes(p.status),
        ) &&
        (
          [
            'userId',
            'roomSlotId',
            'startDate',
            'endDate',
            'monthlyRent',
            'firstMonthRent',
            'lastMonthRent',
            'prepaidFirstRequired',
            'prepaidLastRequired',
          ] as const
        ).some((key) => t[key] !== updated[key])
      )
        throw new MockError(
          'Nghĩa vụ đã có giao dịch, không đổi người chịu tiền hoặc điều khoản tài chính trực tiếp.',
          409,
        )
      Object.assign(t, updated)
      c.history.push(e.audit(actor, 'Cập nhật nghĩa vụ cá nhân chưa kích hoạt.'))
      return t
    }
    const t = addTenancy(e, c, input)
    c.history.push(e.audit(actor, 'Thêm quan hệ thuê; chưa ghi đè hồ sơ tài khoản.'))
    e.notifyTenant(t, 'Hồ sơ thuê cá nhân đã được tạo', 'TENANT_CONTRACT', c.id)
    return t
  }
  const c = id ? e.contract(branchId, id) : null
  if (!action || action === 'save') {
    const data = contractInputSchema.parse(input)
    period(data.startDate, data.endDate)
    const room = e.room(branchId, data.roomId)
    if (c && c.status !== 'DRAFT')
      throw new MockError(
        'Chỉ được sửa hợp đồng nháp; thay đổi sau kích hoạt cần phụ lục được duyệt.',
        409,
      )
    if (
      e.state.contracts.some(
        (v) =>
          v.branchId === branchId &&
          v.id !== id &&
          v.code.toLowerCase() === data.code.toLowerCase(),
      )
    )
      throw new MockError('Mã hợp đồng đã tồn tại.', 409)
    if (
      c &&
      e.tenant.state.tenancies.some(
        (t) =>
          t.contractId === c.id &&
          (t.roomId !== data.roomId || t.startDate < data.startDate || t.endDate > data.endDate),
      )
    )
      throw new MockError('Thay đổi làm mất hiệu lực các quan hệ thuê đã khai báo.', 409)
    if (c) {
      Object.assign(c, data, { rentalMode: room.rentalMode })
      c.history.push(e.audit(actor, 'Cập nhật hợp đồng nháp.'))
      for (const t of e.tenant.state.tenancies.filter((t) => t.contractId === c.id)) {
        t.code = c.code
        t.sharedTerms = c.terms
      }
      return c
    }
    const created: ManagerContract = {
      ...data,
      id: crypto.randomUUID(),
      branchId,
      rentalMode: room.rentalMode,
      status: 'DRAFT',
      sourceBookingId: null,
      representativeName: null,
      tenantCount: 0,
      history: [e.audit(actor, 'Tạo hợp đồng nháp.')],
    }
    e.state.contracts.push(created)
    return created
  }
  if (!c) throw new MockError('Không tìm thấy hợp đồng.', 404)
  const ts = e.tenant.state.tenancies.filter(
    (t) => t.contractId === c.id && ['DRAFT', 'ACTIVE'].includes(t.status),
  )
  if (action === 'activate') {
    if (
      c.status !== 'DRAFT' ||
      ts.filter((t) => t.role === 'REPRESENTATIVE').length !== 1 ||
      !ts.length
    )
      throw new MockError('Hợp đồng cần đúng một đại diện hợp lệ trước khi kích hoạt.', 409)
    for (const t of ts) {
      prepaidReady(e, t)
      if (
        e.overlapsRoom(
          t.roomId,
          t.roomSlotId,
          t.startDate,
          t.endDate,
          c.id,
          c.sourceBookingId || undefined,
        )
      )
        throw new MockError('Tài nguyên thuê có xung đột trước khi kích hoạt.', 409)
    }
    c.status = 'ACTIVE'
    for (const t of ts) {
      t.status = 'ACTIVE'
      t.contractStatus = 'ACTIVE'
      const u = e.user(t.userId)
      if (!u.roles.includes('TENANT')) u.roles.push('TENANT')
      e.notifyTenant(t, 'Hợp đồng thuê đã được kích hoạt', 'TENANT_CONTRACT', c.id)
    }
  } else if (action === 'cancel') {
    if (
      c.status !== 'DRAFT' ||
      ts.some((t) =>
        e.tenant.state.payments.some(
          (p) =>
            p.contractTenantId === t.id && ['PENDING', 'REVIEW', 'VERIFIED'].includes(p.status),
        ),
      )
    )
      throw new MockError(
        'Chỉ hủy nháp không còn giao dịch chờ xử lý hoặc đã xác minh; hoàn tiền cần quy trình chủ sở hữu.',
        409,
      )
    c.status = 'CANCELLED'
    for (const t of ts) {
      t.status = 'CANCELLED'
      t.contractStatus = 'CANCELLED'
    }
  } else if (action === 'end') {
    if (c.status !== 'ACTIVE' || c.endDate > new Date().toISOString().slice(0, 10))
      throw new MockError(
        'Chỉ kết thúc hợp đồng đã hết thời hạn; chuyển/rời phòng sớm thuộc giai đoạn sau.',
        409,
      )
    c.status = 'ENDED'
    for (const t of ts) {
      t.status = 'LEFT'
      t.contractStatus = 'ENDED'
      t.actualLeaveDate = t.actualLeaveDate || t.endDate
    }
  } else throw new MockError('Thao tác hợp đồng không được hỗ trợ.', 404)
  c.history.push(e.audit(actor, `Cập nhật trạng thái hợp đồng: ${c.status}.`))
  return c
}
