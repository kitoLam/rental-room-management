import { z } from 'zod'
import { roomSchema, appointmentSchema, bookingSchema } from './domain'
import {
  tenancySchema,
  invoiceSchema,
  serviceSchema,
  chargeSchema,
  proposalSchema,
  reportSchema,
  attachmentSchema,
} from './tenant'

export const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid UUID'),
  date = z.iso.date(),
  vnd = z.number().int().nonnegative().max(1000000000000),
  text = z.string().trim().min(1).max(2000)
export const branchAssignmentSchema = z.object({
  id: uuid,
  ownerId: uuid,
  managerId: uuid.nullable(),
  name: text,
  address: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
  managerName: z.string(),
  zaloUrl: z.string().nullable(),
  zaloEnabled: z.boolean(),
})
export type ManagerBranch = z.infer<typeof branchAssignmentSchema>
export const roomInputSchema = z.object({
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(3).max(150),
  roomTypeId: uuid,
  rentalMode: z.enum(['ROOM', 'SLOT']),
  capacity: z.number().int().min(1).max(30),
  sizeM2: z.number().positive().max(1000).nullable(),
  floor: z.number().int().min(0).max(100).nullable(),
  price: vnd,
  description: z.string().max(3000),
  amenities: z.array(z.string().trim().min(1).max(80)).max(20),
  images: z.array(z.string().max(1400000)).max(6),
  operationalStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
  isPublic: z.boolean(),
})
export const managerRoomSchema = roomSchema.extend({
  isPublic: z.boolean(),
  availability: z.enum(['AVAILABLE', 'HELD', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']).nullable(),
  occupiedResources: z.number().int().nullable(),
  heldResources: z.number().int().nullable(),
})
export type ManagerRoom = z.infer<typeof managerRoomSchema>
export const roomTypeInputSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(100),
  defaultCapacity: z.number().int().min(1).max(30),
  description: z.string().max(1000),
  active: z.boolean(),
})
export const managerRoomTypeSchema = roomTypeInputSchema.extend({ id: uuid, branchId: uuid })
export type ManagerRoomType = z.infer<typeof managerRoomTypeSchema>
export const slotInputSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(100),
  operationalStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
})
export const slotSchema = slotInputSchema.extend({
  id: uuid,
  roomId: uuid,
  branchId: uuid,
  availability: z.string().nullable(),
  occupancy: z.array(
    z.object({ id: uuid, name: z.string(), startDate: date, endDate: date, status: z.string() }),
  ).nullable(),
})
export type ManagerSlot = z.infer<typeof slotSchema>
export const managerTenancySchema = tenancySchema.extend({
  userName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  sourceBookingId: uuid.nullable(),
})
export type ManagerTenancy = z.infer<typeof managerTenancySchema>
export const contractInputSchema = z.object({
  code: z.string().trim().min(3).max(50),
  roomId: uuid,
  startDate: date,
  endDate: date,
  terms: z.string().trim().min(10).max(4000),
})
export const contractSchema = contractInputSchema.extend({
  roomName: z.string().optional(),
  id: uuid,
  branchId: uuid,
  rentalMode: z.enum(['ROOM', 'SLOT']),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']),
  sourceBookingId: uuid.nullable(),
  representativeName: z.string().nullable(),
  tenantCount: z.number().int(),
  history: z.array(z.object({ at: z.string(), actor: z.string(), note: z.string() })),
})
export type ManagerContract = z.infer<typeof contractSchema>
export const tenancyInputSchema = z.object({
  userId: uuid,
  roomSlotId: uuid.nullable(),
  role: z.enum(['REPRESENTATIVE', 'MEMBER']),
  startDate: date,
  endDate: date,
  monthlyRent: vnd,
  firstMonthRent: vnd,
  lastMonthRent: vnd,
  prepaidFirstRequired: vnd,
  prepaidLastRequired: vnd,
  terms: z.string().trim().min(5).max(3000),
})
export const serviceCatalogInputSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: text,
  unit: z.string().trim().min(1).max(30),
  type: z.enum(['ELECTRICITY', 'WATER', 'INTERNET', 'PARKING', 'CLEANING', 'SECURITY', 'OTHER']),
  billingMethod: z.enum(['METERED', 'PER_PERSON', 'PER_ROOM', 'FIXED', 'PER_USE']),
  unitPrice: vnd,
  mandatory: z.boolean(),
  active: z.boolean(),
})
export const catalogServiceSchema = serviceCatalogInputSchema.extend({ id: uuid, branchId: uuid })
export type CatalogService = z.infer<typeof catalogServiceSchema>
export const roomServiceInputSchema = z.object({
  roomId: uuid,
  serviceId: uuid,
  startDate: date,
  endDate: date,
  unitPrice: vnd,
})
export const roomServiceSchema = roomServiceInputSchema.extend({
  id: uuid,
  branchId: uuid,
  serviceName: z.string(),
  roomName: z.string(),
  status: z.enum(['ACTIVE', 'ENDED']),
})
export type RoomServiceConfig = z.infer<typeof roomServiceSchema>
export const managerServiceRequestSchema = serviceSchema.extend({
  serviceId: uuid,
  contractTenantId: uuid,
  roomId: uuid,
  tenantName: z.string(),
  roomName: z.string(),
})
export const managerChargeSchema = chargeSchema.extend({
  contractTenantId: uuid.nullable(),
  roomId: uuid,
  serviceId: uuid,
  status: z.enum(['DRAFT', 'FINALIZED']),
  roomName: z.string(),
})
export type ManagerCharge = z.infer<typeof managerChargeSchema>
export const segmentInputSchema = z.object({
  startDate: date,
  endDate: date,
  previousReading: z.number().nonnegative().nullable(),
  currentReading: z.number().nonnegative().nullable(),
  quantity: z.number().positive(),
  unitPrice: vnd,
  reason: z.enum(['NORMAL', 'PRICE_CHANGE', 'METER_RESET', 'METER_REPLACEMENT']),
  meterId: uuid.nullable(),
})
export const chargeInputSchema = z.object({
  roomId: uuid,
  serviceId: uuid,
  billingMonth: date,
  segments: z.array(segmentInputSchema).min(1).max(12),
  evidence: z.array(attachmentSchema).max(3),
})
export const managerProposalSchema = proposalSchema.extend({
  invoiceId: uuid.nullable(),
  roomId: uuid,
  tenantName: z.string(),
  chargeName: z.string(),
  sourceAmount: vnd,
  defaultShares: z.array(z.object({ id: uuid, label: z.string(), amount: vnd })),
})
export const managerInvoiceSchema = invoiceSchema.extend({
  tenantName: z.string(),
  roomName: z.string(),
  roomId: uuid,
})
export const invoiceInputSchema = z.object({
  contractTenantId: uuid,
  billingMonth: date,
  dueDate: date,
  rentAmount: vnd,
  rentApprovalNote: z.string().trim().min(10).max(1000),
  sources: z.array(z.object({ type: z.enum(['UTILITY', 'SERVICE', 'REPAIR']), id: uuid })).max(30),
  adjustment: z.number().int().min(-1000000000).max(1000000000),
  adjustmentReason: z.string().max(1000),
  prepaidAmount: vnd,
  prepaidSourcePaymentId: uuid.nullable(),
  prepaidBucket: z.enum(['FIRST_MONTH', 'LAST_MONTH']),
})
export const invoiceSourcesSchema = z.object({
  rentAmount: vnd,
  policyNote: z.string(),
  dueDate: date,
  prepaid: z.array(
    z.object({
      paymentId: uuid,
      bucket: z.enum(['FIRST_MONTH', 'LAST_MONTH']),
      available: vnd,
      label: z.string(),
    }),
  ),
  sources: z.array(
    z.object({
      id: uuid,
      type: z.enum(['UTILITY', 'SERVICE', 'REPAIR']),
      label: z.string(),
      amount: vnd,
      sourceRoute: z
        .string()
        .regex(/^\/manager\/(?:utility-charges|maintenance)\/[0-9a-f-]{36}$/i)
        .optional(),
    }),
  ),
})
export type InvoiceSources = z.infer<typeof invoiceSourcesSchema>
export const managerPaymentSchema = z.object({
  id: uuid,
  branchId: uuid,
  reference: z.string(),
  targetType: z.enum(['BOOKING_HOLD', 'INVOICE', 'PREPAID_RENT']),
  invoiceId: uuid.nullable(),
  bookingId: uuid.nullable(),
  contractTenantId: uuid.nullable(),
  payerName: z.string(),
  tenantName: z.string(),
  amountReceived: vnd,
  allocatedAmount: vnd,
  prepaidFirstApplied: vnd.optional(),
  prepaidLastApplied: vnd.optional(),
  environment: z.enum(['SANDBOX', 'LIVE', 'PRODUCTION']),
  method: z.string(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'REVIEW']),
  createdAt: z.string(),
  verifiedAt: z.string().nullable(),
  providerTransactionId: z.string().nullable(),
  evidence: z.array(z.string()),
  note: z.string(),
  history: z.array(z.object({ at: z.string(), actor: z.string(), note: z.string() })),
})
export type ManagerPayment = z.infer<typeof managerPaymentSchema>
export const warrantyInputSchema = z.object({
  provider: text,
  reference: z.string().trim().min(2).max(100),
  startDate: date,
  endDate: date,
  terms: z.string().max(2000),
})
export const warrantySchema = warrantyInputSchema.extend({ id: uuid })
export const assetInputSchema = z.object({
  roomId: uuid,
  roomSlotId: uuid.nullable(),
  code: z.string().trim().min(2).max(40),
  name: text,
  category: z.string().trim().min(2).max(50),
  serial: z.string().max(100),
  purchaseDate: date,
  value: vnd,
  condition: z.string().min(2).max(100),
  operationalStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
})
export const assetSchema = assetInputSchema.extend({
  id: uuid,
  branchId: uuid,
  warranties: z.array(warrantySchema),
})
export type ManagerAsset = z.infer<typeof assetSchema>
export const managerReportSchema = reportSchema.extend({
  roomId: uuid,
  roomName: z.string(),
  tenantName: z.string(),
})
export const recordInputSchema = z.object({
  description: z.string().trim().min(5).max(2000),
  cost: vnd,
  responsibleParty: z.enum(['OWNER', 'TENANT']).nullable(),
  evidence: z.array(attachmentSchema).max(3),
})
export const reportSummarySchema = z.object({
  period: z.string(),
  rooms: z.object({
    total: z.number(),
    available: z.number(),
    occupied: z.number(),
    held: z.number(),
    maintenance: z.number(),
  }),
  slots: z.object({
    total: z.number(),
    occupied: z.number(),
    held: z.number(),
    available: z.number(),
  }),
  billed: vnd,
  receipts: vnd,
  sandboxReceipts: vnd,
  debt: vnd,
  overdue: vnd,
  overdueCount: z.number(),
  activeContracts: z.number(),
  activeTenancies: z.number(),
  pending: z.array(z.object({ label: z.string(), count: z.number(), route: z.string() })),
  series: z.array(z.object({ period: z.string(), billed: vnd, receipts: vnd, sandbox: vnd })),
  bookingCounts: z.array(z.object({ status: z.string(), count: z.number() })),
  maintenanceCounts: z.array(z.object({ status: z.string(), count: z.number() })),
})
export type ManagerSummary = z.infer<typeof reportSummarySchema>
export const managerSchemas = {
  meters: z.object({ id: uuid, roomId: uuid, serviceId: uuid, branchId: uuid, label: z.string() }),
  rooms: managerRoomSchema,
  'room-types': managerRoomTypeSchema,
  slots: slotSchema,
  tenants: managerTenancySchema,
  appointments: appointmentSchema.extend({
    requesterName: z.string(),
    requesterEmail: z.string(),
    requesterPhone: z.string().nullable(),
  }),
  bookings: bookingSchema.extend({
    requesterName: z.string(),
    requesterEmail: z.string(),
    requesterPhone: z.string().nullable(),
  }),
  contracts: contractSchema,
  services: catalogServiceSchema,
  'room-services': roomServiceSchema,
  'service-requests': managerServiceRequestSchema,
  'utility-charges': managerChargeSchema,
  'cost-allocations': managerProposalSchema,
  invoices: managerInvoiceSchema,
  payments: managerPaymentSchema,
  furnitures: assetSchema,
  maintenance: managerReportSchema,
}
export type ManagerResource = keyof typeof managerSchemas
export type ManagerRecord<K extends ManagerResource> = z.infer<(typeof managerSchemas)[K]>
