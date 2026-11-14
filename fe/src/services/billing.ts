import { z } from 'zod'
import { pageSchema } from '@/interfaces/domain'
import { request, write } from './http'

/** Monthly invoices of contracts (BE module invoice). Always talks to the real backend. */

const money = z.coerce.number()

export const invoiceStatusSchema = z.enum([
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
])
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>

export const invoiceItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  roomId: z.string().nullish(),
  roomSlotId: z.string().nullish(),
  description: z.string().nullish(),
  fromDate: z.string().nullish(),
  toDate: z.string().nullish(),
  quantity: money.nullish(),
  unitPrice: money.nullish(),
  amount: money,
  warning: z.string().nullish(),
})
export type InvoiceItem = z.infer<typeof invoiceItemSchema>

export const billingInvoiceSchema = z.object({
  id: z.string().nullish(),
  contractId: z.string().nullish().transform((v) => v ?? ''),
  tenantId: z.string().nullish(),
  branchId: z.string().nullish(),
  roomId: z.string().nullish(),
  roomNumber: z.string().nullish(),
  roomSlotId: z.string().nullish(),
  slotCode: z.string().nullish(),
  tenantName: z.string().nullish(),
  contractNumber: z.string().nullish(),
  invoiceNumber: z.string().nullish(),
  period: z.string(),
  kind: z.enum(['MONTHLY', 'SUPPLEMENTARY']).nullish(),
  issueDate: z.string().nullish(),
  dueDate: z.string().nullish(),
  discountAmount: money.nullish(),
  totalAmount: money,
  paidAmount: money.nullish(),
  remainingAmount: money.nullish(),
  status: invoiceStatusSchema,
  items: z.array(invoiceItemSchema),
})
export type BillingInvoice = z.infer<typeof billingInvoiceSchema>

export const billingContractSchema = z.object({
  id: z.string(),
  contractNumber: z.string().nullish(),
  roomId: z.string().nullish(),
  roomSlotIds: z.array(z.string()).nullish(),
  tenantName: z.string().nullish(),
  roomAddress: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  firstBillingStartDate: z.string().nullish(),
  rentPrice: money.nullish(),
  paymentDueDay: z.number().nullish(),
  status: z.string(),
})
export type BillingContract = z.infer<typeof billingContractSchema>

const roomSchema = z.object({ id: z.string(), roomNumber: z.string().nullish() })

const generateResultSchema = z.object({
  created: z.array(billingInvoiceSchema),
  regenerated: z.array(billingInvoiceSchema),
  skipped: z.array(z.object({ contractId: z.string(), reason: z.string() })),
  failed: z.array(z.object({ contractId: z.string(), error: z.string().nullish() })),
})
export type GenerateResult = z.infer<typeof generateResultSchema>

const slotEstimateSchema = z.object({
  contractId: z.string(),
  contractNumber: z.string().nullish(),
  roomSlotId: z.string().nullish(),
  slotCode: z.string().nullish(),
  tenantName: z.string().nullish(),
  stayFrom: z.string(),
  stayTo: z.string(),
  rentAmount: money,
  roomServiceAmount: money,
  electricityAmount: money,
  slotServiceAmount: money,
  totalAmount: money,
  electricityUnchanged: z.boolean(),
  warnings: z.array(z.string()),
  items: z.array(invoiceItemSchema),
})
export type SlotEstimate = z.infer<typeof slotEstimateSchema>

const estimateSchema = z.object({
  branchId: z.string(),
  period: z.string(),
  currentPeriod: z.string(),
  invoicedCount: z.number(),
  totalAmount: money,
  rooms: z.array(
    z.object({
      roomId: z.string(),
      roomNumber: z.string().nullish(),
      title: z.string().nullish(),
      occupants: z.number(),
      totalAmount: money,
      slots: z.array(slotEstimateSchema),
    }),
  ),
})
export type InvoiceEstimate = z.infer<typeof estimateSchema>

const confirmResultSchema = z.object({
  created: z.array(billingInvoiceSchema),
  skippedContractIds: z.array(z.string()),
})

const paymentUrlSchema = z.object({ paymentUrl: z.string() })

/** VNPay rejects amounts under 5.000 ₫. */
export const MIN_ONLINE_PAYMENT = 5000

export const PAYABLE: InvoiceStatus[] = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']

export const billingApi = {
  // ----- tenant
  myInvoices: async () =>
    (
      await request(
        'tenant',
        '/api/v1/invoices/my?page=1&size=100&sort=period,desc',
        pageSchema(billingInvoiceSchema),
      )
    ).content,
  myContracts: async () =>
    (await request('tenant', '/api/v1/contracts?page=1&size=100', pageSchema(billingContractSchema)))
      .content,
  invoice: (feature: 'tenant' | 'manager', id: string) =>
    request(feature, `/api/v1/invoices/${encodeURIComponent(id)}`, billingInvoiceSchema),
  /** Starts a VNPay payment for the unpaid part and returns the gateway URL. */
  payOnline: (invoice: BillingInvoice) =>
    request(
      'tenant',
      '/api/v1/vnpay/create-payment',
      paymentUrlSchema,
      write('POST', {
        amount: invoice.remainingAmount ?? invoice.totalAmount,
        invoiceId: invoice.id,
        orderInfo: `Thanh toan hoa don ${invoice.invoiceNumber ?? ''} ky ${invoice.period}`,
      }),
    ),

  // ----- staff (owner / manager / admin)
  /** Invoices of one branch for a month, sorted by room then slot. */
  branchInvoices: (branchId: string, period: string) =>
    request('manager', `/api/v1/invoices?${new URLSearchParams({ branchId, period })}`, z.array(billingInvoiceSchema)),
  /** Preview (not stored) for slots without an invoice for the month yet. */
  estimate: (branchId: string, period: string) =>
    request('manager', `/api/v1/invoices/estimate?${new URLSearchParams({ branchId, period })}`, estimateSchema),
  /** contractIds omitted = every pending slot of the branch. */
  confirmEstimate: (branchId: string, period: string, contractIds?: string[]) =>
    request('manager', '/api/v1/invoices/estimate/confirm', confirmResultSchema,
      write('POST', { branchId, period, contractIds: contractIds ?? [] })),
  invoicesOfMonth: async (period: string) =>
    (
      await request(
        'manager',
        `/api/v1/invoices?${new URLSearchParams({ period, page: '1', size: '100' })}`,
        pageSchema(billingInvoiceSchema),
      )
    ).content,
  contracts: async () =>
    (await request('manager', '/api/v1/contracts?page=1&size=100', pageSchema(billingContractSchema)))
      .content,
  rooms: async () =>
    (await request('manager', '/api/v1/rooms?page=1&size=100', pageSchema(roomSchema))).content,
  createForContract: (contractId: string, period: string, dryRun: boolean) =>
    request(
      'manager',
      `/api/v1/invoices/contracts/${encodeURIComponent(contractId)}`,
      billingInvoiceSchema,
      write('POST', { period, dryRun }),
    ),
  generateMonth: (period: string) =>
    request('manager', '/api/v1/invoices/generate', generateResultSchema, write('POST', { period })),
  issue: (id: string) =>
    request('manager', `/api/v1/invoices/${encodeURIComponent(id)}/issue`, billingInvoiceSchema, write('PATCH')),
  removeDraft: (id: string) =>
    request('manager', `/api/v1/invoices/${encodeURIComponent(id)}`, z.unknown(), write('DELETE')),
}

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  DRAFT: 'Nháp',
  ISSUED: 'Chờ thanh toán',
  PARTIALLY_PAID: 'Trả một phần',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Đã huỷ',
}

export const invoiceStatusTone: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  ISSUED: 'warning',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
}

export const itemTypeLabel: Record<string, string> = {
  ROOM_RENT: 'Tiền phòng',
  ROOM_SERVICE: 'Dịch vụ phòng',
  PERSONAL_SERVICE: 'Dịch vụ cá nhân',
  ELECTRICITY: 'Tiền điện',
  SLOT_SERVICE: 'Dịch vụ tự chọn',
  DEPOSIT: 'Tiền cọc',
  PENALTY: 'Phụ thu',
  OTHER: 'Khác',
  DISCOUNT: 'Giảm trừ',
}

/** "2026-11" -> "Tháng 11/2026" */
export function periodLabel(period: string) {
  const [year, month] = period.split('-')
  return `Tháng ${month}/${year}`
}

/** Current month as yyyy-MM in local time. */
export function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** "2026-11-05" -> "05/11/2026" without timezone shifts. */
export function dayLabel(value?: string | null) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
