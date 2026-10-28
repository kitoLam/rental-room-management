import { z } from 'zod'
import { provider } from './config'
import { ApiError, request } from './http'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/)
export const viewingShiftTypes = ['MORNING', 'AFTERNOON', 'EVENING'] as const
const shiftType = z.enum(viewingShiftTypes)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null)
const cancellationCause = z.enum([
  'TENANT_REQUEST',
  'LANDLORD_UNAVAILABLE',
  'OFFICIAL_BOOKING',
  'ROOM_UNAVAILABLE',
])

export const viewingContextSchema = z.object({
  // Account IDs come from Security and may differ from MongoDB Tenant document IDs.
  accountId: z.string().min(1),
  tenantProfileId: nullableText,
  fullName: nullableText,
  phone: nullableText,
  roles: z.array(z.enum(['TENANT', 'OWNER', 'MANAGER', 'ADMIN'])),
  canRequest: z.boolean(),
  manageableBranchIds: z.array(objectId),
})

export const viewingEligibilitySchema = z.object({
  roomId: objectId,
  branchId: objectId,
  roomNumber: z.string(),
  branchName: z.string(),
  publicContactPhone: nullableText,
  rentalMode: z.enum(['ROOM', 'SLOT']),
  canReceiveRequest: z.boolean(),
  reason: z.enum([
    'AVAILABLE',
    'BRANCH_INACTIVE',
    'ROOM_UNAVAILABLE',
    'TEMPORARY_HOLD',
    'OFFICIAL_HOLD',
    'NO_VACANCY',
  ]),
})

export type ViewingContext = z.infer<typeof viewingContextSchema>
export type ViewingEligibility = z.infer<typeof viewingEligibilitySchema>

const periodSchema = z.object({
  id: objectId,
  type: shiftType,
  startTime: time,
  endTime: time,
  isActive: z.boolean(),
})
export const viewingConfigurationSchema = z.object({
  roomId: objectId,
  branchId: objectId,
  roomNumber: z.string(),
  branchName: z.string(),
  version: z.number().int().nonnegative(),
  periods: z.array(periodSchema).length(3),
  existingAppointments: z.array(
    z.object({
      id: z.string(),
      date: z.iso.date(),
      type: shiftType.nullish(),
      startAt: z.iso.datetime().nullish(),
      endAt: z.iso.datetime().nullish(),
      status: z.enum(['PENDING', 'CONFIRMED']),
    }),
  ),
})
export const viewingConfigurationInputSchema = z
  .object({
    version: z.number().int().nonnegative(),
    periods: z.array(periodSchema.omit({ id: true }).strict()).length(3),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.periods.map((p) => p.type)).size !== 3)
      ctx.addIssue({ code: 'custom', message: 'Cần đủ ba loại ca sáng, chiều, tối.' })
    const ordered = [...value.periods].sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (const period of ordered)
      if (period.startTime >= period.endTime)
        ctx.addIssue({
          code: 'custom',
          message: 'Giờ bắt đầu phải trước giờ kết thúc, ca không xuyên ngày.',
        })
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i].startTime < ordered[i - 1].endTime)
        ctx.addIssue({ code: 'custom', message: 'Các ca không được chồng giờ, kể cả ca đang tắt.' })
  })
export const viewingAvailabilitySchema = z.object({
  roomId: objectId,
  date: z.iso.date(),
  timeZone: z.literal('Asia/Ho_Chi_Minh'),
  checkedAt: z.iso.datetime(),
  configurationVersion: z.number().int().nonnegative(),
  room: viewingEligibilitySchema,
  periods: z
    .array(
      periodSchema.extend({
        startAt: z.iso.datetime(),
        endAt: z.iso.datetime(),
        available: z.boolean(),
        reason: z.enum([
          'AVAILABLE',
          'ROOM_UNAVAILABLE',
          'DISABLED',
          'STARTED',
          'ROOM_TAKEN',
          'TENANT_ROOM_DAY',
          'TENANT_SAME_TYPE',
          'TENANT_TIME_OVERLAP',
        ]),
      }),
    )
    .length(3),
})
export type ViewingConfiguration = z.infer<typeof viewingConfigurationSchema>
export type ViewingConfigurationInput = z.infer<typeof viewingConfigurationInputSchema>
export type ViewingAvailability = z.infer<typeof viewingAvailabilitySchema>

export const viewingAppointmentStatuses = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'COMPLETED',
  'NO_SHOW',
] as const
const appointmentStatus = z.enum(viewingAppointmentStatuses)
export const viewingAppointmentInputSchema = z
  .object({
    roomId: objectId,
    shiftId: objectId,
    appointmentDate: z.iso.date(),
    configurationVersion: z.number().int().nonnegative(),
    contactName: z.string().trim().min(2, 'Nhập họ tên từ 2 ký tự.').max(120),
    contactPhone: z
      .string()
      .max(32)
      .refine(
        (value) => /^\+?[0-9]{9,15}$/.test(value.replace(/[\s().-]/g, '')),
        'Nhập số điện thoại hợp lệ từ 9 đến 15 chữ số.',
      ),
  })
  .strict()
export const viewingAppointmentSchema = z.object({
  id: objectId,
  requesterAccountId: nullableText,
  branchId: objectId.nullish(),
  roomId: objectId,
  shiftId: objectId,
  shiftType: shiftType.nullish(),
  appointmentDate: z.iso.date(),
  startAt: z.iso.datetime().nullish(),
  endAt: z.iso.datetime().nullish(),
  expiresAt: z.iso.datetime().nullish(),
  roomNumber: nullableText,
  branchName: nullableText,
  publicContactPhone: nullableText,
  contactName: nullableText,
  contactPhone: nullableText,
  rejectReason: nullableText,
  result: nullableText,
  actionVersion: z.number().int().nonnegative(),
  approvedByName: nullableText,
  approvedAt: z.iso.datetime().nullish(),
  cancellationReason: nullableText,
  cancellationCause: cancellationCause.nullish(),
  allowedActions: z.array(
    z.enum(['APPROVE', 'REJECT', 'CANCEL', 'COMPLETE', 'NO_SHOW', 'CORRECT_RESULT']),
  ),
  status: appointmentStatus,
  createdAt: z.iso.datetime().nullish(),
  updatedAt: z.iso.datetime().nullish(),
  history: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      actorName: nullableText,
      at: z.iso.datetime(),
      before: appointmentStatus.nullish(),
      status: appointmentStatus,
      reason: nullableText,
      previousNote: nullableText,
      note: nullableText,
      cancellationCause: cancellationCause.nullish(),
      relatedBookingIds: z.array(z.string()).nullish(),
      sourceRevision: nullableText,
    }),
  ),
})
export const viewingAppointmentPageSchema = z.object({
  content: z.array(viewingAppointmentSchema),
  number: z.number().int().min(1),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
})
export type ViewingAppointmentInput = z.infer<typeof viewingAppointmentInputSchema>
export type ViewingAppointment = z.infer<typeof viewingAppointmentSchema>
const viewingNotificationSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  appointmentId: objectId,
  kind: z.string(),
  title: z.string(),
  message: z.string(),
  detailPath: z.string().regex(/^\/(user|manager)\/appointments\/[0-9a-fA-F]{24}$/),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullish(),
})
const viewingNotificationPageSchema = viewingAppointmentPageSchema.extend({
  content: z.array(viewingNotificationSchema),
})
export type ViewingNotification = z.infer<typeof viewingNotificationSchema>
export type ViewingAction = ViewingAppointment['allowedActions'][number]
const actionVersion = { version: z.number().int().nonnegative() }
const actionNote = z.string().trim().max(500).optional()
const actionReason = z.string().trim().min(1, 'Nhập lý do.').max(500)
const appointmentActionSchemas = {
  APPROVE: z.object(actionVersion).strict(),
  REJECT: z.object({ ...actionVersion, reason: actionReason }).strict(),
  CANCEL: z
    .object({
      ...actionVersion,
      reason: actionNote,
      cause: z.enum(['TENANT_REQUEST', 'LANDLORD_UNAVAILABLE']).optional(),
      tenantRequestConfirmed: z.literal(true).optional(),
      viewingDidNotOccur: z.literal(true).optional(),
    })
    .strict(),
  COMPLETE: z
    .object({ ...actionVersion, note: actionNote, viewingFinished: z.literal(true) })
    .strict(),
  NO_SHOW: z
    .object({
      ...actionVersion,
      note: actionNote,
      tenantAbsent: z.literal(true),
      landlordAvailable: z.literal(true),
    })
    .strict(),
  CORRECT_RESULT: z
    .object({
      ...actionVersion,
      outcome: z.enum(['COMPLETED', 'NO_SHOW']),
      note: actionNote,
      reason: actionReason,
      viewingFinished: z.literal(true).optional(),
      tenantAbsent: z.literal(true).optional(),
      landlordAvailable: z.literal(true).optional(),
    })
    .strict(),
}
const actionPaths: Record<ViewingAction, string> = {
  APPROVE: 'approval',
  REJECT: 'rejection',
  CANCEL: 'cancellation',
  COMPLETE: 'completion',
  NO_SHOW: 'no-show',
  CORRECT_RESULT: 'result-corrections',
}

const roomVersionSchema = z
  .object({ roomId: objectId, version: z.number().int().nonnegative() })
  .strict()
const bulkHoursFields = { type: shiftType, startTime: time, endTime: time }
export const viewingBulkHoursSchema = z
  .object(bulkHoursFields)
  .strict()
  .refine((value) => value.startTime < value.endTime, {
    message: 'Giờ bắt đầu phải trước giờ kết thúc, ca không xuyên ngày.',
  })
export const viewingBulkInputSchema = z
  .object({
    ...bulkHoursFields,
    rooms: z.array(roomVersionSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startTime >= value.endTime)
      ctx.addIssue({
        code: 'custom',
        message: 'Giờ bắt đầu phải trước giờ kết thúc, ca không xuyên ngày.',
      })
    if (new Set(value.rooms.map((room) => room.roomId.toLowerCase())).size !== value.rooms.length)
      ctx.addIssue({ code: 'custom', message: 'Danh sách phòng không được trùng ID.' })
  })
const branchRoomSchema = z.object({
  roomId: objectId,
  roomNumber: z.string(),
  branchName: z.string(),
  version: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform((value) => value ?? null),
  periods: z.array(periodSchema),
  errorCode: nullableText,
  message: nullableText,
})
export const viewingBranchPageSchema = z.object({
  content: z.array(branchRoomSchema),
  number: z.number().int().min(1),
  size: z.number().int().min(1).max(100),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
})
export const viewingBulkResultSchema = z
  .object({
    branchId: objectId,
    updated: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    results: z.array(
      z.object({
        roomId: objectId,
        roomNumber: nullableText,
        status: z.enum(['UPDATED', 'UNCHANGED', 'FAILED']),
        version: z
          .number()
          .int()
          .nonnegative()
          .nullish()
          .transform((value) => value ?? null),
        code: nullableText,
        message: nullableText,
        affectedAppointments: viewingConfigurationSchema.shape.existingAppointments,
      }),
    ),
  })
  .superRefine((value, ctx) => {
    for (const [count, status] of [
      ['updated', 'UPDATED'],
      ['unchanged', 'UNCHANGED'],
      ['failed', 'FAILED'],
    ] as const)
      if (value[count] !== value.results.filter((row) => row.status === status).length)
        ctx.addIssue({ code: 'custom', message: 'Số lượng kết quả không khớp dữ liệu phòng.' })
  })
export type ViewingBranchPage = z.infer<typeof viewingBranchPageSchema>
export type ViewingBulkInput = z.infer<typeof viewingBulkInputSchema>
export type ViewingBulkHours = z.infer<typeof viewingBulkHoursSchema>
export type ViewingBulkResult = z.infer<typeof viewingBulkResultSchema>

async function read<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  if (provider('viewing') !== 'real') {
    throw new ApiError('Chức năng lịch xem chưa được kết nối với máy chủ.', 501)
  }
  return request('viewing', path, schema, init)
}

/** Does not alter the global auth session or fall back to FE mock data. */
export const viewingDependenciesService = {
  notifications: (read?: boolean, page = 1) => {
    const params = new URLSearchParams({ page: String(page), size: '20' })
    if (read !== undefined) params.set('read', String(read))
    return readViewingNotifications(params)
  },
  readNotification: (id: string) => {
    viewingNotificationSchema.shape.id.parse(id)
    return read(`/api/v1/appointments/notifications/${id}/read`, viewingNotificationSchema, {
      method: 'POST',
    })
  },
  readAllNotifications: () =>
    read('/api/v1/appointments/notifications/read-all', z.number().int().nonnegative(), {
      method: 'POST',
    }),
  context: () => read('/api/v1/appointments/context', viewingContextSchema),
  createAppointment: (input: ViewingAppointmentInput, idempotencyKey: string) =>
    read('/api/v1/appointments', viewingAppointmentSchema, {
      method: 'POST',
      body: JSON.stringify(viewingAppointmentInputSchema.parse(input)),
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  appointments: (
    filters: {
      status?: string
      fromDate?: string
      toDate?: string
      page?: number
      size?: number
      branchId?: string
      roomId?: string
      needsResult?: boolean
    } = {},
  ) => {
    const params = new URLSearchParams({
      page: String(filters.page ?? 1),
      size: String(filters.size ?? 20),
    })
    if (filters.status) params.set('status', appointmentStatus.parse(filters.status))
    if (filters.fromDate) params.set('fromDate', z.iso.date().parse(filters.fromDate))
    if (filters.toDate) params.set('toDate', z.iso.date().parse(filters.toDate))
    if (filters.branchId) params.set('branchId', objectId.parse(filters.branchId))
    if (filters.roomId) params.set('roomId', objectId.parse(filters.roomId))
    if (filters.needsResult) params.set('needsResult', 'true')
    return read(`/api/v1/appointments?${params}`, viewingAppointmentPageSchema)
  },
  appointment: (id: string) => {
    objectId.parse(id)
    return read(`/api/v1/appointments/${id}`, viewingAppointmentSchema)
  },
  actOnAppointment: (id: string, action: ViewingAction, input: unknown) => {
    objectId.parse(id)
    return read(`/api/v1/appointments/${id}/${actionPaths[action]}`, viewingAppointmentSchema, {
      method: 'POST',
      body: JSON.stringify(appointmentActionSchemas[action].parse(input)),
    })
  },
  eligibility: (roomId: string) => {
    if (!objectId.safeParse(roomId).success) {
      throw new ApiError('ID phòng không hợp lệ.', 400)
    }
    return read(`/api/v1/appointments/rooms/${roomId}/eligibility`, viewingEligibilitySchema)
  },
  configuration: (roomId: string) => {
    objectId.parse(roomId)
    return read(`/api/v1/shifts/rooms/${roomId}`, viewingConfigurationSchema)
  },
  updateConfiguration: (roomId: string, input: ViewingConfigurationInput) => {
    objectId.parse(roomId)
    const body = viewingConfigurationInputSchema.parse(input)
    return read(`/api/v1/shifts/rooms/${roomId}`, viewingConfigurationSchema, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },
  availability: (roomId: string, date: string) => {
    objectId.parse(roomId)
    z.iso.date().parse(date)
    return read(
      `/api/v1/shifts/rooms/${roomId}/availability?${new URLSearchParams({ date })}`,
      viewingAvailabilitySchema,
    )
  },
  branchConfigurations: (branchId: string, page = 1, size = 20) => {
    objectId.parse(branchId)
    z.number().int().min(1).parse(page)
    z.number().int().min(1).max(100).parse(size)
    return read(
      `/api/v1/shifts/branches/${branchId}?${new URLSearchParams({ page: String(page), size: String(size) })}`,
      viewingBranchPageSchema,
    )
  },
  bulkUpdate: async (branchId: string, input: ViewingBulkInput) => {
    objectId.parse(branchId)
    const body = viewingBulkInputSchema.parse(input)
    const result = await read(`/api/v1/shifts/branches/${branchId}`, viewingBulkResultSchema, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    const expected = new Set(body.rooms.map((room) => room.roomId.toLowerCase()))
    if (
      result.branchId.toLowerCase() !== branchId.toLowerCase() ||
      result.results.length !== expected.size ||
      new Set(result.results.map((row) => row.roomId.toLowerCase())).size !== expected.size ||
      result.results.some((row) => !expected.has(row.roomId.toLowerCase()))
    )
      throw new ApiError('Kết quả máy chủ không khớp các phòng đã gửi. Tải lại để kiểm tra.', 502)
    return result
  },
}

function readViewingNotifications(params: URLSearchParams) {
  return read(`/api/v1/appointments/notifications?${params}`, viewingNotificationPageSchema)
}

/** One user action, sequential bounded requests. Never rebase/retry an ambiguous write. */
export async function applyViewingBranchHours(
  branchId: string,
  hours: ViewingBulkHours,
  rooms: ViewingBulkInput['rooms'],
  onProgress?: (completed: number) => void,
): Promise<ViewingBulkResult> {
  objectId.parse(branchId)
  viewingBulkHoursSchema.parse(hours)
  z.array(roomVersionSchema).min(1).parse(rooms)
  if (new Set(rooms.map((room) => room.roomId.toLowerCase())).size !== rooms.length)
    throw new ApiError('Danh sách phòng không được trùng ID.', 400)
  const results: ViewingBulkResult['results'] = []
  for (let offset = 0; offset < rooms.length; offset += 100) {
    const batch = rooms.slice(offset, offset + 100)
    try {
      const response = await viewingDependenciesService.bulkUpdate(branchId, {
        ...hours,
        rooms: batch,
      })
      results.push(...response.results)
      onProgress?.(results.length)
    } catch (error) {
      const uncertain = !(error instanceof ApiError) || error.status === 0 || error.status >= 500
      results.push(
        ...batch.map((room) => ({
          roomId: room.roomId,
          roomNumber: null,
          status: 'FAILED' as const,
          version: null,
          code: uncertain ? 'REQUEST_UNCONFIRMED' : 'REQUEST_FAILED',
          message: uncertain
            ? 'Chưa xác nhận được kết quả lưu. Tải lại cấu hình trước khi thử lại.'
            : (error as Error).message,
          affectedAppointments: [],
        })),
      )
      results.push(
        ...rooms.slice(offset + batch.length).map((room) => ({
          roomId: room.roomId,
          roomNumber: null,
          status: 'FAILED' as const,
          version: null,
          code: 'NOT_PROCESSED',
          message: 'Chưa xử lý vì lượt gửi trước bị gián đoạn.',
          affectedAppointments: [],
        })),
      )
      onProgress?.(results.length)
      break
    }
  }
  return {
    branchId,
    results,
    updated: results.filter((row) => row.status === 'UPDATED').length,
    unchanged: results.filter((row) => row.status === 'UNCHANGED').length,
    failed: results.filter((row) => row.status === 'FAILED').length,
  }
}
