import type {
  Tenancy,
  Invoice,
  TenantPayment,
  TenantService,
  UtilityCharge,
  AllocationProposal,
  MaintenanceReport,
} from '@/interfaces/tenant'
import type { User } from '@/interfaces/domain'
import { fixtureId as id, rooms, branches } from './fixtures'
import { allocateVnd, residentDays } from '@/lib/tenant-finance'

export const tenantUser: User = {
  id: id(5000),
  email: 'tenant@tropro.demo',
  fullName: 'Trần Gia Linh',
  roles: ['USER', 'TENANT'],
  phone: '0900000123',
  dateOfBirth: '2001-05-18',
  gender: 'FEMALE',
  status: 'ACTIVE',
}
export const roommateUser: User = {
  ...tenantUser,
  id: id(5001),
  email: 'roommate@tropro.demo',
  fullName: 'Lê Phương Vy',
}
export type InternalPayment = TenantPayment & {
  settlementAt: number
  outcome: 'success' | 'pending' | 'review' | 'failure'
  idempotencyKey: string
}
export type InternalService = TenantService & { contractTenantId: string; decisionAt: number }
export type InternalProposal = AllocationProposal & { decisionAt: number }
export type InternalReport = MaintenanceReport & { workflowAt: number }
export type TenantDbState = {
  workflowMode?: 'automatic' | 'managed'
  notificationsSeeded?: boolean
  tenancies: Tenancy[]
  invoices: Invoice[]
  payments: InternalPayment[]
  services: InternalService[]
  charges: UtilityCharge[]
  proposals: InternalProposal[]
  reports: InternalReport[]
}
const stamp = (date: string) => `${date}T02:00:00.000Z`
export function seedTenant(): TenantDbState {
  const now = new Date(),
    y = now.getFullYear(),
    m = now.getMonth()
  const day = (offset: number, d = 1) =>
    new Date(Date.UTC(y, m + offset, d)).toISOString().slice(0, 10)
  const month = day(0),
    next = day(1),
    previous = day(-1),
    createdAt = stamp(month)
  const tenancies: Tenancy[] = [0, 1, 2, 3].map((n) => {
    const room = rooms[n === 0 ? 0 : n === 2 ? 1 : 2]
    const branch = branches.find((b) => b.id === room.branchId)!
    return {
      id: id(5100 + n),
      userId: n === 3 ? roommateUser.id : tenantUser.id,
      contractId: id(n === 3 ? 5201 : 5200 + n),
      branchId: branch.id,
      roomId: room.id,
      roomSlotId: n === 1 || n === 3 ? id(1020 + (n === 3 ? 1 : 0)) : null,
      branchName: branch.name,
      roomName: room.title,
      slotName: n === 1 ? 'Giường A' : n === 3 ? 'Giường B' : null,
      rentalMode: n === 1 || n === 3 ? 'SLOT' : 'ROOM',
      status: n === 2 ? 'LEFT' : 'ACTIVE',
      contractStatus: n === 2 ? 'ENDED' : 'ACTIVE',
      code: `TP-${y}-${n === 3 ? '02' : String(n + 1).padStart(2, '0')}`,
      role: n === 3 ? 'MEMBER' : 'REPRESENTATIVE',
      startDate: day(n === 2 ? -8 : -2, n === 3 ? 16 : 1),
      endDate: day(n === 2 ? -2 : 4),
      actualLeaveDate: n === 2 ? day(-2) : null,
      monthlyRent: n === 1 || n === 3 ? 2300000 : 4200000,
      firstMonthRent: n === 1 || n === 3 ? 2300000 : 4200000,
      lastMonthRent: n === 1 || n === 3 ? 2300000 : 4200000,
      prepaidFirstRequired: n === 1 || n === 3 ? 2300000 : 4200000,
      prepaidLastRequired: n === 1 || n === 3 ? 2300000 : 4200000,
      terms:
        'Giá thuê theo thỏa thuận đã được duyệt. Các khoản điện, nước và dịch vụ được lập riêng theo kỳ hóa đơn.',
      sharedTerms:
        'Giữ vệ sinh khu vực chung; yên tĩnh sau 22 giờ. Thời gian thuê tính từ ngày bắt đầu, không bao gồm ngày kết thúc.',
      document: null,
    }
  })
  const payments: InternalPayment[] = []
  const invoices: Invoice[] = []
  for (const [n, tenancy] of tenancies.entries()) {
    const invoiceId = id(5300 + n),
      prepaid = n === 0 ? 1200000 : 0,
      partial = n === 0 ? 1000000 : 0
    const total =
      tenancy.monthlyRent + (n === 1 || n === 3 ? 205000 : 410000) + (n === 0 ? 65000 : 0)
    invoices.push({
      id: invoiceId,
      contractTenantId: tenancy.id,
      code: `HD-${month.slice(0, 7)}-${n + 1}`,
      billingMonth: n === 2 ? day(-3) : month,
      issuedAt: n === 2 ? stamp(day(-3)) : createdAt,
      dueDate: n === 2 ? day(-2, 10) : day(1, 5),
      documentStatus: 'ISSUED',
      items: [
        ...(n === 0
          ? [
              {
                id: id(5409),
                type: 'REPAIR' as const,
                label: 'Thay bản lề tủ',
                amount: 65000,
                snapshot:
                  'Hư hỏng do sử dụng, trách nhiệm người thuê đã được quản lý duyệt. Phiếu bảo trì TP-SC-02.',
              },
            ]
          : []),
        {
          id: id(5400 + n * 10),
          type: 'RENT',
          label: 'Tiền thuê theo thỏa thuận',
          amount: tenancy.monthlyRent,
          snapshot: 'Số tiền đã được quản lý duyệt; không suy diễn chính sách tháng lẻ.',
        },
        {
          id: id(5401 + n * 10),
          type: 'UTILITY',
          label: 'Điện và nước',
          amount: n === 1 || n === 3 ? 205000 : 410000,
          snapshot: 'Điện 350.000đ + nước 60.000đ; phòng chung phân bổ 50% mỗi người.',
        },
      ],
      totalAmount: total,
      prepaidApplied: prepaid,
      prepaidSourcePaymentId: n === 0 ? id(5500) : null,
      verifiedAllocated: partial,
      outstanding: total - prepaid - partial,
      availableToPay: total - prepaid - partial,
      financialStatus: n === 0 ? 'PARTIAL' : 'UNPAID',
      instructions: {
        environment: 'SANDBOX',
        reference: `TP-DEMO-${n + 1}-${month.slice(0, 7)}`,
        qrUrl: null,
        text: 'Môi trường mô phỏng. Không chuyển tiền thật. Trạng thái được cập nhật bởi bộ xử lý demo.',
      },
    })
    if (n === 0) {
      const base = {
        contractTenantId: tenancy.id,
        payerName: 'Trần Gia Linh',
        method: 'SANDBOX' as const,
        environment: 'SANDBOX' as const,
        status: 'VERIFIED' as const,
        createdAt: stamp(previous),
        verifiedAt: stamp(previous),
        evidence: [],
        settlementAt: 0,
        outcome: 'success' as const,
        idempotencyKey: id(5590),
      }
      payments.push({
        ...base,
        id: id(5500),
        invoiceId: null,
        reference: 'TP-PREPAID-01',
        amountReceived: 8400000,
        allocatedAmount: 0,
        prepaidFirstAmount: 4200000,
        prepaidLastAmount: 4200000,
        prepaidFirstApplied: prepaid,
        prepaidLastApplied: 0,
      })
      payments.push({
        ...base,
        id: id(5501),
        idempotencyKey: id(5591),
        invoiceId,
        reference: 'TP-PARTIAL-01',
        amountReceived: 1000000,
        allocatedAmount: 1000000,
        prepaidFirstAmount: 0,
        prepaidLastAmount: 0,
        prepaidFirstApplied: 0,
        prepaidLastApplied: 0,
        payerName: 'Nguyễn Hoài Nam (thanh toán hộ)',
      })
    }
  }
  for (const [n, state] of ['DRAFT', 'CANCELLED'].entries())
    invoices.push({
      ...invoices[0],
      id: id(5350 + n),
      code: `HD-${state}-01`,
      documentStatus: state as 'DRAFT' | 'CANCELLED',
      billingMonth: next,
      issuedAt: null,
      prepaidApplied: 0,
      prepaidSourcePaymentId: null,
      verifiedAllocated: 0,
      outstanding: 0,
      availableToPay: 0,
    })
  const services: InternalService[] = tenancies.flatMap((t) =>
    [
      { id: id(5600), name: 'Điện', mandatory: true, unit: 'kWh', unitPrice: 3500 },
      { id: id(5601), name: 'Nước', mandatory: true, unit: 'm³', unitPrice: 15000 },
      { id: id(5602), name: 'Internet riêng', mandatory: false, unit: 'tháng', unitPrice: 120000 },
      { id: id(5603), name: 'Dọn phòng', mandatory: false, unit: 'lần', unitPrice: 80000 },
    ].map((s, n) => ({
      ...s,
      contractTenantId: t.id,
      subscriptionId: s.mandatory ? id(5700 + tenancies.indexOf(t) * 10 + n) : null,
      status: s.mandatory ? ('APPROVED' as const) : null,
      startDate: s.mandatory ? t.startDate : null,
      endDate: s.mandatory ? t.endDate : null,
      note: '',
      history: [],
      decisionAt: 0,
    })),
  )
  const charges: UtilityCharge[] = []
  for (const [n, t] of tenancies.entries()) {
    const periodStart = n === 2 ? day(-3) : month,
      periodEnd = n === 2 ? day(-2) : next
    const participants = (t.rentalMode === 'SLOT' ? [tenancies[1], tenancies[3]] : [t]).map(
      (p, index) => ({
        id: p.id,
        label: p.id === t.id ? 'Phần của bạn' : `Người cư trú ${index + 1}`,
        startDate: periodStart,
        endDate: periodEnd,
        days: residentDays(periodStart, periodEnd, p.startDate, p.endDate),
        amount: 0,
      }),
    )
    for (let s = 0; s < 2; s++) {
      const total = s ? 60000 : 350000
      const allocated = allocateVnd(total, participants)
      const shares = participants.map((p) => ({
        ...p,
        amount: allocated.find((a) => a.id === p.id)!.amount,
      }))
      charges.push({
        id: id(5800 + (n === 3 ? 1 : n) * 10 + s),
        contractTenantId: t.id,
        name: s ? 'Nước' : 'Điện',
        billingMonth: periodStart,
        startDate: periodStart,
        endDate: periodEnd,
        totalAmount: total,
        myAmount: shares.find((p) => p.id === t.id)!.amount,
        invoiceId: invoices[n].id,
        snapshot:
          'Ảnh chụp tính phí đã duyệt. Chia theo ngày cư trú giao nhau [bắt đầu, kết thúc); làm tròn VND theo phần dư lớn nhất, hòa thì theo UUID.',
        evidence: ['/demo/room-2.webp'],
        participants: shares,
        segments: s
          ? [
              {
                id: id(5900 + n * 10),
                startDate: periodStart,
                endDate: periodEnd,
                previousReading: 100,
                currentReading: 104,
                quantity: 4,
                unit: 'm³',
                unitPrice: 15000,
                amount: 60000,
                reason: 'Chỉ số chốt kỳ',
              },
            ]
          : [
              {
                id: id(5901 + n * 10),
                startDate: periodStart,
                endDate: day(n === 2 ? -3 : 0, 16),
                previousReading: 1000,
                currentReading: 1040,
                quantity: 40,
                unit: 'kWh',
                unitPrice: 3500,
                amount: 140000,
                reason: 'Trước bảo trì công tơ',
              },
              {
                id: id(5902 + n * 10),
                startDate: day(n === 2 ? -3 : 0, 16),
                endDate: periodEnd,
                previousReading: 1040,
                currentReading: 1100,
                quantity: 60,
                unit: 'kWh',
                unitPrice: 3500,
                amount: 210000,
                reason: 'Sau bảo trì công tơ',
              },
            ],
      })
    }
  }
  const reports: InternalReport[] = [
    {
      id: id(6000),
      contractTenantId: tenancies[0].id,
      assetId: id(6100),
      category: 'FURNITURE',
      assetName: 'Điều hòa',
      title: 'Điều hòa chảy nước',
      description: 'Điều hòa rò nước ở dàn lạnh, đã tắt máy để tránh ảnh hưởng đồ dùng.',
      priority: 'NORMAL',
      status: 'COMPLETED',
      attachments: [],
      createdAt,
      assignedTo: 'Kỹ thuật viên Minh',
      workflowAt: 0,
      records: [
        {
          id: id(6200),
          at: createdAt,
          status: 'OPEN',
          description: 'Đã tiếp nhận ảnh hiện trạng.',
          performedBy: 'Trần Gia Linh',
          evidence: ['/demo/room-1.webp'],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        },
        {
          id: id(6201),
          at: stamp(day(0, 2)),
          status: 'ACCEPTED',
          description: 'Quản lý xác nhận lịch kiểm tra.',
          performedBy: 'Quản lý chi nhánh',
          evidence: [],
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        },
        {
          id: id(6202),
          at: stamp(day(0, 3)),
          status: 'IN_PROGRESS',
          description: 'Thông ống thoát nước, thay vật tư hao mòn.',
          performedBy: 'Kỹ thuật viên Minh',
          evidence: [],
          cost: 180000,
          responsibleParty: 'OWNER',
          approvalStatus: 'APPROVED',
        },
        {
          id: id(6203),
          at: stamp(day(0, 3)),
          status: 'COMPLETED',
          description:
            'Chạy thử ổn định. Đề xuất vệ sinh bổ sung đang chờ duyệt, chưa tính vào công nợ.',
          performedBy: 'Kỹ thuật viên Minh',
          evidence: ['/demo/room-3.webp'],
          cost: 90000,
          responsibleParty: 'TENANT',
          approvalStatus: 'PENDING',
        },
      ],
    },
  ]
  reports.push({
    id: id(6001),
    contractTenantId: tenancies[0].id,
    assetId: id(6101),
    category: 'FURNITURE',
    assetName: 'Tủ quần áo',
    title: 'Bản lề tủ bị cong',
    description: 'Bản lề bị cong do sử dụng, người thuê đã xác nhận hiện trạng với quản lý.',
    priority: 'LOW',
    status: 'COMPLETED',
    attachments: [],
    createdAt,
    assignedTo: 'Kỹ thuật viên Minh',
    workflowAt: 0,
    records: [
      {
        id: id(6210),
        at: createdAt,
        status: 'OPEN',
        description: 'Gửi hiện trạng bản lề bị cong.',
        performedBy: 'Trần Gia Linh',
        evidence: ['/demo/room-1.webp'],
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      },
      {
        id: id(6211),
        at: createdAt,
        status: 'COMPLETED',
        description:
          'Đã thay bản lề. Chi phí trách nhiệm người thuê được quản lý duyệt và lập trong hóa đơn kỳ này.',
        performedBy: 'Quản lý chi nhánh',
        evidence: ['/demo/room-3.webp'],
        cost: 65000,
        responsibleParty: 'TENANT',
        approvalStatus: 'APPROVED',
      },
    ],
  })
  return { tenancies, invoices, payments, services, charges, proposals: [], reports }
}
export function assetsFor(t: Tenancy) {
  const roomIndex = Number(t.roomId.slice(-12)) - 100
  const base = 6100 + roomIndex * 10
  const personalOffset = t.roomSlotId ? Number(t.roomSlotId.slice(-1)) + 1 : 1
  return [
    { id: id(base), name: 'Điều hòa', category: 'FURNITURE' as const, condition: 'Đang sử dụng' },
    {
      id: id(base + personalOffset),
      name: t.rentalMode === 'SLOT' ? 'Giường và tủ cá nhân' : 'Tủ quần áo',
      category: 'FURNITURE' as const,
      condition: 'Tốt',
    },
    { id: id(5600), name: 'Điện', category: 'SERVICE' as const, condition: 'Đang hoạt động' },
    { id: id(5601), name: 'Nước', category: 'SERVICE' as const, condition: 'Đang hoạt động' },
  ]
}
