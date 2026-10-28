import { z } from 'zod'
import {
  appointmentSchema,
  availabilitySchema,
  bookingSchema,
  branchSchema,
  databaseIdSchema,
  notificationSchema,
  pageSchema,
  paymentSchema,
  policySchema,
  roomSchema,
  userSchema,
  utilityRatesSchema,
  type AppointmentInput,
  type BookingInput,
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
  if (filters.q) params.set('address', filters.q)
  if (filters.branchId) params.set('branchId', filters.branchId)
  if (filters.roomTypeId) params.set('roomTypeId', filters.roomTypeId)
  for (const key of ['minPrice', 'maxPrice', 'minCapacity'] as const)
    if (filters[key] !== undefined) params.set(key, String(filters[key]))
  if (provider('catalog') === 'mock') {
    params.set('rentalMode', filters.mode)
    params.set('availableOnly', String(filters.availableOnly))
    params.set('area', filters.area)
    params.set('sort', filters.sort)
  } else {
    if (filters.mode !== 'ALL' || filters.availableOnly || filters.area)
      throw new ApiError(
        'Bộ lọc này chưa khả dụng. Vui lòng tìm theo địa chỉ, giá hoặc sức chứa.',
        422,
      )
    const sorts: Record<string, string> = {
      recommended: 'code,asc',
      'price-asc': 'referencePrice,asc',
      'price-desc': 'referencePrice,desc',
    }
    if (filters.sort === 'area-desc')
      throw new ApiError('API phòng hiện chưa hỗ trợ sắp xếp theo diện tích.', 422)
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
      z.array(z.object({ id: z.string().uuid(), name: z.string() })),
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
  roomId: databaseIdSchema,
  expectedMoveInDate: z.string().nullable(),
  expectedMoveOutDate: z.string().nullable(),
  holdingDepositAmount: z.number().nullable(),
  paymentDeadline: z.string().nullable(),
  holdExpiresAt: z.string().nullable(),
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
  branchId: databaseIdSchema.nullable(),
  branchName: z.string().nullable(),
  timeline: z.array(z.object({ status: z.string(), at: z.string(), note: z.string() })),
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
    roomId: b.roomId,
    roomTitle: b.roomTitle || 'Phòng thuê',
    branchId: b.branchId || b.roomId,
    branchName: b.branchName || '',
    roomSlotId: null,
    slotLabel: null,
    rentalMode: 'ROOM',
    startDate: b.expectedMoveInDate || createdAt.slice(0, 10),
    endDate: b.expectedMoveOutDate || b.expectedMoveInDate || createdAt.slice(0, 10),
    holdAmount: b.holdingDepositAmount || 0,
    paymentDueAt: b.paymentDeadline || '',
    temporaryHoldUntil: b.holdExpiresAt || '',
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
    contractId: null,
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
      pageSchema(bookingSchema),
    )
  },
  get: async (id: string) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', `/api/v1/bookings/${id}`, backendBookingSchema))
    : request('leasing', `/api/bookings/${id}`, bookingSchema),
  create: async (input: BookingInput) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', '/api/v1/bookings', backendBookingSchema, write('POST', {
        roomId: input.roomId,
        expectedMoveInDate: input.startDate,
        expectedMoveOutDate: input.endDate,
      })))
    : request('leasing', '/api/bookings', bookingSchema, write('POST', input)),
  cancel: async (id: string) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', `/api/v1/bookings/${id}/cancel`, backendBookingSchema, write('POST')))
    : request('leasing', `/api/bookings/${id}/cancel`, bookingSchema, write('POST')),
  acceptTerms: async (id: string, accepted: boolean) => provider('leasing') === 'real'
    ? adaptBooking(await request('leasing', `/api/v1/bookings/${id}/terms`, backendBookingSchema, write('POST', { accepted })))
    : request('leasing', `/api/bookings/${id}/terms`, bookingSchema, write('POST', { accepted })),
  availability: (id: string, startDate: string, endDate: string) =>
    provider('leasing') === 'real'
      ? request('leasing', `/api/v1/bookings/availability?${new URLSearchParams({ roomId: id, startDate, endDate })}`, availabilitySchema)
      : catalogService.availability(id, startDate, endDate),
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
  managerList: async (status = '', page = 1) => {
    const query = new URLSearchParams({ page: String(page), size: '8' })
    if (status) query.set('status', toBackendBookingStatus(status))
    const result = await request('manager', `/api/v1/bookings?${query}`, pageSchema(backendBookingSchema))
    return { ...result, content: result.content.map(adaptBooking) }
  },
  managerGet: async (id: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}`, backendBookingSchema)),
  reconcile: async (id: string, paymentId: string, successful: boolean, reason: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}/payments/${paymentId}/reconcile`, backendBookingSchema,
      write('POST', { successful, reason }))),
  approveRefund: async (id: string) =>
    adaptBooking(await request('manager', `/api/v1/bookings/${id}/refund/approve`, backendBookingSchema, write('POST'))),
}
export const profileService = {
  get: () => request('profile', '/api/me', userSchema),
  update: (value: unknown) => request('profile', '/api/me', userSchema, write('PATCH', value)),
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
