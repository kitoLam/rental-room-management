import { z } from 'zod'

export const tenantLeaseSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  contractNumber: z.string().nullable(),
  contractStatus: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
  status: z.enum(['DRAFT', 'ACTIVE', 'LEFT', 'CANCELLED']),
  branchId: z.string(),
  branchName: z.string(),
  address: z.string().nullable(),
  branchPhone: z.string().nullable(),
  roomId: z.string(),
  roomNumber: z.string(),
  roomSlotIds: z.array(z.string()),
  slotCodes: z.array(z.string()),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  rentAmount: z.number().nullable(),
  representative: z.boolean(),
  contractRentPrice: z.number().nullable(),
  contractDepositAmount: z.number().nullable(),
  terms: z.string().nullable(),
  signedFileUrl: z.string().nullable(),
  signedDate: z.string().nullable(),
})
export const tenantOverviewSchema = z.object({
  generatedAt: z.string(),
  asOfDate: z.string(),
  tenancy: tenantLeaseSchema.nullable(),
  unpaidInvoiceCount: z.number().nullable(),
  nextDueDate: z.string().nullable(),
  nextDueAmount: z.number().nullable(),
  incompleteBalances: z.boolean(),
  openSupportCount: z.number(),
  needsResponseCount: z.number(),
  activeSubscriptions: z.number().nullable(),
  pendingServiceRequests: z.number(),
  recentInvoices: z.array(
    z.object({
      id: z.string(),
      invoiceNumber: z.string().nullable(),
      period: z.string().nullable(),
      dueDate: z.string().nullable(),
      totalAmount: z.number().nullable(),
      remainingAmount: z.number().nullable(),
      status: z.string().nullable(),
    }),
  ),
  recentSupport: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      status: z.string().nullable(),
      updatedAt: z.string().nullable(),
    }),
  ),
  latestPayment: z
    .object({ invoiceId: z.string(), amount: z.number().nullable(), paidAt: z.string() })
    .nullable(),
  notifications: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      message: z.string(),
      detailPath: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
})
export type TenantLease = z.infer<typeof tenantLeaseSchema>
export type TenantOverview = z.infer<typeof tenantOverviewSchema>
