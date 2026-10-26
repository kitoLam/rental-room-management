import { z } from 'zod'
import { pageSchema, userSchema } from '@/interfaces/domain'
import {
  adminUserSchema,
  springUsersSchema,
  reviewSchema,
  adminRoleSchema,
  adminBranchSchema,
  auditSchema,
  adminSummarySchema,
  userCreateSchema,
} from '@/interfaces/admin'
import { request, write } from './http'
import { provider } from './config'
const schemas = {
  verifications: reviewSchema,
  owners: adminUserSchema,
  branches: adminBranchSchema,
  activity: auditSchema,
}
export type AdminResource = keyof typeof schemas
export const adminApi = {
  entitlements: () =>
    provider('admin') === 'real' || provider('auth') === 'real'
      ? Promise.resolve(null)
      : request(
          'admin',
          '/api/admin/entitlements',
          z.object({ user: userSchema, permissions: z.array(z.string()) }),
        ),
  users: async (params: Record<string, string>) => {
    const supported =
      provider('adminUsers') === 'real'
        ? { page: params.page || '0', size: params.size || '20' }
        : params
    const raw = await request(
      'adminUsers',
      `/api/users?${new URLSearchParams(supported)}`,
      springUsersSchema,
    )
    return { ...raw, number: raw.number + 1 }
  },
  user: (id: string) =>
    request('adminUsers', `/api/users/${encodeURIComponent(id)}`, adminUserSchema),
  create: (value: unknown) => {
    const data = userCreateSchema.parse(value)
    return request(
      'adminUsers',
      '/api/users',
      adminUserSchema,
      write(
        'POST',
        provider('adminUsers') === 'real'
          ? {
              ...data,
              email: data.email || null,
              phone: data.phone || null,
              dateOfBirth: data.dateOfBirth || null,
              gender: data.gender || null,
            }
          : data,
      ),
    )
  },
  status: (id: string, active: boolean, version?: number, reason?: string) =>
    request(
      'adminUsers',
      `/api/users/${encodeURIComponent(id)}/active-status`,
      adminUserSchema,
      write('PATCH', provider('adminUsers') === 'real' ? { active } : { active, version, reason }),
    ),
  summary: () => request('admin', '/api/admin/dashboard', adminSummarySchema),
  list: <K extends AdminResource>(resource: K, params: Record<string, string>) =>
    request(
      'admin',
      `/api/admin/${resource === 'verifications' ? 'owner-verifications' : resource}?${new URLSearchParams(params)}`,
      pageSchema(schemas[resource]),
    ) as Promise<import('@/interfaces/domain').Page<z.infer<(typeof schemas)[K]>>>,
  review: (id: string) =>
    request('admin', `/api/admin/owner-verifications/${encodeURIComponent(id)}`, reviewSchema),
  decide: (id: string, value: unknown) =>
    request(
      'admin',
      `/api/admin/owner-verifications/${encodeURIComponent(id)}/decision`,
      reviewSchema,
      write('POST', value),
    ),
  document: (id: string) =>
    request(
      'admin',
      `/api/admin/owner-verifications/${encodeURIComponent(id)}/document`,
      z.object({ mime: z.literal('image/svg+xml'), content: z.string(), expiresAt: z.string() }),
    ),
  roles: () => request('admin', '/api/admin/roles', z.array(adminRoleSchema)),
  event: (id: string) =>
    request('admin', `/api/admin/activity/${encodeURIComponent(id)}`, auditSchema),
  reset: () => request('admin', '/api/admin/demo/reset', z.null(), write('POST', {})),
}
