import type { User } from '@/interfaces/domain'
import type { OwnerState } from '@/interfaces/owner'
import type { AdminState } from '@/interfaces/admin'
import type {
  ManagerBranch,
  ManagerContract,
  CatalogService,
  ManagerAsset,
  RoomServiceConfig,
  ManagerCharge,
} from '@/interfaces/manager'
import type { TenantDbState } from './tenant-fixtures'
import type { InventoryState } from './inventory'
import { branches, fixtureId as id } from './fixtures'
import { assetsFor } from './tenant-fixtures'
export const managerUser: User = {
  id: id(7000),
  email: 'manager@tropro.demo',
  fullName: 'Nguyễn Quang Minh',
  roles: ['USER', 'MANAGER'],
  phone: '0900000700',
  gender: null,
  dateOfBirth: null,
  status: 'ACTIVE',
}
export const ownerUser: User = {
  ...managerUser,
  id: id(7001),
  email: 'owner@tropro.demo',
  fullName: 'Phạm Thanh Hà',
  roles: ['USER', 'OWNER'],
}
export const otherManager: User = {
  ...managerUser,
  id: id(7002),
  email: 'manager-other@tropro.demo',
  fullName: 'Vũ Hoàng Anh',
}
export type Audit = { at: string; actor: string; note: string }
export type InvoiceSource = {
  type: 'RENT' | 'UTILITY' | 'SERVICE' | 'REPAIR' | 'PREPAID'
  id: string
  amount: number
  bucket?: 'FIRST_MONTH' | 'LAST_MONTH'
}
export type ManagerState = {
  owner?: OwnerState
  admin?: AdminState
  branches: ManagerBranch[]
  ownerManagers: { ownerId: string; managerId: string }[]
  contracts: ManagerContract[]
  services: CatalogService[]
  roomServices: RoomServiceConfig[]
  charges: ManagerCharge[]
  assets: ManagerAsset[]
  sources: Record<string, InvoiceSource[]>
  rentSchedules: {
    id: string
    contractTenantId: string
    billingMonth: string
    amount: number
    firstMax: number
    lastMax: number
    approvedBy: string
    note: string
  }[]
  paymentMeta: Record<
    string,
    {
      providerTransactionId: string
      expectedReference: string
      amount: number
      history: Audit[]
      note: string
    }
  >
  notices: string[]
}
export function seedManager(tenant: TenantDbState, catalog: InventoryState): ManagerState {
  const bs: ManagerBranch[] = branches.map((b, n) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    ownerId: n === 1 ? id(7003) : ownerUser.id,
    managerId: n === 1 ? otherManager.id : managerUser.id,
    managerName: n === 1 ? otherManager.fullName : managerUser.fullName,
    status: 'ACTIVE',
    zaloUrl: n === 0 ? 'https://zalo.me/g/tropro-demo-room' : null,
    zaloEnabled: n === 0,
  }))
  const contracts: ManagerContract[] = [...new Set(tenant.tenancies.map((t) => t.contractId))].map(
    (contractId) => {
      const ts = tenant.tenancies.filter((t) => t.contractId === contractId),
        t = ts[0]
      return {
        id: contractId,
        branchId: t.branchId,
        roomId: t.roomId,
        rentalMode: t.rentalMode,
        code: t.code,
        startDate: t.startDate,
        endDate: t.endDate,
        terms: t.sharedTerms,
        status: t.contractStatus,
        sourceBookingId: null,
        tenantCount: ts.length,
        representativeName: null,
        history: [
          {
            at: new Date().toISOString(),
            actor: 'Hồ sơ đã duyệt',
            note: 'Hợp đồng mẫu được nhập theo thỏa thuận.',
          },
        ],
      }
    },
  )
  const services: CatalogService[] = bs.flatMap((b, n) =>
    [
      {
        code: 'DIEN',
        name: 'Điện',
        type: 'ELECTRICITY' as const,
        billingMethod: 'METERED' as const,
        unit: 'kWh',
        unitPrice: 3500,
        mandatory: true,
      },
      {
        code: 'NUOC',
        name: 'Nước',
        type: 'WATER' as const,
        billingMethod: 'METERED' as const,
        unit: 'm³',
        unitPrice: 15000,
        mandatory: true,
      },
      {
        code: 'INTERNET',
        name: 'Internet riêng',
        type: 'INTERNET' as const,
        billingMethod: 'FIXED' as const,
        unit: 'tháng',
        unitPrice: 120000,
        mandatory: false,
      },
      {
        code: 'DONPHONG',
        name: 'Dọn phòng',
        type: 'CLEANING' as const,
        billingMethod: 'PER_USE' as const,
        unit: 'lần',
        unitPrice: 80000,
        mandatory: false,
      },
    ].map((s, i) => ({
      ...s,
      id: id(n === 0 ? 5600 + i : 7600 + n * 10 + i),
      branchId: b.id,
      active: true,
    })),
  )
  const roomServices: RoomServiceConfig[] = catalog.rooms.flatMap((r) =>
    services
      .filter((s) => s.branchId === r.branchId)
      .map((s) => ({
        id: crypto.randomUUID(),
        branchId: r.branchId,
        roomId: r.id,
        serviceId: s.id,
        serviceName: s.name,
        roomName: r.title,
        startDate: '2026-01-01',
        endDate: '2030-01-01',
        unitPrice: s.unitPrice,
        status: 'ACTIVE',
      })),
  )
  const assets: ManagerAsset[] = catalog.rooms.flatMap((r) => {
    const ts = tenant.tenancies.filter((t) => t.roomId === r.id)
    const contexts = ts.length
      ? ts
      : [
          {
            roomId: r.id,
            roomSlotId: null,
            rentalMode: r.rentalMode,
          } as (typeof tenant.tenancies)[number],
        ]
    const rows = contexts.flatMap((t) =>
      assetsFor(t)
        .filter((a) => a.category === 'FURNITURE')
        .map((a) => ({
          id: a.id,
          branchId: r.branchId,
          roomId: r.id,
          roomSlotId: a.name.includes('cá nhân') ? t.roomSlotId : null,
          code: `TS-${r.code}-${a.id.slice(-4)}`,
          name: a.name,
          category: 'Nội thất',
          serial: `DEMO-${a.id.slice(-6)}`,
          purchaseDate: '2026-01-01',
          value: 1500000,
          condition: a.condition,
          operationalStatus: 'ACTIVE' as const,
          warranties: [
            {
              id: crypto.randomUUID(),
              provider: 'Trung tâm bảo hành mẫu',
              reference: `BH-${a.id.slice(-5)}`,
              startDate: '2026-01-01',
              endDate: '2027-12-31',
              terms: 'Bảo hành thiết bị theo điều kiện của nhà cung cấp.',
            },
          ],
        })),
    )
    return [...new Map(rows.map((a) => [a.id, a])).values()]
  })
  const rentSchedules: ManagerState['rentSchedules'] = tenant.tenancies.flatMap((t) =>
    [0, 1, 2].map((n) => {
      const now = new Date(),
        month = new Date(Date.UTC(now.getFullYear(), now.getMonth() + n, 1))
          .toISOString()
          .slice(0, 10)
      return {
        id: crypto.randomUUID(),
        contractTenantId: t.id,
        billingMonth: month,
        amount: t.monthlyRent,
        firstMax: t.id === id(5100) && n === 1 ? 3000000 : 0,
        lastMax: 0,
        approvedBy: ownerUser.id,
        note: 'Lịch tiền thuê và hạn mức áp dụng đã được duyệt trong dữ liệu mẫu; không phải công thức tháng lẻ.',
      }
    }),
  )
  const sources: ManagerState['sources'] = {}
  for (const i of tenant.invoices)
    sources[i.id] = i.items.map((item) => ({
      type: item.type === 'REPAIR' ? 'REPAIR' : 'RENT',
      id: item.type === 'REPAIR' ? id(6211) : item.id,
      amount: item.amount,
    }))
  return {
    branches: bs,
    ownerManagers: [
      { ownerId: ownerUser.id, managerId: managerUser.id },
      { ownerId: id(7003), managerId: otherManager.id },
    ],
    contracts,
    services,
    roomServices,
    charges: [],
    assets,
    sources,
    rentSchedules,
    paymentMeta: {},
    notices: [],
  }
}
