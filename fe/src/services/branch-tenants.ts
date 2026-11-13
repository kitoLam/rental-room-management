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
}
