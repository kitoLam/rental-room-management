import { z } from 'zod'
import { databaseIdSchema } from './domain'

const count = z.number().int().nonnegative()
const statusCount = z.object({ status: z.string(), count })
export const adminOverviewSchema = z.object({
  year: z.number().int(),
  today: z.string(),
  updatedAt: z.string(),
  metrics: z.object({
    totalAccounts: count,
    activeAccounts: count,
    totalBranches: count,
    activeBranches: count,
    totalRooms: count,
    totalSlots: count,
  }),
  roles: z.array(z.object({ role: z.string(), count })),
  accounts: z.array(statusCount),
  registrations: z.array(z.object({ month: z.number().int().min(1).max(12), count })),
  branches: z.array(statusCount),
  rooms: z.array(statusCount),
  slots: z.array(statusCount),
  recentAccounts: z.array(
    z.object({
      id: databaseIdSchema,
      fullName: z.string().nullable(),
      role: z.string(),
      createdAt: z.string().nullable(),
    }),
  ),
  recentBranches: z.array(
    z.object({
      id: databaseIdSchema,
      name: z.string().nullable(),
      status: z.string(),
      createdAt: z.string().nullable(),
    }),
  ),
})
export type AdminOverview = z.infer<typeof adminOverviewSchema>
