import { z } from 'zod'
import { roleSchema } from './domain'
import { verificationSchema } from './owner'
export const accountStatusSchema = z.enum([
  'INVITED',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'LOCKED',
  'DISABLED',
])
export const adminUserSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  status: accountStatusSchema,
  createdAt: z.string(),
  roles: z.array(roleSchema).optional(),
  version: z.number().int().optional(),
  canActivate: z.boolean().optional(),
  contactVerified: z.boolean().optional(),
  ownerVerificationStatus: verificationSchema.shape.status.optional(),
  ownerReviewedAt: z.string().nullable().optional(),
  scope: z
    .object({ ownedBranches: z.number(), assignedBranches: z.number(), tenancies: z.number() })
    .optional(),
})
export type AdminUser = z.infer<typeof adminUserSchema>
export const userCreateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255),
    email: z.union([z.literal(''), z.email().max(320)]),
    phone: z
      .string()
      .trim()
      .regex(/^$|^\+[1-9][0-9]{7,14}$/, 'Dùng định dạng quốc tế, ví dụ +84901234567.'),
    dateOfBirth: z
      .union([z.literal(''), z.iso.date()])
      .refine(
        (v) => !v || v <= new Date().toISOString().slice(0, 10),
        'Ngày sinh không được ở tương lai.',
      ),
    gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']),
  })
  .strict()
  .refine((v) => !!v.email || !!v.phone, {
    path: ['email'],
    message: 'Nhập email hoặc số điện thoại.',
  })
export const springUsersSchema = z.object({
  content: z.array(adminUserSchema),
  number: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})
export const auditSchema = z.object({
  id: z.uuid(),
  actorUserId: z.uuid().nullable(),
  actorName: z.string(),
  tableName: z.enum(['users', 'owner_managers', 'branches']),
  entityId: z.uuid(),
  action: z.string(),
  reason: z.string().nullable(),
  requestKey: z.string().nullable(),
  occurredAt: z.string(),
  summary: z.string(),
  detail: z
    .object({
      previousStatus: z.string().optional(),
      status: z.string().optional(),
      verificationStatus: z.string().optional(),
      provisionedOwner: z.boolean().optional(),
      branchName: z.string().optional(),
    })
    .strip(),
})
export type AdminAudit = z.infer<typeof auditSchema>
export const reviewSchema = z.object({
  user: adminUserSchema,
  verification: verificationSchema,
  version: z.string(),
  reviewerName: z.string().nullable(),
  history: z.array(auditSchema),
})
export type AdminReview = z.infer<typeof reviewSchema>
export const adminBranchSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  province: z.string(),
  address: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
  ownerId: z.uuid(),
  ownerName: z.string(),
  managerId: z.uuid().nullable(),
  managerName: z.string().nullable(),
  createdAt: z.string().nullable(),
})
export const adminRoleSchema = z.object({
  id: roleSchema,
  name: z.string(),
  description: z.string(),
  scope: z.string(),
  requirement: z.string(),
  userCount: z.number().int(),
})
export const adminSummarySchema = z.object({
  totalRooms: z.number().int().nonnegative(),
  publishedRooms: z.number().int().nonnegative(),
  totalBranches: z.number().int().nonnegative(),
  totalUsers: z.number().int(),
  accounts: z.array(z.object({ status: accountStatusSchema, count: z.number().int() })),
  pendingOwners: z.number().int(),
  approvedOwners: z.number().int(),
  branches: z.array(z.object({ status: z.string(), count: z.number().int() })),
  recent: z.array(auditSchema),
  issues: z.array(z.object({ id: z.uuid(), name: z.string(), status: accountStatusSchema })),
})
export type AdminState = {
  metadata: Record<string, { createdAt: string; version: number; contactVerified: boolean }>
  events: AdminAudit[]
  observed: string[]
}
