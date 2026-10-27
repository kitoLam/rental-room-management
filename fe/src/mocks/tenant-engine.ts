import { z } from 'zod'
import { MockError } from './database'
import { assetsFor, seedTenant, type TenantDbState, type InternalPayment } from './tenant-fixtures'
import {
  invoiceSchema,
  paymentInputSchema,
  prepaidInputSchema,
  serviceInputSchema,
  proposalInputSchema,
  reportInputSchema,
  type Tenancy,
} from '@/interfaces/tenant'
import { allocateVnd, financialSummary, safeZalo } from '@/lib/tenant-finance'
import { inventory, type MockInventory } from './inventory'

const storageKey = 'tropro-tenant-v1'
export class TenantEngine {
  state: TenantDbState
  inventory: MockInventory
  branchSettings?: (branchId: string) => { zaloUrl: string | null; enabled: boolean }
  furnitureProvider?: (t: Tenancy) => ReturnType<typeof assetsFor>
  manualQr?: (t: Tenancy, invoiceId: string) => { qrUrl: string; resourceId: string; reference: string } | null
  serviceEligibility?: (t: Tenancy, serviceId: string, start: string, end: string) => number | null
  constructor(state?: TenantDbState, catalog = inventory) {
    this.inventory = catalog
    this.state = state || seedTenant()
  }
  save() {
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem(storageKey, JSON.stringify(this.state))
  }
  reset() {
    this.state = seedTenant()
    this.save()
  }
  own(userId: string, tenancyId: string) {
    if (!z.string().uuid().safeParse(tenancyId).success)
      throw new MockError('Mã quan hệ thuê chưa hợp lệ.', 422)
    const t = this.state.tenancies.find((t) => t.id === tenancyId && t.userId === userId)
    if (!t) throw new MockError('Không tìm thấy quan hệ thuê được phép truy cập.', 404)
    return t
  }
  active(t: Tenancy) {
    const today = new Date().toISOString().slice(0, 10)
    if (
      t.status !== 'ACTIVE' ||
      t.contractStatus !== 'ACTIVE' ||
      today < t.startDate ||
      today >= t.endDate
    )
      throw new MockError('Quan hệ thuê không còn hiệu lực cho thao tác này.', 409)
  }
  resource<T extends { id: string; contractTenantId: string }>(
    items: T[],
    id: string,
    t: Tenancy,
  ): T {
    const item = items.find((i) => i.id === id && i.contractTenantId === t.id)
    if (!item) throw new MockError('Không tìm thấy dữ liệu được phép truy cập.', 404)
    return item
  }
  invoice(t: Tenancy, id: string) {
    const item = this.resource(this.state.invoices, id, t)
    const allocated = this.state.payments
      .filter((p) => p.invoiceId === id && p.contractTenantId === t.id && p.status === 'VERIFIED')
      .reduce((s, p) => s + p.allocatedAmount, 0)
    const summary = financialSummary(
      item.totalAmount,
      item.prepaidApplied,
      allocated,
      item.dueDate,
      item.documentStatus,
    )
    const reserved = this.state.payments
      .filter((p) => p.invoiceId === id && ['PENDING', 'REVIEW'].includes(p.status))
      .reduce((s, p) => s + p.amountReceived, 0)
    return invoiceSchema.parse({
      ...item,
      manualQr: this.manualQr?.(t, id) || null,
      ...summary,
      verifiedAllocated: allocated,
      availableToPay: Math.max(0, summary.outstanding - reserved),
    })
  }
  pay(t: Tenancy, id: string, input: unknown) {
    this.active(t)
    const data = paymentInputSchema.parse(input),
      invoice = this.invoice(t, id)
    const previous = this.state.payments.find((p) => p.idempotencyKey === data.idempotencyKey)
    if (previous) {
      if (
        previous.contractTenantId !== t.id ||
        previous.invoiceId !== id ||
        previous.amountReceived !== data.amount ||
        previous.payerName !== data.payerName
      )
        throw new MockError('Mã giao dịch đã được dùng cho yêu cầu khác.', 409)
      return previous
    }
    if (invoice.documentStatus !== 'ISSUED' || data.amount > invoice.availableToPay)
      throw new MockError('Số tiền vượt mức có thể thanh toán hoặc hóa đơn không còn hợp lệ.', 409)
    const p: InternalPayment = {
      id: crypto.randomUUID(),
      contractTenantId: t.id,
      invoiceId: id,
      reference: `TP-SBX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      amountReceived: data.amount,
      allocatedAmount: 0,
      prepaidFirstAmount: 0,
      prepaidLastAmount: 0,
      prepaidFirstApplied: 0,
      prepaidLastApplied: 0,
      payerName: data.payerName,
      method: 'SANDBOX',
      environment: 'SANDBOX',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      evidence: [],
      settlementAt: Date.now() + 5000,
      outcome: data.outcome,
      idempotencyKey: data.idempotencyKey,
    }
    this.state.payments.unshift(p)
    this.save()
    return p
  }
  prepay(t: Tenancy, input: unknown) {
    const data = prepaidInputSchema.parse(input)
    if (
      t.status !== 'DRAFT' ||
      !['DRAFT', 'ACTIVE'].includes(t.contractStatus) ||
      t.endDate <= new Date().toISOString().slice(0, 10)
    )
      throw new MockError('Chỉ nhận trả trước cho quan hệ thuê nháp còn thời hạn.', 409)
    const previous = this.state.payments.find((p) => p.idempotencyKey === data.idempotencyKey)
    if (previous) {
      if (
        previous.contractTenantId !== t.id ||
        previous.invoiceId ||
        previous.amountReceived !== data.amount ||
        previous.payerName !== data.payerName ||
        (data.bucket === 'FIRST_MONTH'
          ? previous.prepaidFirstAmount
          : previous.prepaidLastAmount) !== data.amount
      )
        throw new MockError('Mã giao dịch đã dùng cho nghĩa vụ khác.', 409)
      return previous
    }
    const first = data.bucket === 'FIRST_MONTH',
      required = first ? t.prepaidFirstRequired : t.prepaidLastRequired,
      reserved = this.state.payments
        .filter(
          (p) =>
            p.contractTenantId === t.id &&
            !p.invoiceId &&
            ['PENDING', 'REVIEW', 'VERIFIED'].includes(p.status),
        )
        .reduce((sum, p) => sum + (first ? p.prepaidFirstAmount : p.prepaidLastAmount), 0)
    if (data.amount > required - reserved)
      throw new MockError('Số tiền vượt nghĩa vụ trả trước chưa được nhận.', 409)
    const p: InternalPayment = {
      id: crypto.randomUUID(),
      contractTenantId: t.id,
      invoiceId: null,
      reference: `TP-PRE-SBX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      amountReceived: data.amount,
      allocatedAmount: 0,
      prepaidFirstAmount: first ? data.amount : 0,
      prepaidLastAmount: first ? 0 : data.amount,
      prepaidFirstApplied: 0,
      prepaidLastApplied: 0,
      payerName: data.payerName,
      method: 'SANDBOX',
      environment: 'SANDBOX',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      evidence: [],
      settlementAt: Date.now() + 5000,
      outcome: data.outcome,
      idempotencyKey: data.idempotencyKey,
    }
    this.state.payments.unshift(p)
    try {
      this.save()
    } catch {
      this.state.payments.shift()
      throw new MockError('Bộ nhớ demo đã đầy. Thử lại sau khi đặt lại demo.', 422)
    }
    return p
  }
  service(t: Tenancy, input: unknown) {
    this.active(t)
    const data = serviceInputSchema.parse(input),
      service = this.state.services.find(
        (s) => s.contractTenantId === t.id && s.id === data.serviceId,
      )
    if (!service || service.mandatory)
      throw new MockError('Dịch vụ này không thể đăng ký riêng.', 422)
    if (service.status && !['REJECTED', 'CANCELLED'].includes(service.status))
      throw new MockError('Dịch vụ đã có đăng ký đang hiệu lực hoặc chờ duyệt.', 409)
    if (
      data.startDate < new Date().toISOString().slice(0, 10) ||
      data.startDate < t.startDate ||
      data.endDate > t.endDate ||
      data.endDate <= data.startDate
    )
      throw new MockError(
        'Ngày sử dụng phải nằm trong thời hạn thuê, không bắt đầu trong quá khứ.',
        422,
      )
    const price = this.serviceEligibility?.(t, service.id, data.startDate, data.endDate)
    if (this.serviceEligibility && price === null)
      throw new MockError('Dịch vụ không còn được cung cấp cho phòng trong giai đoạn này.', 409)
    if (price !== undefined && price !== null) service.unitPrice = price
    Object.assign(service, {
      subscriptionId: crypto.randomUUID(),
      status: 'PENDING',
      startDate: data.startDate,
      endDate: data.endDate,
      note: data.note,
      decisionAt: Date.now() + 12000,
    })
    service.history.push({
      status: 'PENDING',
      at: new Date().toISOString(),
      note: data.note || 'Đang chờ quản lý duyệt.',
    })
    this.save()
    return service
  }
  cancelService(t: Tenancy, id: string) {
    this.active(t)
    const service = this.state.services.find((s) => s.contractTenantId === t.id && s.id === id)
    if (!service) throw new MockError('Không tìm thấy dịch vụ.', 404)
    if (service.mandatory)
      throw new MockError('Điện và nước là dịch vụ bắt buộc, không thể hủy.', 422)
    if (service.status !== 'APPROVED')
      throw new MockError('Chỉ dịch vụ đang được duyệt mới có thể yêu cầu hủy.', 409)
    service.status = 'CANCEL_REQUESTED'
    service.decisionAt = Date.now() + 12000
    service.history.push({
      status: service.status,
      at: new Date().toISOString(),
      note: 'Đã gửi yêu cầu ngừng dịch vụ.',
    })
    this.save()
    return service
  }
  servicesFor(t: Tenancy) {
    return this.state.services.filter(
      (s) =>
        s.contractTenantId === t.id &&
        (s.subscriptionId ||
          !this.serviceEligibility ||
          this.serviceEligibility(t, s.id, new Date().toISOString().slice(0, 10), t.endDate) !==
            null),
    )
  }
  propose(t: Tenancy, input: unknown) {
    this.active(t)
    const data = proposalInputSchema.parse(input),
      charge = this.resource(this.state.charges, data.chargeId, t)
    if (
      this.state.proposals.some(
        (p) => p.contractTenantId === t.id && p.chargeId === charge.id && p.status === 'PENDING',
      )
    )
      throw new MockError('Khoản phí đã có đề xuất chờ duyệt.', 409)
    const ids = charge.participants.map((p) => p.id)
    if (
      new Set(data.shares.map((p) => p.id)).size !== ids.length ||
      data.shares.length !== ids.length ||
      data.shares.some((p) => !ids.includes(p.id)) ||
      data.shares.reduce((s, p) => s + p.amount, 0) !== charge.totalAmount
    )
      throw new MockError('Phải phân bổ đúng một phần cho mỗi người, tổng bằng phí nguồn.', 422)
    if (data.method === 'RESIDENT_DAYS') {
      const expected = allocateVnd(charge.totalAmount, charge.participants)
      if (data.shares.some((p) => expected.find((e) => e.id === p.id)?.amount !== p.amount))
        throw new MockError('Phân bổ không khớp số ngày cư trú.', 422)
    }
    const proposal = {
      ...data,
      id: crypto.randomUUID(),
      contractTenantId: t.id,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decision: null,
      decisionAt: Date.now() + 15000,
    }
    this.state.proposals.unshift(proposal)
    this.save()
    return proposal
  }
  assets(t: Tenancy) {
    return [
      ...(this.furnitureProvider ? this.furnitureProvider(t) : assetsFor(t)),
      ...this.state.services
        .filter(
          (s) =>
            s.contractTenantId === t.id &&
            !s.mandatory &&
            ['APPROVED', 'CANCEL_REQUESTED'].includes(s.status || ''),
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          category: 'SERVICE' as const,
          condition: 'Đang sử dụng',
        })),
    ]
  }
  report(t: Tenancy, input: unknown) {
    this.active(t)
    const data = reportInputSchema.parse(input),
      asset = this.assets(t).find((a) => a.id === data.assetId && a.category === data.category)
    if (!asset) throw new MockError('Tài sản hoặc dịch vụ không thuộc phòng đang chọn.', 422)
    for (const a of data.attachments) {
      if (!a.url.startsWith(`data:${a.mime};base64,`))
        throw new MockError('Ảnh đính kèm chưa hợp lệ.', 422)
      const encoded = a.url.split(',')[1]
      let bytes: string
      try {
        bytes = atob(encoded)
      } catch {
        throw new MockError('Không đọc được ảnh đính kèm.', 422)
      }
      const valid =
        a.mime === 'image/png'
          ? bytes.startsWith('\x89PNG\r\n\x1a\n')
          : a.mime === 'image/jpeg'
            ? bytes.startsWith('\xff\xd8\xff')
            : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'
      if (!valid || bytes.length !== a.size)
        throw new MockError('Nội dung ảnh không khớp định dạng hoặc kích thước.', 422)
    }
    const report = {
      ...data,
      id: crypto.randomUUID(),
      contractTenantId: t.id,
      assetName: asset.name,
      status: 'OPEN' as const,
      createdAt: new Date().toISOString(),
      assignedTo: null,
      workflowAt: Date.now() + 12000,
      records: [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          status: 'OPEN',
          description: 'Đã gửi yêu cầu kiểm tra.',
          performedBy: 'Người thuê',
          evidence: data.attachments.map((a) => a.url),
          cost: 0,
          responsibleParty: null,
          approvalStatus: null,
        },
      ],
    }
    this.state.reports.unshift(report)
    try {
      this.save()
    } catch {
      this.state.reports.shift()
      throw new MockError('Bộ nhớ demo đã đầy. Hãy giảm số lượng hoặc dung lượng ảnh.', 422)
    }
    return report
  }
  cancelReport(t: Tenancy, id: string) {
    this.active(t)
    const report = this.resource(this.state.reports, id, t)
    if (report.status !== 'OPEN') throw new MockError('Yêu cầu đã được xử lý, không thể hủy.', 409)
    report.status = 'CANCELLED'
    report.workflowAt = 0
    report.records.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      status: 'CANCELLED',
      description: 'Người thuê đã hủy yêu cầu.',
      performedBy: 'Người thuê',
      evidence: [],
      cost: 0,
      responsibleParty: null,
      approvalStatus: null,
    })
    this.save()
    return report
  }
  room(t: Tenancy) {
    const room = this.inventory.state.rooms.find((r) => r.id === t.roomId)!
    let active = true
    try {
      this.active(t)
    } catch {
      active = false
    }
    return {
      tenancy: t,
      images: room.images,
      area: room.sizeM2 || 25,
      floor: room.floor || 2,
      roomType: room.roomTypeName,
      amenities: room.amenities,
      rules: ['Yên tĩnh sau 22 giờ', 'Không hút thuốc trong phòng', 'Giữ sạch khu vực chung'],
      manager: { name: 'Bộ phận quản lý chi nhánh', phone: '0900000999' },
      zaloUrl: this.branchSettings
        ? active && this.branchSettings(t.branchId).enabled
          ? safeZalo(this.branchSettings(t.branchId).zaloUrl)
          : null
        : active
          ? safeZalo(t.rentalMode === 'ROOM' ? 'https://zalo.me/g/tropro-demo-room' : null)
          : null,
      assets: this.assets(t),
    }
  }
  tick(
    notify: (
      userId: string,
      title: string,
      message: string,
      type: string,
      id: string,
      tenancyId?: string,
    ) => void,
    now = Date.now(),
    reject = false,
  ) {
    const emit = (tenancyId: string, title: string, type: string, id: string) => {
      const t = this.state.tenancies.find((t) => t.id === tenancyId)
      if (t) notify(t.userId, title, 'Mở để xem thông tin mới nhất.', type, id, t.id)
    }
    if (!this.state.notificationsSeeded) {
      for (const t of this.state.tenancies) {
        emit(t.id, 'Hồ sơ thuê đã sẵn sàng', 'TENANT_CONTRACT', t.contractId)
        const invoice = this.state.invoices.find(
          (i) => i.contractTenantId === t.id && i.documentStatus === 'ISSUED',
        )
        if (invoice) emit(t.id, 'Hóa đơn mới đã phát hành', 'TENANT_INVOICE', invoice.id)
        if (t.status === 'ACTIVE')
          emit(t.id, 'Thông tin sinh hoạt chi nhánh', 'TENANT_BRANCH', t.branchId)
      }
      this.state.notificationsSeeded = true
    }
    for (const p of this.state.payments)
      if (p.status === 'PENDING' && p.settlementAt && p.settlementAt <= now) {
        p.settlementAt = 0
        if (p.outcome === 'pending') continue
        p.status =
          p.outcome === 'review' ? 'REVIEW' : p.outcome === 'failure' ? 'FAILED' : 'VERIFIED'
        if (p.status === 'VERIFIED' && p.invoiceId) {
          const t = this.state.tenancies.find((t) => t.id === p.contractTenantId)!,
            invoice = this.invoice(t, p.invoiceId)
          if (invoice.documentStatus !== 'ISSUED' || p.amountReceived > invoice.outstanding) {
            p.status = 'REVIEW'
          } else {
            p.allocatedAmount = p.amountReceived
            p.verifiedAt = new Date(now).toISOString()
          }
        }
        if (p.status === 'VERIFIED' && !p.invoiceId) p.verifiedAt = new Date(now).toISOString()
        emit(p.contractTenantId, 'Thanh toán đã cập nhật', 'TENANT_PAYMENT', p.id)
      }
    if (this.state.workflowMode === 'managed') {
      this.save()
      return
    }
    for (const s of this.state.services)
      if (s.decisionAt && s.decisionAt <= now) {
        s.status = reject
          ? s.status === 'CANCEL_REQUESTED'
            ? 'APPROVED'
            : 'REJECTED'
          : s.status === 'CANCEL_REQUESTED'
            ? 'CANCELLED'
            : 'APPROVED'
        s.decisionAt = 0
        s.history.push({
          status: s.status!,
          at: new Date(now).toISOString(),
          note: 'Kết quả xử lý từ quy trình quản lý mô phỏng.',
        })
        emit(s.contractTenantId, 'Dịch vụ đã có kết quả xử lý', 'TENANT_SERVICE', s.id)
      }
    for (const p of this.state.proposals)
      if (p.status === 'PENDING' && p.decisionAt <= now) {
        p.status = reject ? 'REJECTED' : 'APPROVED'
        p.decisionAt = 0
        p.decidedAt = new Date(now).toISOString()
        p.decision =
          'Kết quả mô phỏng. Hóa đơn đã phát hành được giữ nguyên; điều chỉnh cần quy trình lập hóa đơn của quản lý.'
        emit(p.contractTenantId, 'Đề xuất phân bổ đã được xử lý', 'TENANT_ALLOCATION', p.id)
      }
    for (const r of this.state.reports)
      if (r.workflowAt && r.workflowAt <= now) {
        r.status =
          r.status === 'OPEN' ? 'ACCEPTED' : r.status === 'ACCEPTED' ? 'IN_PROGRESS' : 'COMPLETED'
        r.assignedTo = 'Kỹ thuật viên Minh'
        r.workflowAt = r.status === 'COMPLETED' ? 0 : now + 12000
        r.records.push({
          id: crypto.randomUUID(),
          at: new Date(now).toISOString(),
          status: r.status,
          description:
            r.status === 'COMPLETED'
              ? 'Đã sửa và kiểm tra vận hành. Chi phí hao mòn do chủ nhà chịu.'
              : r.status === 'ACCEPTED'
                ? 'Quản lý đã tiếp nhận và phân công kỹ thuật.'
                : 'Kỹ thuật đang kiểm tra thiết bị.',
          performedBy: 'Quy trình quản lý mô phỏng',
          evidence: r.status === 'COMPLETED' ? ['/demo/room-3.webp'] : [],
          cost: r.status === 'COMPLETED' ? 180000 : 0,
          responsibleParty: r.status === 'COMPLETED' ? 'OWNER' : null,
          approvalStatus: r.status === 'COMPLETED' ? 'APPROVED' : null,
        })
        emit(r.contractTenantId, 'Tiến độ bảo trì đã cập nhật', 'TENANT_MAINTENANCE', r.id)
      }
    this.save()
  }
}
function load(): TenantDbState | undefined {
  try {
    return typeof sessionStorage === 'undefined'
      ? undefined
      : JSON.parse(sessionStorage.getItem(storageKey) || 'null') || undefined
  } catch {
    return undefined
  }
}
export const tenantDb = new TenantEngine(load())
