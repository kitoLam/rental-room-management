import { z } from 'zod'

export const emailField = z.string().trim().email('Nhập địa chỉ email hợp lệ.').max(255)
export const passwordField = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
  .max(72, 'Mật khẩu tối đa 72 ký tự.')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Mật khẩu tối đa 72 byte UTF-8.')
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Nhập mật khẩu.'),
})
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Nhập họ và tên.').max(255),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận chưa khớp.',
  })
export const resetSchema = z
  .object({ password: passwordField, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận chưa khớp.',
  })
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Nhập họ và tên.').max(255),
  phone: z.string().regex(/^(?:\+?[0-9 ]{9,15})?$/, 'Số điện thoại chưa hợp lệ.'),
  dateOfBirth: z
    .string()
    .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v < today()), 'Ngày sinh chưa hợp lệ.'),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']),
})
export function safeRedirect(value: string | null, fallback = '/user/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value))
    return fallback
  const url = new URL(value, 'https://tropro.local')
  if (
    url.origin !== 'https://tropro.local' ||
    /^\/(login|register|verify-email|forgot-password|reset-password)(\/|$)/.test(url.pathname)
  )
    return fallback
  return url.pathname + url.search + url.hash
}
export function today() {
  return localDate(new Date())
}
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDate(date)
}
export const dateRangeSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày bắt đầu.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày kết thúc.'),
  })
  .superRefine((v, ctx) => {
    for (const key of ['startDate', 'endDate'] as const)
      if (
        Number.isNaN(Date.parse(v[key])) ||
        new Date(v[key]).toISOString().slice(0, 10) !== v[key]
      )
        ctx.addIssue({ code: 'custom', path: [key], message: 'Ngày không hợp lệ.' })
    if (v.startDate < today())
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'Ngày bắt đầu không được ở quá khứ.',
      })
    if (v.endDate <= v.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Ngày kết thúc phải sau ngày bắt đầu.',
      })
  })
export const appointmentInputSchema = z
  .object({
    roomId: z.string().uuid(),
    startAt: z.string(),
    endAt: z.string(),
    note: z.string().max(1000),
  })
  .superRefine((v, ctx) => {
    if (!Number.isFinite(Date.parse(v.startAt)) || Date.parse(v.startAt) <= Date.now())
      ctx.addIssue({
        code: 'custom',
        path: ['startAt'],
        message: 'Chọn thời gian trong tương lai.',
      })
    if (!Number.isFinite(Date.parse(v.endAt)) || Date.parse(v.endAt) <= Date.parse(v.startAt))
      ctx.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'Giờ kết thúc phải sau giờ bắt đầu.',
      })
  })
export const bookingInputSchema = dateRangeSchema
  .safeExtend({
    roomId: z.string().uuid(),
    roomSlotId: z.string().uuid().optional(),
    rentalMode: z.enum(['ROOM', 'SLOT']),
    policyId: z.string().uuid(),
    policyVersion: z.number().int().positive(),
    acknowledged: z.literal(true, { error: 'Vui lòng xác nhận đã đọc chính sách.' }),
  })
  .superRefine((v, ctx) => {
    if (v.rentalMode === 'SLOT' && !v.roomSlotId)
      ctx.addIssue({ code: 'custom', path: ['roomSlotId'], message: 'Chọn một chỗ ở còn trống.' })
    if (v.rentalMode === 'ROOM' && v.roomSlotId)
      ctx.addIssue({
        code: 'custom',
        path: ['roomSlotId'],
        message: 'Thuê nguyên phòng không chọn slot.',
      })
  })
export const uuid = (value?: string) => z.string().uuid().safeParse(value).success
