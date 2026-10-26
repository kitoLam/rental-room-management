import { z } from 'zod'
import { request, write } from './http'
import { pageSchema, type Page } from '@/interfaces/domain'
import {
  serviceCatalogResponseSchema,
  roomServiceResponseSchema,
  contractServiceResponseSchema,
  roomServiceChargeResponseSchema,
  chargeDetailResponseSchema,
  costAllocationProposalResponseSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
  type ServiceCatalogItem,
  type CreateRoomServiceInput,
  type UpdateRoomServiceInput,
  type RoomServiceItem,
  type ContractServiceRegistrationInput,
  type ProcessContractServiceInput,
  type ContractServiceItem,
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
      params.set('page', String(filters.page !== undefined ? filters.page : 1))
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
  // 3. CONTRACT SERVICES [P1-71][P1-72][P1-73]
  // ==========================================
  contractServices: {
    listByContract: (
      contractId: string,
      status?: string,
    ): Promise<ContractServiceItem[]> => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const q = params.toString() ? `?${params.toString()}` : ''

      return request(
        'utilities',
        `/api/contracts/${encodeURIComponent(contractId)}/services${q}`,
        z.array(contractServiceResponseSchema),
      )
    },

    register: (input: ContractServiceRegistrationInput): Promise<ContractServiceItem> => {
      return request(
        'utilities',
        '/api/contract-services/register',
        contractServiceResponseSchema,
        write('POST', input),
      )
    },

    cancel: (id: string, reason?: string): Promise<ContractServiceItem> => {
      const params = new URLSearchParams()
      if (reason) params.set('reason', reason)
      const q = params.toString() ? `?${params.toString()}` : ''

      return request(
        'utilities',
        `/api/contract-services/${encodeURIComponent(id)}/cancel${q}`,
        contractServiceResponseSchema,
        write('PUT'),
      )
    },

    process: (id: string, input: ProcessContractServiceInput): Promise<ContractServiceItem> => {
      return request(
        'utilities',
        `/api/contract-services/${encodeURIComponent(id)}/process`,
        contractServiceResponseSchema,
        write('PUT', input),
      )
    },
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
