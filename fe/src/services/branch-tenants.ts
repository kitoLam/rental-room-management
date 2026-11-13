import { z } from 'zod'
import { databaseIdSchema, pageSchema, type Page } from '@/interfaces/domain'
import { provider, type Feature } from './config'
import { ApiError, request, write } from './http'

export const tenantAccountItemSchema = z.object({
  id: databaseIdSchema,
  userId: databaseIdSchema.nullable().optional(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  role: z.enum(['TENANT', 'MANAGER']).optional().default('TENANT'),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']),
  accountStatus: z.string().optional().default('ACTIVE'),
  emailVerified: z.boolean().optional().default(true),
  passwordSet: z.boolean().optional().default(true),
  branchIds: z.array(z.string()).optional().default([]),
  branchNames: z.array(z.string()).optional().default([]),
  inactiveBranchIds: z.array(z.string()).optional().default([]),
  currentRoomNumber: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

export type TenantAccountItem = z.infer<typeof tenantAccountItemSchema>

export const tenantBranchStatsSchema = z.object({
  branchId: z.string().nullable().optional(),
  totalTenants: z.number(),
  totalManagers: z.number().optional().default(0),
  activeTenants: z.number(),
  inactiveTenants: z.number(),
  pendingVerificationTenants: z.number(),
})

export type TenantBranchStats = z.infer<typeof tenantBranchStatsSchema>

export const createTenantAccountSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Họ và tên không được để trống')
    .max(100, 'Họ và tên không vượt quá 100 ký tự'),
  email: z
    .string()
    .trim()
    .min(1, 'Email không được để trống')
    .email('Email không đúng định dạng')
    .max(254, 'Email không vượt quá 254 ký tự'),
  phone: z
    .string()
    .trim()
    .transform((v) => (v.startsWith('+84') ? `0${v.slice(3)}` : v))
    .refine((v) => /^0[35789][0-9]{8}$/.test(v), {
      message: 'Số di động Việt Nam phải gồm 10 số, đầu 03/05/07/08/09',
    }),
  branchId: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),
})

export type CreateTenantAccountInput = z.infer<typeof createTenantAccountSchema>

export const tenantDebtServiceItemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  name: z.string(),
  unit: z.string(),
  unitPrice: z.coerce.number(),
  quantity: z.number(),
  amount: z.coerce.number(),
  mandatory: z.boolean().optional().default(false),
})

export const latePaymentHistorySchema = z.object({
  id: z.string(),
  invoiceId: z.string().nullable().optional(),
  period: z.string(),
  dueDate: z.string().nullable().optional(),
  firstOverdueDate: z.string().nullable().optional(),
  lateDays: z.number(),
  status: z.string(),
  totalAmount: z.coerce.number().optional().default(0),
  paidAmount: z.coerce.number().optional().default(0),
  remainingAmount: z.coerce.number().optional().default(0),
  reminderCount: z.number().optional().default(0),
  lastReminderAt: z.string().nullable().optional(),
  settledAt: z.string().nullable().optional(),
})

export type LatePaymentHistoryItem = z.infer<typeof latePaymentHistorySchema>

export const tenantDebtItemSchema = z.object({
  id: z.string(),
  contractId: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  contractStatus: z.string().nullable().optional(),
  contractStartDate: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  contractSignedDate: z.string().nullable().optional(),
  contractDepositAmount: z.coerce.number().nullable().optional(),
  paymentDueDay: z.number().nullable().optional(),
  joinedAt: z.string().nullable().optional(),
  contractTenantId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  tenantName: z.string(),
  tenantEmail: z.string().nullable().optional(),
  tenantPhone: z.string().nullable().optional(),
  tenantIdNumber: z.string().nullable().optional(),
  tenantGender: z.string().nullable().optional(),
  tenantDateOfBirth: z.string().nullable().optional(),
  tenantAddress: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  period: z.string(),
  dueDate: z.string(),
  overdueDays: z.number(),
  overdue: z.boolean(),
  roomRentAmount: z.coerce.number(),
  registeredServices: z.array(tenantDebtServiceItemSchema).optional().default([]),
  registeredServicesAmount: z.coerce.number(),
  electricityAmount: z.coerce.number().optional().default(0),
  waterAmount: z.coerce.number().optional().default(0),
  unpaidUtilityAmount: z.coerce.number(),
  totalAmount: z.coerce.number(),
  paidAmount: z.coerce.number().optional().default(0),
  remainingAmount: z.coerce.number(),
  status: z.string().optional().default('OVERDUE'),
  recordedLateDays: z.number().optional().default(0),
  reminderCount: z.number().optional().default(0),
  latePaymentHistory: z.array(latePaymentHistorySchema).optional().default([]),
})

export type TenantDebtItem = z.infer<typeof tenantDebtItemSchema>

export interface FirstMonthProrationInfo {
  isFirstMonth: boolean
  moveInDate: string | null
  startDay: number
  stayedDays: number
  unoccupiedDays: number
  stayedPercent: number
  deductedPercent: number
  baseRoomRent: number
  deductedAmount: number
  proratedRoomRent: number
}

export function computeFirstMonthProration(item: TenantDebtItem): FirstMonthProrationInfo {
  const moveInDate = item.contractStartDate || item.joinedAt || null
  const isFirstMonth = Boolean(moveInDate && moveInDate.slice(0, 7) === item.period)
  if (!isFirstMonth || !moveInDate) {
    return {
      isFirstMonth: false,
      moveInDate,
      startDay: 1,
      stayedDays: 30,
      unoccupiedDays: 0,
      stayedPercent: 100,
      deductedPercent: 0,
      baseRoomRent: item.roomRentAmount,
      deductedAmount: 0,
      proratedRoomRent: item.roomRentAmount,
    }
  }
  const startDay = Math.min(30, Math.max(1, Number(moveInDate.slice(8, 10)) || 1))
  const unoccupiedDays = startDay - 1
  const stayedDays = 30 - unoccupiedDays
  const stayedPercent = Math.round((stayedDays / 30) * 1000) / 10
  const deductedPercent = Math.round((unoccupiedDays / 30) * 1000) / 10

  // Nếu BE chưa khởi động lại (vẫn còn điện nước / dịch vụ > 0 ở tháng đầu), roomRentAmount là giá gốc 30 ngày.
  // Nếu BE đã tính theo ngày ở (điện nước & dịch vụ = 0), khôi phục giá gốc 30 ngày từ tỷ lệ stayedDays/30.
  const backendAlreadyProrated =
    item.electricityAmount === 0 &&
    item.waterAmount === 0 &&
    item.registeredServicesAmount === 0
  const baseRoomRent =
    backendAlreadyProrated && stayedDays < 30
      ? Math.round((item.roomRentAmount * 30) / stayedDays / 1000) * 1000
      : item.roomRentAmount
  const proratedRoomRent = Math.round((baseRoomRent * stayedDays) / 30)
  const deductedAmount = Math.max(0, baseRoomRent - proratedRoomRent)

  return {
    isFirstMonth: true,
    moveInDate,
    startDay,
    stayedDays,
    unoccupiedDays,
    stayedPercent,
    deductedPercent,
    baseRoomRent,
    deductedAmount,
    proratedRoomRent,
  }
}

function normalizeFirstMonthDebtItem(item: TenantDebtItem): TenantDebtItem {
  const info = computeFirstMonthProration(item)
  if (!info.isFirstMonth) return item
  const isPaid = item.status === 'PAID' || item.remainingAmount === 0
  const totalAmount = info.proratedRoomRent
  const paidAmount = isPaid ? totalAmount : Math.min(item.paidAmount, totalAmount)
  const remainingAmount = isPaid ? 0 : Math.max(0, totalAmount - paidAmount)
  return {
    ...item,
    roomRentAmount: info.proratedRoomRent,
    registeredServices: [],
    registeredServicesAmount: 0,
    electricityAmount: 0,
    waterAmount: 0,
    unpaidUtilityAmount: 0,
    totalAmount,
    paidAmount,
    remainingAmount,
  }
}

const managedBranchSchema = z.object({
  id: z.string(),
  ownerAccountId: z.string().nullable().optional(),
  name: z.string(),
  address: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

const mockStore: TenantAccountItem[] = [
  {
    id: '00000000-0000-4000-8000-000000005100',
    userId: '00000000-0000-4000-8000-000000000101',
    fullName: 'Phạm Minh Tuấn',
    email: 'tenant@tropro.demo',
    phone: '0901234567',
    role: 'TENANT',
    dateOfBirth: null,
    gender: 'MALE',
    avatarUrl: null,
    status: 'ACTIVE',
    accountStatus: 'ACTIVE',
    emailVerified: true,
    passwordSet: true,
    branchIds: ['00000000-0000-4000-8000-000000001000'],
    branchNames: ['TroPro Cầu Giấy'],
    inactiveBranchIds: [],
    currentRoomNumber: 'P.101',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000005199',
    userId: '00000000-0000-4000-8000-000000000102',
    fullName: 'Nguyễn Quản Lý',
    email: 'manager@tropro.demo',
    phone: '0901000002',
    role: 'MANAGER',
    dateOfBirth: null,
    gender: 'FEMALE',
    avatarUrl: null,
    status: 'ACTIVE',
    accountStatus: 'ACTIVE',
    emailVerified: true,
    passwordSet: true,
    branchIds: ['00000000-0000-4000-8000-000000001000'],
    branchNames: ['TroPro Cầu Giấy'],
    inactiveBranchIds: [],
    currentRoomNumber: null,
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-01-05T08:00:00Z',
  },
]

function filterMock(
  params: {
    branchId?: string
    role?: string
    status?: string
    keyword?: string
  },
  feature: Feature = 'manager',
): TenantAccountItem[] {
  const isManagerCaller = feature === 'manager'
  return mockStore
    .filter((t) => !isManagerCaller || t.role === 'TENANT')
    .filter((t) => !params.branchId || t.branchIds.includes(params.branchId))
    .map((t) => {
      const isInactive = params.branchId
        ? t.inactiveBranchIds.includes(params.branchId)
        : t.branchIds.length > 0 &&
          t.branchIds.every((b) => t.inactiveBranchIds.includes(b))
      return {
        ...t,
        status: isInactive ? ('INACTIVE' as const) : ('ACTIVE' as const),
      }
    })
    .filter((t) => isManagerCaller || !params.role || t.role === params.role)
    .filter((t) => isManagerCaller || !params.status || t.status === params.status)
    .filter((t) => {
      if (!params.keyword) return true
      const q = params.keyword.toLowerCase()
      if (isManagerCaller) {
        return t.fullName.toLowerCase().includes(q)
      }
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.phone || '').toLowerCase().includes(q)
      )
    })
}

export const branchTenantsService = {
  get: (branchId: string, tenantId: string) => {
    if (provider('manager') === 'mock')
      return Promise.resolve(mockStore.find((item) => item.id === tenantId) ?? null)
    const query = new URLSearchParams({ branchId })
    return request('manager', `/api/v1/tenants/${encodeURIComponent(tenantId)}?${query}`, tenantAccountItemSchema)
  },
  managedBranches: async (feature: Feature = 'manager') => {
    if (provider(feature) === 'mock') {
      return [
        {
          id: '00000000-0000-4000-8000-000000001000',
          name: 'TroPro Cầu Giấy',
          address: '125 Xuân Thủy, Cầu Giấy, Hà Nội',
          status: 'ACTIVE' as const,
        },
      ]
    }
    return request(feature, '/api/v1/branches/managed', z.array(managedBranchSchema))
  },

  list: async (
    params: {
      branchId?: string
      role?: string
      status?: string
      keyword?: string
      page?: number
      size?: number
    },
    feature: Feature = 'manager',
  ): Promise<Page<TenantAccountItem>> => {
    const pageIndex = params.page ?? 0
    const size = params.size ?? 10
    if (provider(feature) === 'mock') {
      const items = filterMock(params, feature)
      const content = items.slice(pageIndex * size, (pageIndex + 1) * size)
      return {
        content,
        number: pageIndex,
        size,
        totalElements: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / size)),
      }
    }
    const query = new URLSearchParams({
      page: String(pageIndex),
      size: String(size),
    })
    if (params.branchId) query.set('branchId', params.branchId)
    if (params.role) query.set('role', params.role)
    if (params.status) query.set('status', params.status)
    if (params.keyword) query.set('keyword', params.keyword)
    const raw = await request(
      feature,
      `/api/v1/tenants?${query}`,
      pageSchema(tenantAccountItemSchema),
    )
    return {
      ...raw,
      number: Math.max(0, raw.number - 1),
    }
  },

  stats: async (branchId?: string, feature: Feature = 'manager'): Promise<TenantBranchStats> => {
    if (provider(feature) === 'mock') {
      const items = filterMock({ branchId }, feature)
      return {
        branchId: branchId || null,
        totalTenants: items.filter((t) => t.role === 'TENANT').length,
        totalManagers: items.filter((t) => t.role === 'MANAGER').length,
        activeTenants: items.filter((t) => t.status === 'ACTIVE').length,
        inactiveTenants: items.filter((t) => t.status === 'INACTIVE').length,
        pendingVerificationTenants: items.filter((t) => !t.emailVerified || !t.passwordSet).length,
      }
    }
    const query = branchId ? `?${new URLSearchParams({ branchId })}` : ''
    return request(feature, `/api/v1/tenants/stats${query}`, tenantBranchStatsSchema)
  },

  create: async (
    input: CreateTenantAccountInput,
    feature: Feature = 'manager',
  ): Promise<TenantAccountItem> => {
    const parsed = createTenantAccountSchema.parse(input)
    if (provider(feature) === 'mock') {
      const normalizedEmail = parsed.email.toLowerCase()
      if (mockStore.some((t) => t.email.toLowerCase() === normalizedEmail)) {
        throw new ApiError('Email này đã tồn tại tài khoản trong hệ thống', 409)
      }
      if (mockStore.some((t) => t.phone === parsed.phone)) {
        throw new ApiError('Số điện thoại này đã tồn tại tài khoản trong hệ thống', 409)
      }
      const created: TenantAccountItem = {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        fullName: parsed.fullName,
        email: normalizedEmail,
        phone: parsed.phone,
        role: 'TENANT',
        dateOfBirth: parsed.dateOfBirth || null,
        gender: parsed.gender || null,
        avatarUrl: null,
        status: 'ACTIVE',
        accountStatus: 'PENDING_VERIFICATION',
        emailVerified: false,
        passwordSet: false,
        branchIds: parsed.branchId ? [parsed.branchId] : [],
        branchNames: [],
        inactiveBranchIds: [],
        currentRoomNumber: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockStore.unshift(created)
      return created
    }
    return request(
      feature,
      '/api/v1/tenants',
      tenantAccountItemSchema,
      write('POST', {
        fullName: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone,
        branchId: parsed.branchId || undefined,
        gender: parsed.gender || undefined,
        dateOfBirth: parsed.dateOfBirth || undefined,
      }),
    )
  },

  updateBranchStatus: async (
    tenantId: string,
    input: { branchId?: string; status: 'ACTIVE' | 'INACTIVE' },
    feature: Feature = 'manager',
  ): Promise<TenantAccountItem> => {
    if (provider(feature) === 'mock') {
      const target = mockStore.find((t) => t.id === tenantId)
      if (!target) throw new ApiError('Không tìm thấy tài khoản', 404)
      const bId = input.branchId || target.branchIds[0] || ''
      if (input.status === 'INACTIVE') {
        if (bId && !target.inactiveBranchIds.includes(bId)) {
          target.inactiveBranchIds.push(bId)
        }
        target.status = 'INACTIVE'
      } else {
        target.inactiveBranchIds = target.inactiveBranchIds.filter((id) => id !== bId)
        target.status = 'ACTIVE'
      }
      return { ...target }
    }
    return request(
      feature,
      `/api/v1/tenants/${encodeURIComponent(tenantId)}/branch-status`,
      tenantAccountItemSchema,
      write('PATCH', input),
    )
  },

  updateRole: async (
    accountId: string,
    input: { role: 'TENANT' | 'MANAGER'; branchId?: string },
    feature: Feature = 'owner',
  ): Promise<TenantAccountItem> => {
    if (provider(feature) === 'mock') {
      const target = mockStore.find((t) => t.id === accountId)
      if (!target) throw new ApiError('Không tìm thấy tài khoản', 404)
      target.role = input.role
      return { ...target }
    }
    return request(
      feature,
      `/api/v1/tenants/${encodeURIComponent(accountId)}/role`,
      tenantAccountItemSchema,
      write('PATCH', input),
    )
  },

  resendVerification: async (
    tenantId: string,
    branchId?: string,
    feature: Feature = 'manager',
  ) => {
    if (provider(feature) === 'mock') {
      return { message: 'Đã gửi lại liên kết xác thực và đặt mật khẩu tới email của người thuê' }
    }
    const query = branchId ? `?${new URLSearchParams({ branchId })}` : ''
    return request(
      feature,
      `/api/v1/tenants/${encodeURIComponent(tenantId)}/resend-verification${query}`,
      z.object({ message: z.string().optional() }).passthrough().nullable(),
      write('POST', {}),
    )
  },

  debts: async (
    params: {
      branchId?: string
      keyword?: string
      overdueOnly?: boolean
      period?: string
      page?: number
      size?: number
    },
    feature: Feature = 'manager',
  ): Promise<Page<TenantDebtItem>> => {
    const pageIndex = params.page ?? 0
    const size = params.size ?? 10
    if (provider(feature) === 'mock') {
      const mockDebts: TenantDebtItem[] = [
        {
          id: '00000000-0000-4000-8000-000000009001',
          contractId: '00000000-0000-4000-8000-000000004000',
          contractNumber: 'HD-2026-001',
          contractTenantId: '00000000-0000-4000-8000-000000005000',
          tenantId: '00000000-0000-4000-8000-000000005100',
          tenantName: 'Phạm Minh Tuấn',
          tenantEmail: 'tenant@tropro.demo',
          tenantPhone: '0901234567',
          branchId: params.branchId || '00000000-0000-4000-8000-000000001000',
          branchName: 'TroPro Cầu Giấy',
          roomId: '00000000-0000-4000-8000-000000003000',
          roomNumber: 'P.101',
          period: '2026-11',
          dueDate: '2026-11-05',
          overdueDays: 6,
          overdue: true,
          roomRentAmount: 3500000,
          registeredServices: [
            {
              serviceId: 'srv-wifi',
              name: 'Internet / Wifi',
              unit: 'tháng',
              unitPrice: 100000,
              quantity: 1,
              amount: 100000,
              mandatory: true,
            },
            {
              serviceId: 'srv-clean',
              name: 'Vệ sinh chung',
              unit: 'tháng',
              unitPrice: 50000,
              quantity: 1,
              amount: 50000,
              mandatory: true,
            },
          ],
          registeredServicesAmount: 150000,
          electricityAmount: 280000,
          waterAmount: 90000,
          unpaidUtilityAmount: 370000,
          totalAmount: 4020000,
          paidAmount: 0,
          remainingAmount: 4020000,
          status: 'OVERDUE',
          recordedLateDays: 6,
          reminderCount: 1,
          latePaymentHistory: [],
        },
      ]
      const filtered = mockDebts.filter((d) => {
        if (params.overdueOnly && !d.overdue) return false
        if (params.keyword) {
          const q = params.keyword.toLowerCase()
          return (
            d.tenantName.toLowerCase().includes(q) ||
            (d.roomNumber || '').toLowerCase().includes(q)
          )
        }
        return true
      })
      return {
        content: filtered,
        number: pageIndex,
        size,
        totalElements: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / size)),
      }
    }
    const query = new URLSearchParams({
      page: String(pageIndex),
      size: String(size),
      overdueOnly: String(Boolean(params.overdueOnly)),
    })
    if (params.branchId) query.set('branchId', params.branchId)
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.period) query.set('period', params.period)
    const raw = await request(
      feature,
      `/api/v1/invoices/debts?${query}`,
      pageSchema(tenantDebtItemSchema),
    )
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const isEffectiveToday = (item: TenantDebtItem) =>
      !(item.contractNumber || '').toUpperCase().startsWith('TMP-') &&
      (!item.contractStartDate || item.contractStartDate <= today) &&
      (!item.contractEndDate || item.contractEndDate >= today)

    const compareActivePriority = (a: TenantDebtItem, b: TenantDebtItem) => {
      const startCmp = (b.contractStartDate || '').localeCompare(a.contractStartDate || '')
      if (startCmp !== 0) return startCmp
      return (b.contractNumber || '').localeCompare(a.contractNumber || '')
    }

    const byTenantAndRoom = new Map<string, TenantDebtItem>()
    for (const item of raw.content) {
      if (!isEffectiveToday(item)) continue
      const tenantKey = (item.tenantId || item.tenantEmail || item.tenantName).trim().toLowerCase()
      const roomKey = (item.roomId || item.roomNumber || item.contractId || item.id)
        .trim()
        .toLowerCase()
      const compositeKey = `${tenantKey}:${roomKey}`
      const existing = byTenantAndRoom.get(compositeKey)
      if (!existing || compareActivePriority(item, existing) < 0) {
        byTenantAndRoom.set(compositeKey, item)
      }
    }
    const dedupedContent = Array.from(byTenantAndRoom.values()).map(normalizeFirstMonthDebtItem)
    return {
      ...raw,
      content: dedupedContent,
      totalElements: dedupedContent.length,
      totalPages: Math.max(1, Math.ceil(dedupedContent.length / size)),
      number: Math.max(0, raw.number - 1),
    }
  },
  latePaymentHistory: async (
    contractId: string,
    feature: Feature = 'manager',
  ): Promise<LatePaymentHistoryItem[]> => {
    if (provider(feature) === 'mock') return []
    return request(
      feature,
      `/api/v1/invoices/contracts/${encodeURIComponent(contractId)}/late-payments`,
      z.array(latePaymentHistorySchema),
    )
  },
  payDebt: async (
    debtId: string,
    feature: Feature = 'manager',
  ): Promise<TenantDebtItem> => {
    if (provider(feature) === 'mock') {
      return {
        id: debtId,
        contractId: '00000000-0000-4000-8000-000000004000',
        contractNumber: 'HD-2026-001',
        contractTenantId: debtId,
        tenantId: '00000000-0000-4000-8000-000000005100',
        tenantName: 'Phạm Minh Tuấn',
        tenantEmail: 'tenant@tropro.demo',
        tenantPhone: '0901234567',
        branchId: '00000000-0000-4000-8000-000000001000',
        branchName: 'TroPro Cầu Giấy',
        roomId: '00000000-0000-4000-8000-000000003000',
        roomNumber: 'P.101',
        period: '2026-11',
        dueDate: '2026-11-05',
        overdueDays: 0,
        overdue: false,
        roomRentAmount: 3500000,
        registeredServices: [],
        registeredServicesAmount: 150000,
        electricityAmount: 280000,
        waterAmount: 90000,
        unpaidUtilityAmount: 0,
        totalAmount: 4020000,
        paidAmount: 4020000,
        remainingAmount: 0,
        status: 'PAID',
        recordedLateDays: 0,
        reminderCount: 0,
        latePaymentHistory: [],
      }
    }
    return request(
      feature,
      `/api/v1/invoices/debts/${encodeURIComponent(debtId)}/pay`,
      tenantDebtItemSchema,
      { method: 'POST' },
    )
  },
  unpayDebt: async (
    debtId: string,
    feature: Feature = 'manager',
  ): Promise<TenantDebtItem> => {
    return request(
      feature,
      `/api/v1/invoices/debts/${encodeURIComponent(debtId)}/unpay`,
      tenantDebtItemSchema,
      { method: 'POST' },
    )
  },
}
