import { z } from 'zod'

export const roleSchema = z.enum(['USER', 'TENANT', 'MANAGER', 'OWNER', 'ADMIN'])
export type Role = z.infer<typeof roleSchema>
// Backend Mongo ids are ObjectIds; the frontend also accepts UUID ids used by mock data.
export const databaseIdSchema = z.union([z.guid(), z.string().regex(/^[0-9a-f]{24}$/i)])
export const userSchema = z.object({
  id: databaseIdSchema,
  email: z.string().email(),
  fullName: z.string(),
  roles: z.array(roleSchema),
  phone: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  status: z.enum(['INVITED', 'PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED']),
})
export type User = z.infer<typeof userSchema>
export const sessionSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>
export const modeSchema = z.enum(['ROOM', 'SLOT'])
export type RentalMode = z.infer<typeof modeSchema>
export const utilityRatesSchema = z.object({
  electricityRate: z.number().nonnegative().nullable(),
  waterRate: z.number().nonnegative().nullable(),
  parkingRate: z.number().nonnegative().nullable(),
})
export type UtilityRates = z.infer<typeof utilityRatesSchema>
export const roomSchema = z.object({
  id: databaseIdSchema,
  code: z.string(),
  title: z.string(),
  branchId: databaseIdSchema,
  branchName: z.string(),
  address: z.string(),
  areaKey: z.string(),
  price: z.number().nonnegative(),
  sizeM2: z.number().nullable(),
  capacity: z.number(),
  availableSlots: z.number().nullable(),
  rentalMode: modeSchema,
  roomTypeId: databaseIdSchema,
  roomTypeName: z.string(),
  status: z.enum(['AVAILABLE', 'HELD', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE', 'UNKNOWN']),
  operationalStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
  imageUrl: z.string(),
  imageAlt: z.string(),
  images: z.array(z.string()),
  floor: z.number().nullable(),
  description: z.string(),
  amenities: z.array(z.string()),
  services: z.array(z.object({ name: z.string(), price: z.number(), unit: z.string() })),
  utilityRates: utilityRatesSchema.nullish(),
  ownerName: z.string().optional(),
})
export type Room = z.infer<typeof roomSchema>
export const policySchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  version: z.number(),
  effectiveFrom: z.string(),
  bookingHoldAmount: z.number(),
  paymentWindowMinutes: z.number(),
  temporaryHoldMinutes: z.number(),
  confirmedHoldMinutes: z.number(),
  cancellationTerms: z.string(),
  appointmentPolicy: z.object({
    openingHour: z.number(),
    closingHour: z.number(),
    maxDurationMinutes: z.number(),
    cancellationHours: z.number(),
  }),
})
export type BranchPolicy = z.infer<typeof policySchema>
export const branchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string(),
  description: z.string(),
  images: z.array(z.string()),
  publicPhone: z.string().nullable(),
  publicEmail: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  rules: z.array(z.string()),
})
export type Branch = z.infer<typeof branchSchema>
export const availabilitySchema = z.object({
  roomId: databaseIdSchema.optional(),
  startDate: z.string(),
  endDate: z.string(),
  available: z.boolean(),
  reason: z.string().nullable(),
  slots: z.array(z.object({ id: databaseIdSchema, label: z.string(), available: z.boolean() })),
})
export type Availability = z.infer<typeof availabilitySchema>
export const appointmentStatuses = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const
export const bookingStatuses = [
  'REQUESTED',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'CONVERTED',
  'EXPIRED',
  'CANCELLED',
  'REJECTED',
] as const
export const timelineSchema = z.array(
  z.object({ status: z.string(), at: z.string(), note: z.string() }),
)
export const appointmentSchema = z.object({
  id: z.string().uuid(),
  requesterUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  roomTitle: z.string(),
  branchName: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  note: z.string(),
  status: z.enum(appointmentStatuses),
  assignedManager: z.string().nullable(),
  policySnapshot: policySchema,
  createdAt: z.string(),
  timeline: timelineSchema,
})
export type Appointment = z.infer<typeof appointmentSchema>
export const bookingSchema = z.object({
  id: databaseIdSchema,
  requesterUserId: databaseIdSchema,
  requesterName: z.string().optional(),
  requesterEmail: z.string().optional(),
  requesterPhone: z.string().nullable().optional(),
  roomTitle: z.string(),
  branchId: databaseIdSchema,
  branchName: z.string(),
  roomSlotId: databaseIdSchema.nullable(),
  slotLabel: z.string().nullable(),
  rentalMode: modeSchema,
  startDate: z.string(),
  endDate: z.string(),
  holdAmount: z.number(),
  paymentDueAt: z.string(),
  temporaryHoldUntil: z.string(),
  checkInDeadline: z.string().nullable().optional(),
  confirmedHoldUntil: z.string().nullable(),
  status: z.enum(bookingStatuses),
  policySnapshot: policySchema,
  cancellationPolicy: z.string().nullable().optional(),
  termsAcceptedAt: z.string().nullable().optional(),
  depositStatus: z.enum(['UNPAID', 'PROCESSING', 'PAID', 'REFUNDED', 'FORFEITED']).optional(),
  paymentEnvironment: z.enum(['SANDBOX', 'PRODUCTION']),
  createdAt: z.string(),
  timeline: timelineSchema,
  contractId: databaseIdSchema.nullable(),
})
export type Booking = z.infer<typeof bookingSchema>
export const mockBookingSchema = bookingSchema.extend({ roomId: databaseIdSchema })
export type MockBooking = z.infer<typeof mockBookingSchema>
export const paymentSchema = z.object({
  id: databaseIdSchema,
  bookingId: databaseIdSchema,
  amount: z.number(),
  reference: z.string(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'REVIEW']),
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
  createdAt: z.string(),
  verifiedAt: z.string().nullable(),
  qrUrl: z.string().nullable(),
  paymentUrl: z.string().url().nullable().optional(),
  instructions: z.string(),
})
export type Payment = z.infer<typeof paymentSchema>
export const notificationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
  referenceType: z.string().nullable(),
  referenceId: z.string().uuid().nullable(),
  contractTenantId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})
export type Notification = z.infer<typeof notificationSchema>
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    content: z.array(item),
    number: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
  })
export type Page<T> = {
  content: T[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}
export type RoomFilters = {
  q: string
  area: string
  minPrice?: number
  maxPrice?: number
  minArea?: number
  maxArea?: number
  mode: 'ALL' | RentalMode
  roomTypeId: string
  minCapacity?: number
  availableOnly: boolean
  sort: string
  page: number
  branchId?: string
}
export type AppointmentInput = { roomId: string; startAt: string; endAt: string; note: string }
export type BookingInput = {
  roomId: string
  roomSlotId?: string
  rentalMode?: RentalMode
  startDate: string
  endDate: string
  policyId?: string
  policyVersion?: number
  acknowledged?: boolean
}
export type RoomSlotBookingInput = Omit<BookingInput, 'roomId' | 'rentalMode'> & {
  roomSlotId: string
}
export type PaymentScenario = 'success' | 'failure' | 'pending' | 'late'
