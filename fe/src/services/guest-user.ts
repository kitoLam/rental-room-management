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
          : 'UNKNOWN',
    availableSlots: null,
    imageUrl: images[0] || '',
    imageAlt: `${data.roomTypeName} ${r.code}`,
    images,
    description: r.description || '',
    amenities: r.amenities || [],
    services: [],
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
export const bookingService = {
  list: (status = '', page = 1) =>
    request(
      'leasing',
      `/api/bookings?${new URLSearchParams({ status, page: String(page - 1), size: '8' })}`,
      pageSchema(bookingSchema),
    ),
  get: (id: string) => request('leasing', `/api/bookings/${id}`, bookingSchema),
  create: (input: BookingInput) =>
    request('leasing', '/api/bookings', bookingSchema, write('POST', input)),
  cancel: (id: string) =>
    request('leasing', `/api/bookings/${id}/cancel`, bookingSchema, write('POST')),
  payments: (id: string) =>
    request('leasing', `/api/bookings/${id}/payments`, z.array(paymentSchema)),
  initiate: (id: string, scenario: PaymentScenario) =>
    request('leasing', `/api/bookings/${id}/payments`, paymentSchema, write('POST', { scenario })),
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
