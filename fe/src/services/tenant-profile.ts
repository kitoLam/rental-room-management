import { z } from 'zod'
import { pageSchema } from '@/interfaces/domain'
import { request } from './http'

/** Data for the tenant's profile tabs (payments, contracts). Always the real backend. */

const money = z.coerce.number()

export const myPaymentSchema = z.object({
  id: z.string(),
  bookingId: z.string().nullish(),
  invoiceId: z.string().nullish(),
  amount: money,
  method: z.string().nullish(),
  status: z.string(),
  transactionCode: z.string().nullish(),
  paidAt: z.string().nullish(),
  createdAt: z.string().nullish(),
})
export type MyPayment = z.infer<typeof myPaymentSchema>

export const myContractSchema = z.object({
  id: z.string(),
  contractNumber: z.string().nullish(),
  bookingId: z.string().nullish(),
  roomAddress: z.string().nullish(),
  rentPrice: money.nullish(),
  status: z.string(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  generatedPdf: z.boolean().optional(),
  evidenceSubmittedAt: z.string().nullish(),
  evidenceDeadline: z.string().nullish(),
  evidenceNote: z.string().nullish(),
  createdAt: z.string().nullish(),
})
export type MyContract = z.infer<typeof myContractSchema>

export const tenantProfileApi = {
  payments: () => request('tenant', '/api/v1/payments/mine', z.array(myPaymentSchema)),
  contracts: async () =>
    (
      await request(
        'tenant',
        '/api/v1/contracts?page=1&size=100&sort=createdAt,desc',
        pageSchema(myContractSchema),
      )
    ).content,
}

export const paymentStatusLabel: Record<string, string> = {
  PENDING: 'Đang xử lý',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn',
  LATE_PAID: 'Trả muộn (chờ hoàn)',
}
