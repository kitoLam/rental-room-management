import { adminOverviewSchema } from '@/interfaces/admin-overview'
import { request } from './http'

export const adminOverviewService = {
  read: (year: number) =>
    request('admin', `/api/v1/admin/dashboard?year=${year}`, adminOverviewSchema),
}
