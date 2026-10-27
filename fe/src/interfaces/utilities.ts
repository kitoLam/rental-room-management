import { z } from 'zod'

const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid UUID')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const vnd = z.number().nonnegative()

// ==========================================
// 1. SERVICE CATALOG [P1-68]
// ==========================================

export const serviceTypeEnum = z.enum([
  'ELECTRICITY',
  'WATER',
  'INTERNET',
  'PARKING',
  'CLEANING',
  'SECURITY',
  'OTHER',
])
export type ServiceType = z.infer<typeof serviceTypeEnum>

export const billingMethodEnum = z.enum([
  'METERED',
  'PER_PERSON',
  'PER_ROOM',
  'FIXED',
  'PER_USE',
])
export type BillingMethod = z.infer<typeof billingMethodEnum>

export const createServiceInputSchema = z.object({
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(30),
  serviceType: serviceTypeEnum,
  billingMethod: billingMethodEnum,
  referencePrice: vnd,
  mandatory: z.boolean().optional().default(false),
})
export type CreateServiceInput = z.infer<typeof createServiceInputSchema>

export const updateServiceInputSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  billingMethod: billingMethodEnum.optional(),
  referencePrice: vnd.optional(),
  active: z.boolean().optional(),
})
export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>

export const serviceCatalogResponseSchema = z
  .object({
    id: z.string(),
    branchId: z.string().optional(),
    code: z.string(),
    name: z.string(),
    unit: z.string().optional().default('tháng'),
    serviceType: serviceTypeEnum.optional().default('OTHER'),
    billingMethod: billingMethodEnum.optional().default('FIXED'),
    referencePrice: z.coerce.number().optional().default(0),
    mandatory: z.coerce.boolean().optional().default(false),
    active: z.coerce.boolean().optional().default(true),
  })
  .passthrough()
export type ServiceCatalogItem = z.infer<typeof serviceCatalogResponseSchema>

// ==========================================
// 2. ROOM SERVICE CONFIGURATION [P1-69]
// ==========================================

export const roomServiceStatusEnum = z.enum(['ACTIVE', 'ENDED'])
export type RoomServiceStatus = z.infer<typeof roomServiceStatusEnum>

export const createRoomServiceInputSchema = z.object({
  roomId: uuid,
  serviceId: uuid,
  startDate: date,
  endDate: date,
  unitPrice: vnd,
  billingConfig: z.unknown().optional(),
})
export type CreateRoomServiceInput = z.infer<typeof createRoomServiceInputSchema>

export const updateRoomServiceInputSchema = z.object({
  endDate: date.optional(),
  unitPrice: vnd.optional(),
  billingConfig: z.unknown().optional(),
  status: roomServiceStatusEnum.optional(),
})
export type UpdateRoomServiceInput = z.infer<typeof updateRoomServiceInputSchema>

export const roomServiceResponseSchema = z
  .object({
    id: uuid,
    roomId: uuid.optional(),
    branchId: uuid.optional(),
    serviceId: uuid.optional(),
    serviceName: z.string().optional().default(''),
    mandatory: z.coerce.boolean().optional().default(false),
    unit: z.string().optional().default(''),
    startDate: z.string().optional().default(''),
    endDate: z.string().optional().default(''),
    unitPrice: z.coerce.number().optional().default(0),
    billingConfig: z.unknown().nullable().optional(),
    status: roomServiceStatusEnum.optional().default('ACTIVE'),
  })
  .passthrough()
export type RoomServiceItem = z.infer<typeof roomServiceResponseSchema>

// ==========================================
// 3. CONTRACT SERVICES (OPTIONAL SERVICES) [P1-71][P1-72][P1-73]
// ==========================================

export const contractServiceStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCEL_REQUESTED',
  'CANCELLED',
])
export type ContractServiceStatus = z.infer<typeof contractServiceStatusEnum>

export const contractServiceRegistrationInputSchema = z.object({
  contractId: uuid,
  contractTenantId: uuid.optional(),
  roomServiceId: uuid,
  startDate: date,
  endDate: date,
  agreedUnitPrice: vnd.optional(),
  reason: z.string().optional(),
})
export type ContractServiceRegistrationInput = z.infer<typeof contractServiceRegistrationInputSchema>

export const processContractServiceInputSchema = z.object({
  decision: contractServiceStatusEnum,
  reason: z.string().optional(),
})
export type ProcessContractServiceInput = z.infer<typeof processContractServiceInputSchema>

export const contractServiceResponseSchema = z.object({
  id: uuid,
  contractId: uuid.optional(),
  contractTenantId: uuid.nullable().optional(),
  roomId: uuid.nullable().optional(),
  roomServiceId: uuid.optional(),
  serviceName: z.string().optional().default(''),
  startDate: z.string().optional().default(''),
  endDate: z.string().nullable().optional(),
  agreedUnitPrice: z.coerce.number().nullable().optional(),
  status: contractServiceStatusEnum.optional().default('PENDING'),
  requestedBy: uuid.nullable().optional(),
  processedBy: uuid.nullable().optional(),
  processedAt: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
}).passthrough()
export type ContractServiceItem = z.infer<typeof contractServiceResponseSchema>

// ==========================================
// 4. METER CHARGES & SERVICE CHARGES [P1-74][P1-75][P1-78]
// ==========================================

export const chargeSegmentReasonEnum = z.enum([
  'NORMAL',
  'METER_RESET',
  'METER_REPLACED',
  'RATE_CHANGE',
  'MID_MONTH_TENANCY',
  'ADJUSTMENT',
])
export type ChargeSegmentReason = z.infer<typeof chargeSegmentReasonEnum>

export const roomServiceChargeStatusEnum = z.enum(['DRAFT', 'FINALIZED', 'CANCELLED'])
export type RoomServiceChargeStatus = z.infer<typeof roomServiceChargeStatusEnum>

export const createRoomServiceChargeInputSchema = z.object({
  roomServiceId: uuid,
  billingMonth: date,
  startDate: date,
  endDate: date,
  segmentNumber: z.number().int().min(1),
  meterReference: z.string().optional(),
  segmentReason: chargeSegmentReasonEnum,
  startReading: z.number().optional(),
  endReading: z.number().optional(),
  quantity: z.number().optional(),
  unitPrice: vnd,
})
export type CreateRoomServiceChargeInput = z.infer<typeof createRoomServiceChargeInputSchema>

export const finalizeChargeInputSchema = z.object({
  chargeIds: z.array(uuid),
})
export type FinalizeChargeInput = z.infer<typeof finalizeChargeInputSchema>

export const roomServiceChargeResponseSchema = z.object({
  id: uuid,
  roomServiceId: uuid,
  roomId: uuid,
  serviceName: z.string(),
  billingMonth: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  segmentNumber: z.number(),
  meterReference: z.string().nullable().optional(),
  segmentReason: chargeSegmentReasonEnum,
  startReading: z.number().nullable().optional(),
  endReading: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unitPrice: z.number(),
  totalAmount: z.number(),
  calculationSnapshot: z.unknown().nullable().optional(),
  evidenceRefs: z.unknown().nullable().optional(),
  status: roomServiceChargeStatusEnum,
  finalizedBy: uuid.nullable().optional(),
  finalizedAt: z.string().nullable().optional(),
})
export type RoomServiceChargeItem = z.infer<typeof roomServiceChargeResponseSchema>

export const chargeDetailResponseSchema = z.object({
  charge: roomServiceChargeResponseSchema,
  roomServiceName: z.string(),
  serviceType: serviceTypeEnum,
  billingMethod: billingMethodEnum,
  formulaDescription: z.string(),
  calculationDetails: z.unknown().nullable().optional(),
})
export type ChargeDetailItem = z.infer<typeof chargeDetailResponseSchema>

// ==========================================
// 5. COST ALLOCATION PROPOSALS [P1-79][P1-80][P1-81]
// ==========================================

export const allocationMethodEnum = z.enum([
  'EQUAL_SPLIT',
  'RESIDENT_DAYS',
  'MANUAL_PERCENTAGE',
  'CUSTOM',
])
export type AllocationMethod = z.infer<typeof allocationMethodEnum>

export const costAllocationProposalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED'])
export type CostAllocationProposalStatus = z.infer<typeof costAllocationProposalStatusEnum>

export const createCostAllocationProposalInputSchema = z.object({
  roomServiceChargeId: uuid,
  method: allocationMethodEnum,
  allocationDetails: z.unknown(),
  reason: z.string().optional(),
})
export type CreateCostAllocationProposalInput = z.infer<
  typeof createCostAllocationProposalInputSchema
>

export const processCostAllocationInputSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
})
export type ProcessCostAllocationInput = z.infer<typeof processCostAllocationInputSchema>

export const costAllocationProposalResponseSchema = z.object({
  id: uuid,
  roomServiceChargeId: uuid,
  method: allocationMethodEnum,
  allocationDetails: z.unknown(),
  calculationSnapshot: z.unknown().nullable().optional(),
  reason: z.string().nullable().optional(),
  proposedBy: uuid,
  status: costAllocationProposalStatusEnum,
  processedBy: uuid.nullable().optional(),
  processedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
})
export type CostAllocationProposalItem = z.infer<typeof costAllocationProposalResponseSchema>

// ==========================================
// 6. NOTIFICATION DISPATCH [P1-123][P1-124]
// ==========================================

export const notificationChannelEnum = z.enum(['IN_APP', 'EMAIL', 'SMS', 'ZALO'])
export type NotificationChannel = z.infer<typeof notificationChannelEnum>

export const sendNotificationInputSchema = z.object({
  recipientUserId: uuid,
  type: z.string().min(1),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  referenceType: z.string().optional(),
  referenceId: uuid.optional(),
  channel: notificationChannelEnum.optional().default('IN_APP'),
})
export type SendNotificationInput = z.input<typeof sendNotificationInputSchema>

export const bulkNotificationInputSchema = z.object({
  recipientUserIds: z.array(uuid).min(1),
  type: z.string().min(1),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  referenceType: z.string().optional(),
  referenceId: uuid.optional(),
  channel: notificationChannelEnum.optional().default('IN_APP'),
})
export type BulkNotificationInput = z.input<typeof bulkNotificationInputSchema>
