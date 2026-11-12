import { managementOverviewSchema, managementReportSchema } from '@/interfaces/dashboard'
import { provider } from './config'
import { request } from './http'

export const dashboardService = {
  reports(
    role: 'manager' | 'owner',
    filters: {
      fromMonth: string
      toMonth: string
      branchId?: string
      roomId?: string
      page: number
      sort: 'receipts' | 'leases' | 'roomNumber'
    },
  ) {
    if (provider(role) !== 'real')
      return Promise.reject(
        new Error('Báo cáo cần chế độ API thật. Vui lòng cấu hình provider tương ứng là real.'),
      )
    const params = new URLSearchParams({
      fromMonth: filters.fromMonth,
      toMonth: filters.toMonth,
      page: String(filters.page),
      sort: filters.sort,
    })
    if (filters.branchId) params.set('branchId', filters.branchId)
    if (filters.roomId) params.set('roomId', filters.roomId)
    return request(role, `/api/v1/dashboard/reports?${params}`, managementReportSchema)
  },
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
