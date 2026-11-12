import { z } from 'zod'
import { tenantLeaseSchema, tenantOverviewSchema } from '@/interfaces/tenant-overview'
import { request } from './http'

export const tenantOverviewService = {
  tenancies: () =>
    request('tenant', '/api/v1/dashboard/tenant/tenancies', z.array(tenantLeaseSchema)),
  overview: (tenancyId?: string) =>
    request(
      'tenant',
      `/api/v1/dashboard/tenant${tenancyId ? `?${new URLSearchParams({ tenancyId })}` : ''}`,
      tenantOverviewSchema,
    ),
}
