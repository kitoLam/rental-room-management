import { z } from 'zod'

const id = z.string().uuid()
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const date = z.iso.date()
export const tenancySchema = z.object({
  id,
  userId: id,
  contractId: id,
  branchId: id,
  roomId: id,
  roomSlotId: id.nullable(),
  branchName: z.string(),
  roomName: z.string(),
  slotName: z.string().nullable(),
  rentalMode: z.enum(['ROOM', 'SLOT']),
  status: z.enum(['DRAFT', 'ACTIVE', 'LEFT', 'CANCELLED']),
  contractStatus: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']),
  code: z.string(),
  role: z.enum(['REPRESENTATIVE', 'MEMBER']),
  startDate: date,
  endDate: date,
  actualLeaveDate: date.nullable(),
  monthlyRent: money,
  firstMonthRent: money,
  lastMonthRent: money,
  prepaidFirstRequired: money,
  prepaidLastRequired: money,
  terms: z.string(),
  sharedTerms: z.string(),
  document: z.object({ name: z.string(), url: z.string().url(), issuedAt: z.string() }).nullable(),
})
export type Tenancy = z.infer<typeof tenancySchema>
export const assetSchema = z.object({
  id,
  name: z.string(),
  category: z.enum(['FURNITURE', 'SERVICE']),
  condition: z.string(),
})
export const tenantRoomSchema = z.object({
  tenancy: tenancySchema,
  images: z.array(z.string()),
  area: z.number(),
  floor: z.number(),
  roomType: z.string(),
  amenities: z.array(z.string()),
  rules: z.array(z.string()),
  manager: z.object({ name: z.string(), phone: z.string() }),
  zaloUrl: z.string().nullable(),
  assets: z.array(assetSchema),
})
export const invoiceSchema = z.object({
  id,
  contractTenantId: id,
  code: z.string(),
  billingMonth: date,
  issuedAt: z.string().nullable(),
  dueDate: date,
  documentStatus: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']),
  items: z.array(
    z.object({
      id,
      label: z.string(),
      type: z.enum(['RENT', 'UTILITY', 'SERVICE', 'REPAIR', 'ADJUSTMENT']),
      amount: z.number().int(),
      snapshot: z.string(),
    }),
  ),
  totalAmount: money,
  prepaidApplied: money,
  prepaidSourcePaymentId: id.nullable(),
  verifiedAllocated: money,
  outstanding: money,
  availableToPay: money,
  financialStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE']),
  manualQr: z.object({ qrUrl: z.string(), resourceId: z.string(), reference: z.string() }).nullable().optional(),
  instructions: z.object({
    environment: z.literal('SANDBOX'),
    reference: z.string(),
    qrUrl: z.string().nullable(),
    text: z.string(),
  }),
})
export type Invoice = z.infer<typeof invoiceSchema>
export const tenantPaymentSchema = z.object({
  id,
  contractTenantId: id,
  invoiceId: id.nullable(),
  reference: z.string(),
  amountReceived: money,
  allocatedAmount: money,
  prepaidFirstAmount: money,
  prepaidLastAmount: money,
  prepaidFirstApplied: money,
  prepaidLastApplied: money,
  payerName: z.string(),
  method: z.enum(['SANDBOX', 'TRANSFER']),
  environment: z.enum(['SANDBOX', 'LIVE']),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'REVIEW']),
  createdAt: z.string(),
  verifiedAt: z.string().nullable(),
  evidence: z.array(z.string()),
})
export type TenantPayment = z.infer<typeof tenantPaymentSchema>
export const serviceSchema = z.object({
  id,
  name: z.string(),
  mandatory: z.boolean(),
  unit: z.string(),
  unitPrice: money,
  subscriptionId: id.nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED']).nullable(),
  startDate: date.nullable(),
  endDate: date.nullable(),
  note: z.string(),
  history: z.array(z.object({ status: z.string(), at: z.string(), note: z.string() })),
})
export type TenantService = z.infer<typeof serviceSchema>
export const participantSchema = z.object({
  id,
  label: z.string(),
  startDate: date,
  endDate: date,
  days: z.number().int().nonnegative(),
  amount: money,
})
export const chargeSchema = z.object({
  id,
  contractTenantId: id,
  name: z.string(),
  billingMonth: date,
  startDate: date,
  endDate: date,
  totalAmount: money,
  myAmount: money,
  invoiceId: id.nullable(),
  snapshot: z.string(),
  evidence: z.array(z.string()),
  segments: z.array(
    z.object({
      id,
      startDate: date,
      endDate: date,
      previousReading: z.number().nullable(),
      currentReading: z.number().nullable(),
      quantity: z.number(),
      unit: z.string(),
      unitPrice: money,
      amount: money,
      reason: z.string(),
      reasonType: z.enum(['NORMAL', 'PRICE_CHANGE', 'METER_RESET', 'METER_REPLACEMENT']).optional(),
      meterId: id.nullable().optional(),
    }),
  ),
  participants: z.array(participantSchema),
})
export type UtilityCharge = z.infer<typeof chargeSchema>
export const proposalSchema = z.object({
  id,
  contractTenantId: id,
  chargeId: id,
  method: z.enum(['RESIDENT_DAYS', 'APPROVED_CUSTOM']),
  reason: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED']),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  decision: z.string().nullable(),
  shares: z.array(z.object({ id, amount: money })),
})
export type AllocationProposal = z.infer<typeof proposalSchema>
export const attachmentSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  size: z.number().int().positive().max(1048576),
  url: z.string().max(1400000),
})
export type Attachment = z.infer<typeof attachmentSchema>
export const reportInputSchema = z.object({
  assetId: id,
  category: z.enum(['FURNITURE', 'SERVICE']),
  title: z.string().trim().min(5, 'Tiêu đề cần ít nhất 5 ký tự.').max(120),
  description: z.string().trim().min(15, 'Mô tả cần ít nhất 15 ký tự.').max(2000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  attachments: z.array(attachmentSchema).max(3),
})
export type ReportInput = z.infer<typeof reportInputSchema>
export const reportSchema = reportInputSchema.extend({
  id,
  contractTenantId: id,
  assetName: z.string(),
  status: z.enum(['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED']),
  createdAt: z.string(),
  assignedTo: z.string().nullable(),
  records: z.array(
    z.object({
      id,
      at: z.string(),
      status: z.string(),
      description: z.string(),
      performedBy: z.string(),
      evidence: z.array(z.string()),
      cost: money,
      responsibleParty: z.enum(['OWNER', 'TENANT']).nullable(),
      approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).nullable(),
    }),
  ),
})
export type MaintenanceReport = z.infer<typeof reportSchema>
export const paymentInputSchema = z.object({
  amount: z.number().int().positive().max(1000000000),
  payerName: z.string().trim().min(2).max(100),
  idempotencyKey: id,
  outcome: z.enum(['success', 'pending', 'review', 'failure']).default('success'),
})
export const prepaidInputSchema = paymentInputSchema.extend({
  bucket: z.enum(['FIRST_MONTH', 'LAST_MONTH']),
})
export const serviceInputSchema = z.object({
  serviceId: id,
  startDate: date,
  endDate: date,
  note: z.string().trim().max(500),
})
export const proposalInputSchema = z.object({
  chargeId: id,
  method: z.enum(['RESIDENT_DAYS', 'APPROVED_CUSTOM']),
  reason: z.string().trim().min(10).max(1000),
  shares: z
    .array(z.object({ id, amount: money }))
    .min(1)
    .max(20),
})
