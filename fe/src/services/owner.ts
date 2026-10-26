import { z } from 'zod'
import { pageSchema, userSchema, type Page } from '@/interfaces/domain'
import {
  activitySchema,
  invitationSchema,
  ownedBranchSchema,
  ownerPaymentSchema,
  ownerPolicySchema,
  ownerSummarySchema,
  proposalSchema,
  relationshipSchema,
  verificationSchema,
} from '@/interfaces/owner'
import { request, write } from './http'
const root = '/api/owner'
const schemas = {
  branches: ownedBranchSchema,
  managers: relationshipSchema,
  invitations: invitationSchema,
  approvals: proposalSchema,
  payments: ownerPaymentSchema,
  activity: activitySchema,
}
export type OwnerResource = keyof typeof schemas
export const ownerApi = {
  branchOptions: async () => {
    const all = [] as z.infer<typeof ownedBranchSchema>[]
    for (let page = 0; ; page++) {
      const data = await request(
        'owner',
        `${root}/branches?size=100&page=${page}`,
        pageSchema(ownedBranchSchema),
      )
      all.push(...data.content)
      if (page + 1 >= data.totalPages) return all
    }
  },
  verification: () => request('owner', `${root}/verification`, verificationSchema),
  submit: (value: unknown) =>
    request('owner', `${root}/verification`, verificationSchema, write('POST', value)),
  branch: (id: string) =>
    request('owner', `${root}/branches/${encodeURIComponent(id)}`, ownedBranchSchema),
  policies: (id: string) =>
    request(
      'owner',
      `${root}/branches/${encodeURIComponent(id)}/policies`,
      z.array(ownerPolicySchema),
    ),
  summary: (params: Record<string, string>) =>
    request('owner', `${root}/summary?${new URLSearchParams(params)}`, ownerSummarySchema),
  list: <K extends OwnerResource>(resource: K, params: Record<string, string> = {}) =>
    request(
      'owner',
      `${root}/${resource}?${new URLSearchParams(params)}`,
      pageSchema(schemas[resource]),
    ) as Promise<Page<z.infer<(typeof schemas)[K]>>>,
  manager: (id: string) =>
    request('owner', `${root}/managers/${encodeURIComponent(id)}`, relationshipSchema),
  invitations: () => request('owner', `${root}/my-invitations`, z.array(invitationSchema)),
  accept: (id: string) =>
    request(
      'owner',
      `${root}/my-invitations/${encodeURIComponent(id)}/accept`,
      z.object({ invitation: invitationSchema, user: userSchema }),
      write('POST', {}),
    ),
  // Proposed missing endpoints fail explicitly in real mode; no fallback.
  mutate: (path: string, value: unknown, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') =>
    request(
      'owner',
      `${root}${path}`,
      z.object({ id: z.string().optional() }).passthrough().nullable(),
      write(method, value),
    ),
  requestAdjustment: (branchId: string, value: unknown) =>
    request(
      'manager',
      `/api/manager/branches/${encodeURIComponent(branchId)}/adjustment-requests`,
      proposalSchema,
      write('POST', value),
    ),
}
