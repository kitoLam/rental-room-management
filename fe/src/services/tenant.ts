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
} from '@/interfaces/tenant'

import { provider } from './config'
import { utilitiesService } from './utilities'
import type {
  ContractServiceRegistrationInput,
  CreateCostAllocationProposalInput,
} from '@/interfaces/utilities'

const path = (id: string, resource: string) =>
  `/api/tenant/tenancies/${encodeURIComponent(id)}/${resource}`
export const tenantApi = {
  manualPay: (id: string, invoiceId: string, value: unknown) => request('tenant', path(id, `invoices/${encodeURIComponent(invoiceId)}/manual-payments`), tenantPaymentSchema, write('POST', value)),
  prepay: (id: string, value: unknown) =>
    request('tenant', path(id, 'prepaid-payments'), tenantPaymentSchema, write('POST', value)),
  tenancies: () => request('tenant', '/api/tenant/tenancies', z.array(tenancySchema)),
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
  services: (id: string) => request('tenant', path(id, 'services'), z.array(serviceSchema)),
  registerService: async (id: string, value: unknown) => {
    if (provider('utilities') === 'real') {
      const item = await utilitiesService.contractServices.register(
        value as ContractServiceRegistrationInput,
      )
      return {
        id: item.id,
        name: item.serviceName,
        mandatory: false,
        unit: '',
        unitPrice: item.agreedUnitPrice,
        subscriptionId: item.id,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.reason || '',
        history: [],
      }
    }
    return request('tenant', path(id, 'services'), serviceSchema, write('POST', value))
  },
  cancelService: async (id: string, serviceId: string) => {
    if (provider('utilities') === 'real') {
      const item = await utilitiesService.contractServices.cancel(serviceId)
      return {
        id: item.id,
        name: item.serviceName,
        mandatory: false,
        unit: '',
        unitPrice: item.agreedUnitPrice,
        subscriptionId: item.id,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.reason || '',
        history: [],
      }
    }
    return request(
      'tenant',
      path(id, `services/${encodeURIComponent(serviceId)}/cancel`),
      serviceSchema,
      write('POST'),
    )
  },
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
