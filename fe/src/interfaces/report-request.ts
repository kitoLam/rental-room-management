import { z } from 'zod'

export const reportRequestTypeEnum = z.enum([
  'MAINTENANCE',
  'REPAIR',
  'COMPLAINT',
  'SERVICE',
  'FURNITURE',
  'CONTRACT',
  'OTHER',
])
export type ReportRequestType = z.infer<typeof reportRequestTypeEnum>

export const reportRequestPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
export type ReportRequestPriority = z.infer<typeof reportRequestPriorityEnum>

export const reportRequestStatusEnum = z.enum([
  'PENDING',
  'WAITING_INFO',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
  'ESCALATED_ADMIN',
  'CANCELLED',
])
export type ReportRequestStatus = z.infer<typeof reportRequestStatusEnum>

export const reportRecordActionEnum = z.enum([
  'CREATED',
  'ASSIGNED',
  'STATUS_CHANGED',
  'COMMENTED',
  'REQUESTED_INFO',
  'INFO_SUPPLEMENTED',
  'PROGRESS_UPDATED',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
  'REOPENED',
  'ESCALATED_ADMIN',
  'ADMIN_RESOLVED',
  'CANCELLED',
])
export type ReportRecordAction = z.infer<typeof reportRecordActionEnum>

export const reportRecordResponseSchema = z.object({
  id: z.string(),
  reportRequestId: z.string().nullish().default(''),
  actorId: z.string().nullable().optional(),
  actorRole: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  action: z.string(),
  statusFrom: z.string().nullable().optional(),
  statusTo: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  attachments: z.array(z.string()).nullish().transform((v) => v ?? []),
  createdAt: z.string().nullish().transform((v) => v || new Date().toISOString()),
  updatedAt: z.string().nullable().optional(),
})
export type ReportRecordItem = z.infer<typeof reportRecordResponseSchema>

export const reportRequestResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string().nullish().transform((v) => v || ''),
  roomId: z.string().nullish().transform((v) => v || ''),
  branchId: z.string().nullable().optional(),
  contractId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  type: z.string().nullish().transform((v) => (v || 'REPAIR') as ReportRequestType),
  title: z.string().nullish().transform((v) => v || ''),
  content: z.string().nullish().transform((v) => v || ''),
  attachments: z.array(z.string()).nullish().transform((v) => v ?? []),
  priority: z.string().nullish().transform((v) => (v === 'NORMAL' ? 'MEDIUM' : (v || 'MEDIUM')) as ReportRequestPriority),
  rejectReason: z.string().nullable().optional(),
  requestedInfoNote: z.string().nullable().optional(),
  solutionResult: z.string().nullable().optional(),
  disputeReason: z.string().nullable().optional(),
  adminConclusion: z.string().nullable().optional(),
  status: z.string().nullish().transform((v) => {
    if (v === 'OPEN') return 'PENDING'
    if (v === 'ACCEPTED') return 'IN_PROGRESS'
    if (v === 'COMPLETED') return 'RESOLVED'
    return (v || 'PENDING') as ReportRequestStatus
  }),
  resolvedAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  createdAt: z.string().nullish().transform((v) => v || new Date().toISOString()),
  updatedAt: z.string().nullable().optional(),
  timeline: z.array(reportRecordResponseSchema).nullish().transform((v) => v ?? []),
})
export type ReportRequestItem = z.infer<typeof reportRequestResponseSchema>

export interface CreateReportRequestInput {
  tenantId?: string
  roomId: string
  type: ReportRequestType
  title: string
  content: string
  attachments?: string[]
  priority?: ReportRequestPriority
  furnitureIds?: string[]
  serviceIds?: string[]
}

export interface ReportRequestFilter {
  tenantId?: string
  roomId?: string
  branchId?: string
  contractId?: string
  managerId?: string
  type?: ReportRequestType
  priority?: ReportRequestPriority
  status?: ReportRequestStatus
  keyword?: string
  page?: number
  size?: number
}
