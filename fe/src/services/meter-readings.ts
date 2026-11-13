import { z } from 'zod'
import { utilityRatesSchema, type UtilityRates } from '@/interfaces/domain'
import { request, write } from './http'

/** Electricity: branch rate + per-room monthly meter readings. Always the real backend. */

const money = z.coerce.number()

export const meterReadingSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  period: z.string(),
  startReading: money,
  endReading: money,
  usage: money,
  unitPrice: money,
  amount: money,
  status: z.enum(['DRAFT', 'CONFIRMED']),
  note: z.string().nullish(),
})
export type MeterReading = z.infer<typeof meterReadingSchema>

const boardSchema = z.object({
  branchId: z.string(),
  period: z.string(),
  currentPeriod: z.string(),
  editable: z.boolean(),
  electricityRate: money.nullish(),
  rooms: z.array(
    z.object({
      roomId: z.string(),
      roomNumber: z.string().nullish(),
      title: z.string().nullish(),
      suggestedStartReading: money.nullish(),
      reading: meterReadingSchema.nullish(),
    }),
  ),
})
export type MeterBoard = z.infer<typeof boardSchema>

export const meterReadingApi = {
  board: (branchId: string, period: string) =>
    request('manager', `/api/v1/meter-readings/board?${new URLSearchParams({ branchId, period })}`, boardSchema),
  save: (value: { roomId: string; period: string; startReading?: number | null; endReading: number; note?: string }) =>
    request('manager', '/api/v1/meter-readings', meterReadingSchema, write('PUT', value)),
  confirm: (id: string) =>
    request('manager', `/api/v1/meter-readings/${encodeURIComponent(id)}/confirm`, meterReadingSchema, write('POST')),
  reopen: (id: string) =>
    request('manager', `/api/v1/meter-readings/${encodeURIComponent(id)}/reopen`, meterReadingSchema, write('POST')),
  branchRates: (branchId: string) =>
    request('manager', `/api/v1/branches/${encodeURIComponent(branchId)}/utility-rates`, utilityRatesSchema),
  /** Only the electricity rate changes; the other branch rates are sent back unchanged. */
  updateElectricityRate: async (branchId: string, electricityRate: number) => {
    const current: UtilityRates = await meterReadingApi.branchRates(branchId)
    return request('manager', `/api/v1/branches/${encodeURIComponent(branchId)}/utility-rates`, utilityRatesSchema,
      write('PUT', { ...current, electricityRate }))
  },
}
