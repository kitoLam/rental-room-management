import { z } from 'zod'
import { branchSchema, policySchema, userSchema } from './domain'
import {
  branchAssignmentSchema as managerBranchSchema,
  managerPaymentSchema,
  reportSummarySchema as managerSummarySchema,
} from './manager'

const text = z.string().trim().min(1, 'Vui lòng nhập thông tin.').max(2000)
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const branchInputSchema = z
  .object({
    code: text.max(50).regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.'),
    name: text.max(255),
    address: text,
    province: z.string().max(100),
    district: z.string().max(100),
    ward: z.string().max(100),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    description: z.string().max(4000),
    rules: z.array(z.string().max(500)).max(20),
    publicPhone: z.string().regex(/^$|^\+?[0-9 ]{9,15}$/, 'Số điện thoại chưa hợp lệ.'),
    publicEmail: z.union([z.literal(''), z.email()]),
    images: z.array(z.string()).max(3),
    isPublic: z.boolean(),
    status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
    managerId: z.guid().nullable(),
  })
  .strict()
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: 'Nhập cả vĩ độ và kinh độ.',
    path: ['longitude'],
  })
export type BranchInput = z.infer<typeof branchInputSchema>
export const ownedBranchSchema = managerBranchSchema.extend(branchSchema.shape).extend({
  code: z.string(),
  province: z.string(),
  district: z.string(),
  ward: z.string(),
  isPublic: z.boolean(),
  qrPublicId: z.string().nullable(),
  qrUrl: z.string().nullable(),
  version: z.number().int(),
  assignedAt: z.string().nullable(),
  roomCount: z.number(),
})
export type OwnedBranch = z.infer<typeof ownedBranchSchema>
export const ownerPolicySchema = policySchema.extend({
  collectionDay: z.number().int(),
  paymentGraceDays: z.number().int(),
})
export const policyInputSchema = ownerPolicySchema
  .omit({ id: true, branchId: true, version: true })
  .extend({
    effectiveFrom: z.iso.datetime({ offset: true }),
    collectionDay: z.number().int().min(1).max(28),
    paymentGraceDays: z.number().int().min(0).max(90),
    bookingHoldAmount: money,
    paymentWindowMinutes: z.number().int().min(1).max(10080),
    temporaryHoldMinutes: z.number().int().min(1).max(10080),
    confirmedHoldMinutes: z.number().int().min(1).max(525600),
    cancellationTerms: text,
    appointmentPolicy: z
      .object({
        openingHour: z.number().int().min(0).max(23),
        closingHour: z.number().int().min(1).max(24),
        maxDurationMinutes: z.number().int().min(15).max(480),
        cancellationHours: z.number().int().min(0).max(168),
      })
      .strict(),
  })
  .strict()
  .refine((v) => v.appointmentPolicy.openingHour < v.appointmentPolicy.closingHour, {
    message: 'Giờ đóng cửa phải sau giờ mở cửa.',
    path: ['appointmentPolicy'],
  })
  .refine((v) => v.temporaryHoldMinutes >= v.paymentWindowMinutes, {
    message: 'Thời gian giữ tạm phải đủ thời gian thanh toán.',
    path: ['temporaryHoldMinutes'],
  })
export type OwnerPolicy = z.infer<typeof ownerPolicySchema>
export const verificationSchema = z.object({
  userId: z.guid(),
  status: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']),
  fullName: z.string(),
  phone: z.string().nullable(),
  contactVerified: z.boolean(),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewedBy: z.guid().nullable().optional(),
  reason: z.string().nullable(),
  document: z
    .object({ name: z.string(), mime: z.string(), size: z.number(), resourceId: z.string() })
    .nullable(),
  eligible: z.boolean(),
})
export type OwnerVerification = z.infer<typeof verificationSchema>
export const invitationInputSchema = z
  .object({
    fullName: text.max(255),
    email: z.email(),
    phone: z.string().regex(/^$|^\+?[0-9 ]{9,15}$/),
    branchIds: z.array(z.guid()).max(30),
    note: z.string().max(1000),
  })
  .strict()
export const invitationSchema = invitationInputSchema.extend({
  id: z.guid(),
  ownerId: z.guid(),
  status: z.enum(['INVITED', 'ACCEPTED', 'CANCELLED', 'EXPIRED']),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedBy: z.guid().nullable(),
})
export type ManagerInvitation = z.infer<typeof invitationSchema>
export const relationshipSchema = z.object({
  id: z.guid(),
  user: userSchema,
  assignedAt: z.string(),
  branches: z.array(
    z.object({ id: z.guid(), name: z.string(), assignedAt: z.string().nullable() }),
  ),
})
export type ManagerRelationship = z.infer<typeof relationshipSchema>
export const activitySchema = z.object({
  id: z.guid(),
  ownerId: z.guid(),
  branchId: z.guid().nullable(),
  actorName: z.string(),
  type: z.string(),
  summary: z.string(),
  at: z.string(),
  route: z.string().nullable(),
})
export type OwnerActivity = z.infer<typeof activitySchema>
export const proposalInputSchema = z
  .object({
    invoiceId: z.guid(),
    proposedTotal: money,
    reason: z.string().trim().min(10).max(2000),
    evidence: z.array(z.string()).max(3),
  })
  .strict()
export const proposalSchema = proposalInputSchema.extend({
  id: z.guid(),
  ownerId: z.guid(),
  branchId: z.guid(),
  contractTenantId: z.guid(),
  billingMonth: z.string(),
  requesterId: z.guid(),
  requesterName: z.string(),
  createdAt: z.string(),
  originalTotal: money,
  fingerprint: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  executionStatus: z.literal('NOT_APPLIED'),
  history: z.array(z.object({ at: z.string(), actor: z.string(), note: z.string() })),
})
export type InvoiceAdjustmentProposal = z.infer<typeof proposalSchema>
export const summaryRowSchema = managerSummarySchema.extend({
  slots: managerSummarySchema.shape.slots.extend({ unavailable: z.number().int().nonnegative() }),
  id: z.guid(),
  roomCount: z.number().int().nonnegative(),
  name: z.string(),
  status: z.string(),
  managerName: z.string().nullable(),
  invoiceCount: z.number(),
  bookingCount: z.number(),
  maintenanceCount: z.number(),
  exceptions: z.number(),
  prepaidReceived: money,
  prepaidApplied: money,
  prepaidUnused: money,
  holdReceived: money,
  holdSandbox: money,
  unmatched: money,
})
export const ownerSummarySchema = z.object({
  period: z.string(),
  rows: z.array(summaryRowSchema),
  pendingApprovals: z.number(),
  totals: z.object({
    billed: money,
    receipts: money,
    sandboxReceipts: money,
    debt: money,
    overdue: money,
    overdueCount: z.number(),
    invoiceCount: z.number(),
    activeContracts: z.number(),
    activeTenancies: z.number(),
    bookingCount: z.number(),
    maintenanceCount: z.number(),
    exceptions: z.number(),
    prepaidReceived: money,
    prepaidApplied: money,
    prepaidUnused: money,
    holdReceived: money,
    holdSandbox: money,
    unmatched: money,
  }),
})
export type OwnerSummary = z.infer<typeof ownerSummarySchema>
export const ownerPaymentSchema = managerPaymentSchema.extend({ branchName: z.string() })
export type OwnerPayment = z.infer<typeof ownerPaymentSchema>
export type BranchMetadata = Omit<BranchInput, 'name' | 'address' | 'managerId' | 'status'> & {
  qrPublicId: string | null
  qrUrl: string | null
  version: number
  assignedAt: string | null
}
export type OwnerState = {
  verification: OwnerVerification[]
  metadata: Record<string, BranchMetadata>
  policies: OwnerPolicy[]
  invitations: ManagerInvitation[]
  approvals: InvoiceAdjustmentProposal[]
  activity: OwnerActivity[]
  relationshipDates: Record<string, string>
  notices: string[]
}
