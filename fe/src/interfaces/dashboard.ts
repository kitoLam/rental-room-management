import { z } from 'zod'
import { pageSchema } from './domain'

const count = z.number().int().nonnegative()
const branch = z.object({ id: z.string(), name: z.string() })
const contact = { tenantName: z.string().nullable(), phone: z.string().nullable() }
const location = { branchId: z.string(), branchName: z.string(), roomNumber: z.string() }
export const managementOverviewSchema = z.object({
  period: z.string(),
  asOfDate: z.string(),
  generatedAt: z.string(),
  branchOptions: z.array(branch),
  metrics: z.object({
    occupiedSlots: count,
    availableSlots: count,
    activeTenants: count,
    receipts: z.number(),
  }),
  slots: z.object({
    total: count,
    operational: count,
    occupied: count,
    held: count,
    available: count,
    maintenance: count,
    inactive: count,
  }),
  pending: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      count,
      route: z.string(),
      status: z.string().nullable(),
    }),
  ),
  todaysActivities: pageSchema(
    z.object({
      id: z.string(),
      kind: z.string(),
      action: z.string(),
      label: z.string(),
      at: z.string(),
      ...location,
      subjectName: z.string().nullable(),
      actorAccountId: z.string().nullable(),
      actorName: z.string().nullable(),
      note: z.string().nullable(),
      route: z.string(),
    }),
  ),
  todaysAppointments: z.array(
    z.object({
      id: z.string(),
      ...location,
      ...contact,
      startAt: z.string().nullable(),
      endAt: z.string().nullable(),
      shiftType: z.string().nullable(),
      approvedAt: z.string(),
      approvedBy: z.string().nullable(),
      approvedByName: z.string().nullable(),
    }),
  ),
  upcomingMoveIns: z.array(
    z.object({ id: z.string(), ...location, ...contact, date: z.string(), slotCodes: z.string() }),
  ),
  expiringContracts: pageSchema(
    z.object({
      id: z.string(),
      contractNumber: z.string().nullable(),
      ...location,
      ...contact,
      endDate: z.string(),
      daysRemaining: count,
    }),
  ),
  branches: z.array(
    branch.extend({
      managerName: z.string().nullable(),
      totalRooms: count,
      operationalSlots: count,
      occupiedSlots: count,
      availableSlots: count,
      activeTenants: count,
      receipts: z.number(),
      pendingCount: count,
    }),
  ),
})
export type ManagementOverviewData = z.infer<typeof managementOverviewSchema>

const reportRoom = z.object({
  id: z.string(),
  roomNumber: z.string(),
  branchId: z.string(),
  branchName: z.string(),
  receipts: z.number(),
  receiptShare: z.number(),
  newLeases: count,
  leasedSlots: count,
  unknownSlotContracts: count,
  monthlyReceipts: z.array(z.number()),
})
export const managementReportSchema = z.object({
  fromMonth: z.string(),
  toMonth: z.string(),
  generatedAt: z.string(),
  branchOptions: z.array(branch),
  roomOptions: z.array(z.object({ id: z.string(), branchId: z.string(), roomNumber: z.string() })),
  metrics: z.object({
    receipts: z.number(),
    previousReceipts: z.number(),
    newLeases: count,
    leasedSlots: count,
    unknownSlotContracts: count,
  }),
  months: z.array(z.object({ month: z.string(), receipts: z.number(), newLeases: count })),
  topReceipts: z.array(reportRoom),
  topRentals: z.array(reportRoom),
  rooms: pageSchema(reportRoom),
  branches: z.array(
    branch.extend({
      roomCount: count,
      receipts: z.number(),
      newLeases: count,
      leasedSlots: count,
      unknownSlotContracts: count,
    }),
  ),
})
export type ManagementReportData = z.infer<typeof managementReportSchema>
