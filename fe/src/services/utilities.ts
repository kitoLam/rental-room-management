import { z } from 'zod'
import { request, write } from './http'
import { pageSchema, type Page } from '@/interfaces/domain'
import {
  serviceCatalogResponseSchema,
  roomServiceResponseSchema,
  serviceRequestResponseSchema,
  tenantServiceOverviewSchema,
  serviceTenancySchema,
  roomServiceChargeResponseSchema,
  chargeDetailResponseSchema,
  costAllocationProposalResponseSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
  type ServiceCatalogItem,
  type CreateRoomServiceInput,
  type UpdateRoomServiceInput,
  type RoomServiceItem,
  type ServiceRegistrationInput,
  type ServiceTerminationInput,
  type ServiceDateConfirmationInput,
  type ServiceRequestItem,
  type TenantServiceOverview,
  type ServiceTenancy,
  type CreateRoomServiceChargeInput,
  type RoomServiceChargeItem,
  type ChargeDetailItem,
  type CreateCostAllocationProposalInput,
  type ProcessCostAllocationInput,
  type CostAllocationProposalItem,
  type SendNotificationInput,
  type BulkNotificationInput,
} from '@/interfaces/utilities'
import { notificationSchema, type Notification } from '@/interfaces/domain'

export const utilitiesService = {
  // ==========================================
  // 1. SERVICE CATALOG [P1-68]
  // ==========================================
  catalog: {
    list: (
      branchId: string,
      filters: {
        type?: string
        mandatory?: boolean
        active?: boolean
        page?: number
        size?: number
      } = {},
    ): Promise<Page<ServiceCatalogItem>> => {
      const params = new URLSearchParams()
      if (filters.type) params.set('type', filters.type)
      if (filters.mandatory !== undefined) params.set('mandatory', String(filters.mandatory))
      if (filters.active !== undefined) params.set('active', String(filters.active))
      params.set('page', String(filters.page !== undefined ? filters.page : 0))
      params.set('size', String(filters.size !== undefined ? filters.size : 20))

      return request(
        'utilities',
        `/api/branches/${encodeURIComponent(branchId)}/services?${params.toString()}`,
        pageSchema(serviceCatalogResponseSchema),
      )
    },

    get: (serviceId: string): Promise<ServiceCatalogItem> => {
      return request(
        'utilities',
        `/api/services/${encodeURIComponent(serviceId)}`,
        serviceCatalogResponseSchema,
      )
    },

    create: (branchId: string, input: CreateServiceInput): Promise<ServiceCatalogItem> => {
      return request(
        'utilities',
        `/api/branches/${encodeURIComponent(branchId)}/services`,
        serviceCatalogResponseSchema,
        write('POST', input),
      )
    },

    delete: (serviceId: string): Promise<void> => {
      return request(
        'utilities',
        `/api/services/${encodeURIComponent(serviceId)}`,
        z.unknown(),
        write('DELETE'),
      ).then(() => undefined)
    },

    update: (serviceId: string, input: UpdateServiceInput): Promise<ServiceCatalogItem> => {
      return request(
        'utilities',
        `/api/services/${encodeURIComponent(serviceId)}`,
        serviceCatalogResponseSchema,
        write('PUT', input),
      )
    },
  },

  // ==========================================
  // 2. ROOM SERVICES [P1-69]
  // ==========================================
  roomServices: {
    listByBranch: (branchId: string, status?: string): Promise<RoomServiceItem[]> => {
      const q = status ? `?status=${encodeURIComponent(status)}` : ''
      return request(
        'utilities',
        `/api/branches/${encodeURIComponent(branchId)}/room-services${q}`,
        z.array(roomServiceResponseSchema),
      )
    },
    listByRoom: (roomId: string): Promise<RoomServiceItem[]> => {
      return request(
        'utilities',
        `/api/rooms/${encodeURIComponent(roomId)}/services`,
        z.array(roomServiceResponseSchema),
      )
    },

    configure: (branchId: string, input: CreateRoomServiceInput): Promise<RoomServiceItem> => {
      return request(
        'utilities',
        `/api/branches/${encodeURIComponent(branchId)}/room-services`,
        roomServiceResponseSchema,
        write('POST', input),
      )
    },

    update: (roomServiceId: string, input: UpdateRoomServiceInput): Promise<RoomServiceItem> => {
      return request(
        'utilities',
        `/api/room-services/${encodeURIComponent(roomServiceId)}`,
        roomServiceResponseSchema,
        write('PUT', input),
      )
    },
  },

  // ==========================================
  // 3. SERVICE REQUESTS: đăng ký / ngừng dịch vụ
  // ==========================================
  serviceRequests: {
    // Tenant: phòng / chỗ đang thuê và danh mục dịch vụ kèm trạng thái (BE tự xác định từ token).
    tenancy: (): Promise<ServiceTenancy> =>
      request('utilities', '/api/v1/service-requests/tenancy', serviceTenancySchema),

    catalog: (): Promise<TenantServiceOverview[]> =>
      request('utilities', '/api/v1/service-requests/catalog', z.array(tenantServiceOverviewSchema)),

    register: (input: ServiceRegistrationInput): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        '/api/v1/service-requests/registrations',
        serviceRequestResponseSchema,
        write('POST', input),
      ),

    terminate: (input: ServiceTerminationInput): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        '/api/v1/service-requests/terminations',
        serviceRequestResponseSchema,
        write('POST', input),
      ),

    cancel: (id: string, note?: string): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        `/api/v1/service-requests/${encodeURIComponent(id)}/cancellation`,
        serviceRequestResponseSchema,
        write('POST', { note }),
      ),

    // Manager / Owner / Admin
    list: (
      filters: {
        branchId?: string
        status?: string
        action?: string
        keyword?: string
        page?: number
        size?: number
      } = {},
    ): Promise<Page<ServiceRequestItem>> => {
      const params = new URLSearchParams()
      if (filters.branchId) params.set('branchId', filters.branchId)
      if (filters.status) params.set('status', filters.status)
      if (filters.action) params.set('action', filters.action)
      if (filters.keyword) params.set('keyword', filters.keyword)
      params.set('page', String(filters.page ?? 1))
      params.set('size', String(filters.size ?? 8))
      return request(
        'utilities',
        `/api/v1/service-requests?${params.toString()}`,
        pageSchema(serviceRequestResponseSchema),
      )
    },

    approve: (id: string, note?: string): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        `/api/v1/service-requests/${encodeURIComponent(id)}/approval`,
        serviceRequestResponseSchema,
        write('POST', { note }),
      ),

    reject: (id: string, note: string): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        `/api/v1/service-requests/${encodeURIComponent(id)}/rejection`,
        serviceRequestResponseSchema,
        write('POST', { note }),
      ),

    confirmInstallation: (id: string, input: ServiceDateConfirmationInput): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        `/api/v1/service-requests/${encodeURIComponent(id)}/installation-confirmation`,
        serviceRequestResponseSchema,
        write('POST', input),
      ),

    confirmTermination: (id: string, input: ServiceDateConfirmationInput): Promise<ServiceRequestItem> =>
      request(
        'utilities',
        `/api/v1/service-requests/${encodeURIComponent(id)}/termination-confirmation`,
        serviceRequestResponseSchema,
        write('POST', input),
      ),
  },

  // ==========================================
  // 4. METER CHARGES & SERVICE CHARGES [P1-74][P1-75][P1-78]
  // ==========================================
  charges: {
    create: (input: CreateRoomServiceChargeInput): Promise<RoomServiceChargeItem> => {
      return request(
        'utilities',
        '/api/service-charges',
        roomServiceChargeResponseSchema,
        write('POST', input),
      )
    },

    finalize: (chargeIds: string[]): Promise<RoomServiceChargeItem[]> => {
      return request(
        'utilities',
        '/api/service-charges/finalize',
        z.array(roomServiceChargeResponseSchema),
        write('PUT', { chargeIds }),
      )
    },

    get: (chargeId: string): Promise<RoomServiceChargeItem> => {
      return request(
        'utilities',
        `/api/service-charges/${encodeURIComponent(chargeId)}`,
        roomServiceChargeResponseSchema,
      )
    },

    getDetail: (chargeId: string): Promise<ChargeDetailItem> => {
      return request(
        'utilities',
        `/api/service-charges/${encodeURIComponent(chargeId)}/detail`,
        chargeDetailResponseSchema,
      )
    },

    listByRoom: (
      roomId: string,
      billingMonth: string,
      status?: string,
    ): Promise<RoomServiceChargeItem[]> => {
      const params = new URLSearchParams({ billingMonth })
      if (status) params.set('status', status)

      return request(
        'utilities',
        `/api/rooms/${encodeURIComponent(roomId)}/service-charges?${params.toString()}`,
        z.array(roomServiceChargeResponseSchema),
      )
    },
  },

  // ==========================================
  // 5. COST ALLOCATION [P1-79][P1-80][P1-81]
  // ==========================================
  costAllocation: {
    propose: (input: CreateCostAllocationProposalInput): Promise<CostAllocationProposalItem> => {
      return request(
        'utilities',
        '/api/cost-allocations/propose',
        costAllocationProposalResponseSchema,
        write('POST', input),
      )
    },

    process: (
      proposalId: string,
      input: ProcessCostAllocationInput,
    ): Promise<CostAllocationProposalItem> => {
      return request(
        'utilities',
        `/api/cost-allocations/${encodeURIComponent(proposalId)}/process`,
        costAllocationProposalResponseSchema,
        write('PUT', input),
      )
    },

    get: (proposalId: string): Promise<CostAllocationProposalItem> => {
      return request(
        'utilities',
        `/api/cost-allocations/${encodeURIComponent(proposalId)}`,
        costAllocationProposalResponseSchema,
      )
    },

    listByCharge: (chargeId: string, status?: string): Promise<CostAllocationProposalItem[]> => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const q = params.toString() ? `?${params.toString()}` : ''

      return request(
        'utilities',
        `/api/service-charges/${encodeURIComponent(chargeId)}/allocations${q}`,
        z.array(costAllocationProposalResponseSchema),
      )
    },

    calculateDefault: (chargeId: string): Promise<unknown> => {
      return request(
        'utilities',
        `/api/service-charges/${encodeURIComponent(chargeId)}/default-allocation`,
        z.unknown(),
      )
    },
  },

  // ==========================================
  // 6. NOTIFICATION DISPATCH [P1-123][P1-124]
  // ==========================================
  notifications: {
    send: (input: SendNotificationInput): Promise<Notification> => {
      return request(
        'notifications',
        '/api/notifications/send',
        notificationSchema,
        write('POST', input),
      )
    },

    sendBulk: (input: BulkNotificationInput): Promise<Notification[]> => {
      return request(
        'notifications',
        '/api/notifications/send-bulk',
        z.array(notificationSchema),
        write('POST', input),
      )
    },
  },
}
