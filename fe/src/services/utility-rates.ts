import { z } from 'zod'
import { databaseIdSchema, utilityRatesSchema, type UtilityRates } from '@/interfaces/domain'
import { request, write } from './http'

const configurationSchema = z.object({
  roomId: databaseIdSchema,
  branchId: databaseIdSchema,
  roomNumber: z.string(),
  branchName: z.string(),
  configuredRates: utilityRatesSchema,
  branchRates: utilityRatesSchema,
  effectiveRates: utilityRatesSchema,
})

export const utilityRatesService = {
  configuration: (roomId: string) =>
    request('manager', `/api/v1/rooms/${roomId}/utility-rates`, configurationSchema),
  updateBranch: (branchId: string, rates: UtilityRates) =>
    request(
      'manager',
      `/api/v1/branches/${branchId}/utility-rates`,
      utilityRatesSchema,
      write('PUT', rates),
    ),
}
