import { useSession } from '@/features/auth/session-store'
import { z } from 'zod'
import {
  appointmentSchema,
  availabilitySchema,
  bookingSchema,
  mockBookingSchema,
  branchSchema,
  databaseIdSchema,
  notificationSchema,
  pageSchema,
  paymentSchema,
  policySchema,
  roomSchema,
  userSchema,
  type User,
  utilityRatesSchema,
  type AppointmentInput,
  type BookingInput,
  type RoomSlotBookingInput,
  type PaymentScenario,
  type RoomFilters,
} from '@/interfaces/domain'
import { authRequest, request, write, ApiError } from './http'
import { provider } from './config'

const nullable = z.unknown()
export const authService = {
  login: async (input: { email: string; password: string }) =>
    authRequest('/api/v1/auth/login', input),
  register: (input: {
    fullName: string
    email: string
    password: string
    phone: string
    confirmPassword: string
    termsAccepted: boolean
  }) =>
    request(
      'auth',
      '/api/v1/auth/signup',
      nullable,
      write('POST', input),
      false,
    ),
  verify: (token: string) =>
    provider('auth') === 'real'
      ? request(
          'auth',
          `/api/v1/auth/verify-email?${new URLSearchParams({ token })}`,
          nullable,
          { method: 'GET' },
          false,
        )
      : request('auth', '/api/v1/auth/verify-email', nullable, write('POST', { token }), false),
  logout: () =>
    request(
      'auth',
      '/api/v1/auth/logout',
      nullable,
      write('POST'),
    ),
  changePassword: (input: { oldPassword: string; newPassword: string; confirmPassword?: string }) =>
    request(
      'auth',
      '/api/v1/auth/change-password',
      nullable,
      write('POST', input),
      true,
    ),
  forgot: (email: string) =>
    request('recovery', '/api/auth/forgot-password', nullable, write('POST', { email }), false),
  reset: (token: string, password: string) =>
    request(
      'recovery',
      '/api/auth/reset-password',
      nullable,
      write('POST', { token, password }),
      false,
    ),
  mailbox: (email: string, feature: 'auth' | 'recovery') =>
    request(
      feature,
      `/api/demo/mailbox?email=${encodeURIComponent(email)}`,
      z.object({ href: z.string(), purpose: z.string() }).nullable(),
    ),
}
const publicRoomSchema = z.object({
  utilityRates: utilityRatesSchema.nullish(),
  room: z.object({
    id: databaseIdSchema,
    branchId: databaseIdSchema,
    roomTypeId: databaseIdSchema,
    code: z.string(),
    rentalMode: z.enum(['ROOM', 'SLOT']),
    capacity: z.number(),
    areaSqm: z.number().nullable(),
    floorNumber: z.number().nullable(),
    referencePrice: z.number(),
    description: z.string().nullable(),
    amenities: z.array(z.string()).nullable(),
    imageRefs: z.unknown(),
    operationalStatus: z.string(),
  }),
  branchId: databaseIdSchema,
  branchName: z.string(),
  address: z.string(),
  roomTypeName: z.string(),
  ownerName: z.string().nullish(),
})
type RealRoom = z.infer<typeof publicRoomSchema>
function adaptRoom(data: RealRoom) {
  const r = data.room
  const refs = Array.isArray(r.imageRefs) ? r.imageRefs : []
  const images = refs.flatMap((value: unknown) =>
    typeof value === 'string' && /^https?:\/\//.test(value) ? [value] : [],
  )
  return roomSchema.parse({
    id: r.id,
    code: r.code,
    title: `${data.roomTypeName} ${r.code}`,
    branchId: data.branchId,
    branchName: data.branchName,
    address: data.address,
    areaKey: '',
    price: r.referencePrice,
    capacity: r.capacity,
    sizeM2: r.areaSqm,
    floor: r.floorNumber,
    rentalMode: r.rentalMode,
    roomTypeId: r.roomTypeId,
    roomTypeName: data.roomTypeName,
    operationalStatus:
      r.operationalStatus === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : r.operationalStatus === 'INACTIVE'
          ? 'INACTIVE'
          : 'ACTIVE',
    status:
      r.operationalStatus === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : r.operationalStatus === 'INACTIVE'
          ? 'INACTIVE'
          : 'AVAILABLE',
    availableSlots: null,
    imageUrl: images[0] || '',
    imageAlt: `${data.roomTypeName} ${r.code}`,
    images,
    description: r.description || '',
    amenities: r.amenities || [],
    services: [],
    utilityRates: data.utilityRates,
    ownerName: data.ownerName || undefined,
  })
}
export const defaultFilters: RoomFilters = {
  q: '',
  area: '',
  mode: 'ALL',
  roomTypeId: '',
  availableOnly: false,
  sort: 'recommended',
  page: 1,
}
function query(filters: RoomFilters) {
  const params = new URLSearchParams({ page: String(filters.page - 1), size: '6' })
  if (filters.q) {
    params.set('q', filters.q)
    params.set('keyword', filters.q)
    params.set('address', filters.q)
  }
  if (filters.branchId) params.set('branchId', filters.branchId)
  if (filters.roomTypeId) params.set('roomTypeId', filters.roomTypeId)
  for (const key of ['minPrice', 'maxPrice', 'minArea', 'maxArea', 'minCapacity'] as const)
    if (filters[key] !== undefined) params.set(key, String(filters[key]))
  if (provider('catalog') === 'mock') {
    params.set('rentalMode', filters.mode)
    params.set('availableOnly', String(filters.availableOnly))
    params.set('area', filters.area)
    params.set('sort', filters.sort)
  } else {
    if (filters.mode === 'ROOM') params.set('roomMode', 'WHOLE_ROOM')
    if (filters.mode === 'SLOT') params.set('roomMode', 'PER_SLOT')
    if (filters.area && !filters.q) params.set('address', filters.area)
    const sorts: Record<string, string> = {
      recommended: 'roomNumber,asc',
      'price-asc': 'referencePrice,asc',
      'price-desc': 'referencePrice,desc',
      'area-desc': 'area,desc',
      'area-asc': 'area,asc',
      newest: 'newest,desc',
    }
    params.set('sort', sorts[filters.sort] || sorts.recommended)
  }
  return params.toString()
}
export const catalogService = {
  rooms: async (filters: RoomFilters) => {
    const path = `/api/v1/public/rooms?${query(filters)}`
    if (provider('catalog') === 'mock') return request('catalog', path, pageSchema(roomSchema))
    const page = await request('catalog', path, pageSchema(publicRoomSchema))
    return { ...page, content: page.content.map(adaptRoom) }
  },
  room: async (id: string) =>
    provider('catalog') === 'mock'
      ? request('catalog', `/api/v1/public/rooms/${id}`, roomSchema)
      : adaptRoom(await request('catalog', `/api/v1/public/rooms/${id}`, publicRoomSchema)),
  types: () =>
    request(
      'catalog',
      '/api/v1/public/room-types',
      z.array(z.object({ id: databaseIdSchema, name: z.string() })),
    ),
  branches: () =>
    request(
      'catalog',
      '/api/v1/public/branches',
      z.array(z.object({ id: databaseIdSchema, name: z.string(), address: z.string().optional() })),
    ),
  availability: (id: string, startDate: string, endDate: string) =>
    request(
      'catalog',
      `/api/v1/public/rooms/${id}/availability?${new URLSearchParams({ startDate, endDate })}`,
      availabilitySchema,
    ),
  branch: (id: string) => request('catalog', `/api/v1/public/branches/${id}`, branchSchema),
  policy: (id: string) => request('catalog', `/api/v1/public/branches/${id}/policy`, policySchema),
}
export const roomSlotService = {
  list: (roomId: string) =>
    request(
      'leasing',
      `/api/v1/room-slots?${new URLSearchParams({ roomId, page: '0', size: '100' })}`,
      pageSchema(backendRoomSlotSchema),
    ),
}
export const appointmentService = {
  list: (status = '', page = 1) =>
    request(
      'leasing',
      `/api/appointments?${new URLSearchParams({ status, page: String(page - 1), size: '8' })}`,
      pageSchema(appointmentSchema),
    ),
  get: (id: string) => request('leasing', `/api/appointments/${id}`, appointmentSchema),
  create: (input: AppointmentInput) =>
    request('leasing', '/api/appointments', appointmentSchema, write('POST', input)),
  cancel: (id: string) =>
    request('leasing', `/api/appointments/${id}/cancel`, appointmentSchema, write('POST')),
  demoResponse: (id: string, status: 'CONFIRMED' | 'REJECTED') =>
    request(
      'leasing',
      `/api/appointments/${id}/demo-response`,
      appointmentSchema,
      write('POST', { status }),
    ),
}
const backendBookingSchema = z.object({
  id: databaseIdSchema,
  tenantId: databaseIdSchema,
  roomSlotId: databaseIdSchema,
  slotCode: z.string(),
  expectedMoveInDate: z.string().nullable(),
  expectedMoveOutDate: z.string().nullable(),
  holdingDepositAmount: z.number().nullable(),
  paymentDeadline: z.string().nullable(),
  holdExpiresAt: z.string().nullable(),
  checkInDeadline: z.string().nullable().optional(),
  contractId: databaseIdSchema.nullable().optional(),
  cancellationPolicy: z.string().nullable(),
  depositStatus: z.enum(['UNPAID', 'PROCESSING', 'PAID', 'REFUNDED', 'FORFEITED']),
  rejectReason: z.string().nullable(),
  status: z.enum(['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'CONVERTED', 'EXPIRED', 'CANCELLED', 'REJECTED', 'PENDING', 'APPROVED']),
  termsAcceptedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  requesterUserId: databaseIdSchema,
  requesterName: z.string().nullable(),
  requesterEmail: z.string().nullable(),
  requesterPhone: z.string().nullable(),
  roomTitle: z.string().nullable(),
  branchId: databaseIdSchema,
  branchName: z.string().nullable(),
  timeline: z.array(z.object({ status: z.string(), at: z.string(), note: z.string() })),
})
const backendSlotAvailabilitySchema = z.object({
  roomSlotId: databaseIdSchema,
  slotCode: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  available: z.boolean(),
  reason: z.string().nullable(),
})
const backendRoomSlotSchema = z.object({
  id: databaseIdSchema,
  roomId: databaseIdSchema,
  slotCode: z.string(),
  slotNumber: z.number().nullable(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})
const backendPaymentSchema = z.object({
  id: databaseIdSchema,
  bookingId: databaseIdSchema,
  amount: z.number(),
  transactionCode: z.string(),
  method: z.string(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']),
  createdAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  paymentUrl: z.string().nullable(),
})
const backendContractSchema = z.object({
  id: databaseIdSchema,
  roomId: databaseIdSchema,
  roomSlotId: databaseIdSchema,
  bookingId: databaseIdSchema,
  tenantId: databaseIdSchema,
  managerId: databaseIdSchema,
  contractNumber: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  rentPrice: z.number(),
  contractDepositAmount: z.number(),
  landlordName: z.string().nullable().optional(),
  landlordIdNumber: z.string().nullable().optional(),
  landlordAddress: z.string().nullable().optional(),
  tenantName: z.string().nullable().optional(),
  tenantIdNumber: z.string().nullable().optional(),
  tenantAddress: z.string().nullable().optional(),
  roomAddress: z.string().nullable().optional(),
  roomMode: z.string().nullable().optional(),
  electricityInitialReading: z.number().nullable().optional(),
  waterInitialReading: z.number().nullable().optional(),
  electricityRate: z.number().nullable().optional(),
  waterRate: z.number().nullable().optional(),
  parkingRate: z.number().nullable().optional(),
  maxOccupants: z.number().nullable().optional(),
  paymentDueDay: z.number().nullable(),
  terms: z.string().nullable(),
  signedFileUrl: z.string().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
  services: z.array(z.object({
    serviceId: z.string(), name: z.string(), unit: z.string(), unitPrice: z.number(),
    calculationType: z.string(), mandatory: z.boolean(), selected: z.boolean(),
  })).default([]),
}).passthrough()
const toBackendBookingStatus = (status: string) => status
function adaptBooking(b: z.infer<typeof backendBookingSchema>) {
  const status = b.status === 'PENDING' ? 'REQUESTED' : b.status === 'APPROVED' ? 'CONFIRMED' : b.status
  const createdAt = b.createdAt || new Date(0).toISOString()
  return bookingSchema.parse({
    id: b.id,
    requesterUserId: b.requesterUserId,
    requesterName: b.requesterName || undefined,
    requesterEmail: b.requesterEmail || undefined,
    requesterPhone: b.requesterPhone,
    roomTitle: b.roomTitle || 'Phòng thuê',
    branchId: b.branchId,
    branchName: b.branchName || '',
    roomSlotId: b.roomSlotId,
    slotLabel: b.slotCode,
    rentalMode: 'SLOT',
    startDate: b.expectedMoveInDate || createdAt.slice(0, 10),
    endDate: b.expectedMoveOutDate || b.expectedMoveInDate || createdAt.slice(0, 10),
    holdAmount: b.holdingDepositAmount || 0,
    paymentDueAt: b.paymentDeadline || '',
    temporaryHoldUntil: b.holdExpiresAt || '',
    checkInDeadline: b.checkInDeadline || null,
    confirmedHoldUntil: status === 'CONFIRMED' ? b.holdExpiresAt : null,
    status,
    policySnapshot: {
      id: '00000000-0000-4000-8000-000000000000',
      branchId: '00000000-0000-4000-8000-000000000000',
      version: 1,
      effectiveFrom: createdAt.slice(0, 10),
      bookingHoldAmount: b.holdingDepositAmount || 0,
      paymentWindowMinutes: 0,
      temporaryHoldMinutes: 0,
      confirmedHoldMinutes: 0,
      cancellationTerms: b.cancellationPolicy || '',
      appointmentPolicy: { openingHour: 0, closingHour: 0, maxDurationMinutes: 0, cancellationHours: 0 },
    },
    cancellationPolicy: b.cancellationPolicy,
    termsAcceptedAt: b.termsAcceptedAt,
    depositStatus: b.depositStatus,
    paymentEnvironment: 'PRODUCTION',
    createdAt,
    timeline: b.timeline,
    contractId: b.contractId || null,
  })
}
function adaptPayment(p: z.infer<typeof backendPaymentSchema>) {
  return paymentSchema.parse({
    id: p.id,
    bookingId: p.bookingId,
    amount: p.amount,
    reference: p.transactionCode,
    status: p.status === 'SUCCESS' ? 'VERIFIED' : p.status === 'REFUNDED' ? 'REVIEW' : p.status,
    environment: 'PRODUCTION',
    createdAt: p.createdAt || new Date(0).toISOString(),
    verifiedAt: p.paidAt,
    qrUrl: null,
    paymentUrl: p.paymentUrl,
    instructions: p.method === 'BANK_TRANSFER' ? 'Chuyển khoản và gửi mã tham chiếu cho Owner để đối soát.' : '',
  })
}
export const bookingService = {
  list: async (status = '', page = 1) => {
    if (provider('leasing') === 'real') {
      const query = new URLSearchParams({ page: String(page), size: '8' })
      if (status) query.set('status', toBackendBookingStatus(status))
      const result = await request('leasing', `/api/v1/bookings?${query}`, pageSchema(backendBookingSchema))
      return { ...result, content: result.content.map(adaptBooking) }
    }
    return request(
      'leasing',
      `/api/bookings?${new URLSearchParams({ status, page: String(page - 1), size: '8' })}`,
      pageSchema(mockBookingSchema),
    )
  },
  get: async (id: string) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', `/api/v1/bookings/${id}`, backendBookingSchema))
    : request('leasing', `/api/bookings/${id}`, mockBookingSchema),
  create: async (input: BookingInput | RoomSlotBookingInput) => {
    if (provider('leasing') === 'real') {
      if (!input.roomSlotId) throw new ApiError('Chọn một slot trước khi gửi yêu cầu.', 400)
      return adaptBooking(await request('leasing', '/api/v1/bookings', backendBookingSchema, write('POST', {
        roomSlotId: input.roomSlotId,
        expectedMoveInDate: input.startDate,
        expectedMoveOutDate: input.endDate,
      })))
    }
    if (!('roomId' in input)) throw new ApiError('Thiếu roomId cho dữ liệu mô phỏng.', 400)
    return request('leasing', '/api/bookings', mockBookingSchema, write('POST', input))
  },
  cancel: async (id: string) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', `/api/v1/bookings/${id}/cancel`, backendBookingSchema, write('POST')))
    : request('leasing', `/api/bookings/${id}/cancel`, mockBookingSchema, write('POST')),
  acceptTerms: async (id: string, accepted: boolean) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', `/api/v1/bookings/${id}/terms`, backendBookingSchema, write('POST', { accepted })))
    : request('leasing', `/api/bookings/${id}/terms`, mockBookingSchema, write('POST', { accepted })),
  availability: async (id: string, startDate: string, endDate: string) => {
    if (provider('leasing') !== 'real') return catalogService.availability(id, startDate, endDate)
    const result = await request('leasing', `/api/v1/bookings/availability?${new URLSearchParams({ roomSlotId: id, startDate, endDate })}`, backendSlotAvailabilitySchema)
    return {
      startDate: result.startDate,
      endDate: result.endDate,
      available: result.available,
      reason: result.reason,
      slots: [{ id: result.roomSlotId, label: result.slotCode, available: result.available }],
    }
  },
  availabilityForRoom: async (roomId: string, startDate: string, endDate: string) => {
    if (provider('leasing') !== 'real') return catalogService.availability(roomId, startDate, endDate)
    const slots = await roomSlotService.list(roomId)
    const params = new URLSearchParams({ startDate, endDate })
    slots.content.forEach((slot) => params.append('roomSlotIds', slot.id))
    const checked = slots.content.length
      ? await request('leasing', `/api/v1/bookings/availability/batch?${params}`, z.array(backendSlotAvailabilitySchema))
      : []
    const slotAvailability = checked.map((slot) => ({ id: slot.roomSlotId, label: slot.slotCode, available: slot.available }))
    const available = slotAvailability.some((slot) => slot.available)
    return {
      roomId,
      startDate,
      endDate,
      available,
      reason: available ? null : slotAvailability.length ? 'Không có slot trống trong khoảng ngày đã chọn.' : 'Phòng chưa có slot được cấu hình.',
      slots: slotAvailability,
    }
  },
  payments: async (id: string) => {
    if (provider('leasing') !== 'real')
      return request('leasing', `/api/bookings/${id}/payments`, z.array(paymentSchema))
    const result = await request('leasing', `/api/v1/bookings/${id}/payments`, z.array(backendPaymentSchema))
    return result.map(adaptPayment)
  },
  initiate: async (id: string, scenario: PaymentScenario) => {
    if (provider('leasing') !== 'real')
      return request('leasing', `/api/bookings/${id}/payments`, paymentSchema, write('POST', { scenario }))
    const payment = adaptPayment(await request('leasing', `/api/v1/bookings/${id}/payments`, backendPaymentSchema,
      write('POST', { method: 'VNPAY' })))
    if (!payment.paymentUrl) throw new ApiError('Máy chủ chưa cung cấp liên kết thanh toán VNPAY.', 502)
    return payment
  },
  review: async (id: string, value: unknown) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}/review`, backendBookingSchema, write('POST', value))),
  managerList: async (status = '', page = 1, filters: Record<string, string> = {}) => {
    const query = new URLSearchParams({ page: String(page), size: '8' })
    if (status) query.set('status', toBackendBookingStatus(status))
    for (const key of ['roomId', 'from', 'to', 'q']) {
      if (filters[key]) query.set(key, filters[key])
    }
    const result = await request('manager', `/api/v1/bookings?${query}`, pageSchema(backendBookingSchema))
    return { ...result, content: result.content.map(adaptBooking) }
  },
  managerGet: async (id: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}`, backendBookingSchema)),
  managerCancel: async (id: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}/cancel`, backendBookingSchema, write('POST'))),
  reconcile: async (id: string, paymentId: string, successful: boolean, reason: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}/payments/${paymentId}/reconcile`, backendBookingSchema,
      write('POST', { successful, reason }))),
  approveRefund: async (id: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}/refund/approve`, backendBookingSchema, write('POST'))),
}
export const contractService = {
  createDraftFromBooking: (bookingId: string, value: unknown) =>
    request('manager', `/api/v1/contracts/from-booking/${bookingId}`, backendContractSchema, write('POST', value)),
  get: (id: string) => request('leasing', `/api/v1/contracts/${id}`, backendContractSchema),
  selectServices: (id: string, selectedServiceIds: string[]) =>
    request('leasing', `/api/v1/contracts/${id}/services`, backendContractSchema, write('PATCH', { selectedServiceIds })),
  completeCheckIn: (id: string, signedFileUrl: string) =>
    request('manager', `/api/v1/contracts/${id}/check-in`, backendContractSchema, write('POST', { signedFileUrl })),
}
export const profileService = {
  get: async (): Promise<User> => {
    if (provider('auth') === 'real' || provider('profile') === 'real') {
      try {
        return await request('auth', '/api/v1/auth/me', userSchema)
      } catch {
        const currentUser = useSession.getState().user
        if (currentUser) return currentUser
        throw new ApiError('Không thể tải thông tin hồ sơ.', 500)
      }
    }
    return request('profile', '/api/me', userSchema)
  },
  update: async (value: unknown): Promise<User> => {
    if (provider('auth') === 'real' || provider('profile') === 'real') {
      const updated = await request('auth', '/api/v1/auth/me', userSchema, write('PATCH', value))
      useSession.getState().updateUser(updated)
      return updated
    }
    const updated = await request('profile', '/api/me', userSchema, write('PATCH', value))
    useSession.getState().updateUser(updated)
    return updated
  },
}
export const notificationService = {
  list: (read = '', page = 1, type = '') =>
    request(
      'notifications',
      `/api/notifications?${new URLSearchParams({ ...(read ? { read } : {}), ...(type && provider('notifications') === 'mock' ? { type } : {}), page: String(page - 1), size: '10' })}`,
      pageSchema(notificationSchema),
    ),
  unread: async () => {
    if (provider('notifications') === 'mock')
      return request(
        'notifications',
        '/api/notifications/unread-count',
        z.object({ count: z.number() }),
      )
    const data = await request(
      'notifications',
      '/api/notifications/unread-count',
      z.object({ unreadCount: z.number() }),
    )
    return { count: data.unreadCount }
  },
  read: (ids: string[]) =>
    request(
      'notifications',
      '/api/notifications/mark-read',
      z.array(notificationSchema),
      write('PUT', { notificationIds: ids }),
    ),
  readAll: () =>
    request('notifications', '/api/notifications/mark-all-read', nullable, write('PUT')),
}
