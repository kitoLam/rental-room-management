import { z } from 'zod'
import { request, write } from './http'
import {
  tenancySchema,
  tenantRoomSchema,
  invoiceSchema,
  tenantPaymentSchema,
  serviceSchema,
  chargeSchema,
  proposalSchema,
  reportSchema,
  type ReportInput,
  type Tenancy,
  type TenantService,
} from '@/interfaces/tenant'

import { provider } from './config'
import { utilitiesService } from './utilities'
import type {
  CreateCostAllocationProposalInput,
} from '@/interfaces/utilities'

const path = (id: string, resource: string) =>
  `/api/tenant/tenancies/${encodeURIComponent(id)}/${resource}`

// TẠM THỜI: BE chưa có API quan hệ thuê (module contract). Dựng quan hệ thuê tối thiểu từ phòng / chỗ
// mà luồng dịch vụ đang áp dụng để khu vực Tenant hiển thị được. Thay bằng API contract khi có.
async function serviceTenancy(): Promise<Tenancy> {
  const t = await utilitiesService.serviceRequests.tenancy()
  const roomName = t.roomNumber ? `Phòng ${t.roomNumber}` : 'Phòng đang thuê'
  return {
    id: t.contractTenantId ?? t.roomSlotId ?? t.roomId,
    userId: '',
    contractId: t.contractId ?? '',
    branchId: t.branchId,
    roomId: t.roomId,
    roomSlotId: t.roomSlotId ?? null,
    branchName: t.branchName ?? '',
    roomName,
    slotName: t.slotCode ?? null,
    rentalMode: t.roomSlotId ? 'SLOT' : 'ROOM',
    status: 'ACTIVE',
    contractStatus: 'ACTIVE',
    code: t.contractId ?? roomName,
    role: t.representative ? 'REPRESENTATIVE' : 'MEMBER',
    startDate: t.contractStartDate,
    endDate: t.contractEndDate,
    actualLeaveDate: null,
    monthlyRent: 0,
    firstMonthRent: 0,
    lastMonthRent: 0,
    prepaidFirstRequired: 0,
    prepaidLastRequired: 0,
    terms: '',
    sharedTerms: '',
    document: null,
  }
}

export type ServiceRegistrationValue = {
  serviceId: string
  proposedDate: string
  note: string
  contractEndDate: string
}
export type ServiceStopValue = { subscriptionId: string; proposedDate: string; note: string }

export const tenantApi = {
  manualPay: (id: string, invoiceId: string, value: unknown) => request('tenant', path(id, `invoices/${encodeURIComponent(invoiceId)}/manual-payments`), tenantPaymentSchema, write('POST', value)),
  prepay: (id: string, value: unknown) =>
    request('tenant', path(id, 'prepaid-payments'), tenantPaymentSchema, write('POST', value)),
  tenancies: async (): Promise<Tenancy[]> => {
    if (provider('tenant') === 'real') return [await serviceTenancy()]
    return request('tenant', '/api/tenant/tenancies', z.array(tenancySchema))
  },
  room: (id: string) => request('tenant', path(id, 'room'), tenantRoomSchema),
  contract: (id: string, contractId: string) =>
    request('tenant', path(id, `contracts/${encodeURIComponent(contractId)}`), tenancySchema),
  invoices: (id: string) => request('tenant', path(id, 'invoices'), z.array(invoiceSchema)),
  invoice: (id: string, invoiceId: string) =>
    request('tenant', path(id, `invoices/${encodeURIComponent(invoiceId)}`), invoiceSchema),
  payments: (id: string) => request('tenant', path(id, 'payments'), z.array(tenantPaymentSchema)),
  payment: (id: string, paymentId: string) =>
    request('tenant', path(id, `payments/${encodeURIComponent(paymentId)}`), tenantPaymentSchema),
  pay: (id: string, invoiceId: string, value: unknown) =>
    request(
      'tenant',
      path(id, `invoices/${encodeURIComponent(invoiceId)}/payments`),
      tenantPaymentSchema,
      write('POST', value),
    ),
  services: async (id: string): Promise<TenantService[]> => {
    if (provider('utilities') === 'real') {
      // BE tự xác định phòng / chỗ của người thuê từ token, FE không gửi roomId / contractId.
      const items = await utilitiesService.serviceRequests.catalog()
      return items.map((s) => ({
        id: s.serviceId,
        name: s.name,
        mandatory: false,
        unit: s.unit,
        unitPrice: s.subscription?.unitPrice ?? s.unitPrice,
        subscriptionId: s.subscription?.id ?? null,
        requestId: s.openRequest?.id ?? null,
        status: s.displayStatus,
        allowedActions: s.allowedActions,
        startDate: s.subscription?.startDate ?? s.openRequest?.proposedDate ?? null,
        endDate: s.subscription?.endDate ?? null,
        note: '',
        history: [],
      }))
    }
    return request('tenant', path(id, 'services'), z.array(serviceSchema))
  },
  registerService: async (id: string, value: ServiceRegistrationValue) => {
    if (provider('utilities') === 'real') {
      return utilitiesService.serviceRequests.register({
        serviceId: value.serviceId,
        proposedDate: value.proposedDate,
        note: value.note || undefined,
      })
    }
    // Mock engine dùng dạng cũ: khoảng ngày sử dụng trong thời hạn thuê.
    return request(
      'tenant',
      path(id, 'services'),
      serviceSchema,
      write('POST', {
        serviceId: value.serviceId,
        startDate: value.proposedDate,
        endDate: value.contractEndDate,
        note: value.note,
      }),
    )
  },
  stopService: async (id: string, value: ServiceStopValue) => {
    if (provider('utilities') === 'real') {
      return utilitiesService.serviceRequests.terminate({
        subscriptionId: value.subscriptionId,
        proposedDate: value.proposedDate,
        note: value.note || undefined,
      })
    }
    return request(
      'tenant',
      path(id, `services/${encodeURIComponent(value.subscriptionId)}/cancel`),
      serviceSchema,
      write('POST'),
    )
  },
  cancelServiceRequest: async (_id: string, requestId: string) =>
    utilitiesService.serviceRequests.cancel(requestId),
  utilities: (id: string) => request('tenant', path(id, 'utilities'), z.array(chargeSchema)),
  allocations: (id: string) => request('tenant', path(id, 'allocations'), z.array(proposalSchema)),
  propose: async (id: string, value: unknown) => {
    if (provider('utilities') === 'real') {
      const p = await utilitiesService.costAllocation.propose(
        value as CreateCostAllocationProposalInput,
      )
      return {
        id: p.id,
        contractTenantId: p.proposedBy,
        chargeId: p.roomServiceChargeId,
        method: p.method === 'RESIDENT_DAYS' ? 'RESIDENT_DAYS' : ('APPROVED_CUSTOM' as const),
        reason: p.reason || '',
        status: (p.status === 'APPROVED'
          ? 'APPROVED'
          : p.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
        createdAt: p.createdAt || new Date().toISOString(),
        decidedAt: p.processedAt || null,
        decision: p.status === 'PENDING' ? null : p.status,
        shares: [],
      }
    }
    return request('tenant', path(id, 'allocations'), proposalSchema, write('POST', value))
  },
  reports: (id: string) => request('tenant', path(id, 'maintenance'), z.array(reportSchema)),
  report: (id: string, reportId: string) =>
    request('tenant', path(id, `maintenance/${encodeURIComponent(reportId)}`), reportSchema),
  createReport: (id: string, value: ReportInput) =>
    request('tenant', path(id, 'maintenance'), reportSchema, write('POST', value)),
  cancelReport: (id: string, reportId: string) =>
    request(
      'tenant',
      path(id, `maintenance/${encodeURIComponent(reportId)}/cancel`),
      reportSchema,
      write('POST'),
    ),
  reset: () => request('tenant', '/api/tenant/demo/reset', z.null(), write('POST')),
}
