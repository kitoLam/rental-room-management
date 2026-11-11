import { managementOverviewSchema } from '@/interfaces/dashboard'
import { provider } from './config'
import { request } from './http'

export const dashboardService = {
  overview(
    role: 'manager' | 'owner',
    month: string,
    branchId?: string,
    expiringPage = 0,
    activityPage = 0,
  ) {
    if (provider(role) !== 'real')
      return Promise.reject(
        new Error(
          'Tổng quan quản lý cần chế độ API thật. Vui lòng cấu hình provider tương ứng là real.',
        ),
      )
    const params = new URLSearchParams({
      month,
      expiringPage: String(expiringPage),
      activityPage: String(activityPage),
    })
    if (branchId) params.set('branchId', branchId)
    return request(role, `/api/v1/dashboard/management?${params}`, managementOverviewSchema)
  },
}
