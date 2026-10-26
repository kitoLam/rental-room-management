import { z } from 'zod'
import type { User } from '@/interfaces/domain'
import {
  invoiceInputSchema,
  type ManagerPayment,
  type ManagerResource,
  type InvoiceSources,
  type ManagerSummary,
} from '@/interfaces/manager'
import type { ManagerEngine } from './manager-engine'
import { MockError } from './database'

export function sumVnd(values: number[]) {
  const total = values.reduce((sum, n) => {
    if (!Number.isSafeInteger(n)) throw new MockError('Số tiền chưa hợp lệ.', 422)
    return sum + BigInt(n)
  }, 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < 0n)
    throw new MockError('Tổng tiền vượt giới hạn hợp lệ.', 422)
  return Number(total)
}
export function paymentViews(e: ManagerEngine, branchId: string): ManagerPayment[] {
  const tenant = e.tenant.state.payments
    .filter((p) =>
      e.tenant.state.tenancies.some((t) => t.id === p.contractTenantId && t.branchId === branchId),
    )
    .map((p) => {
      const t = e.tenancy(branchId, p.contractTenantId),
        meta = e.state.paymentMeta[p.id]
      return {
        ...p,
        roomId: t.roomId,
        branchId,
        targetType: p.invoiceId ? ('INVOICE' as const) : ('PREPAID_RENT' as const),
        bookingId: null,
        tenantName: e.namedTenancy(t).userName,
        providerTransactionId: meta?.providerTransactionId || null,
        note: meta?.note || '',
        history: meta?.history || [],
      }
    })
  const holds = e.db.state.payments
    .filter((p) => e.db.state.bookings.some((b) => b.id === p.bookingId && b.branchId === branchId))
    .map((p) => {
      const b = e.db.state.bookings.find((b) => b.id === p.bookingId)!,
        meta = e.state.paymentMeta[p.id]
      return {
        id: p.id,
        roomId: b.roomId,
        branchId,
        reference: p.reference,
        targetType: 'BOOKING_HOLD' as const,
        invoiceId: null,
        bookingId: p.bookingId,
        contractTenantId: null,
        payerName:
          e.db.state.users.find((u) => u.id === b.requesterUserId)?.fullName || 'Người đặt phòng',
        tenantName:
          e.db.state.users.find((u) => u.id === b.requesterUserId)?.fullName || 'Người đặt phòng',
        amountReceived: p.amount,
        allocatedAmount: p.status === 'VERIFIED' ? p.amount : 0,
        environment: p.environment,
        method: 'SANDBOX',
        status: p.status,
        createdAt: p.createdAt,
        verifiedAt: p.verifiedAt,
        providerTransactionId: null,
        evidence: [],
        note: meta?.note || 'Khoản giữ phòng được theo dõi riêng, không phải tiền thuê.',
        history: meta?.history || [],
      }
    })
  return [...tenant, ...holds].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export function invoiceSources(
  e: ManagerEngine,
  branchId: string,
  tenancyId: string,
  month: string,
  excludingInvoice?: string,
): InvoiceSources {
  const t = e.tenancy(branchId, tenancyId)
  if (!z.iso.date().safeParse(month).success || !month.endsWith('-01'))
    throw new MockError('Kỳ hóa đơn phải là ngày đầu tháng.', 422)
  const end = new Date(Date.parse(month))
  end.setUTCMonth(end.getUTCMonth() + 1)
  const next = end.toISOString().slice(0, 10)
  if (month >= t.endDate || next <= t.startDate)
    throw new MockError('Kỳ hóa đơn không giao với thời hạn thuê.', 422)
  const consumed = (type: string, id: string) =>
    e.tenant.state.invoices.some(
      (i) =>
        i.id !== excludingInvoice &&
        i.contractTenantId === t.id &&
        i.documentStatus !== 'CANCELLED' &&
        (e.state.sources[i.id] || []).some((s) => s.type === type && s.id === id),
    )
  const schedule = e.state.rentSchedules.find(
    (s) => s.contractTenantId === t.id && s.billingMonth === month,
  )
  const sources: InvoiceSources['sources'] = e.tenant.state.charges
    .filter(
      (c) =>
        c.contractTenantId === t.id &&
        c.billingMonth === month &&
        (!c.invoiceId || c.invoiceId === excludingInvoice),
    )
    .map((c) => {
      const service = e.state.services.find((s) => s.branchId === branchId && s.name === c.name)
      return {
        id: c.id,
        type: service?.mandatory ? ('UTILITY' as const) : ('SERVICE' as const),
        label: `${c.name} · ${c.billingMonth.slice(0, 7)}`,
        sourceRoute: `/manager/utility-charges/${c.id}`,
        amount: c.myAmount,
      }
    })
    .filter((s) => !consumed(s.type, s.id))
  for (const report of e.tenant.state.reports.filter(
    (r) => r.contractTenantId === t.id && r.status === 'COMPLETED',
  ))
    for (const r of report.records)
      if (
        r.cost > 0 &&
        r.responsibleParty === 'TENANT' &&
        r.approvalStatus === 'APPROVED' &&
        !consumed('REPAIR', r.id)
      )
        sources.push({
          id: r.id,
          type: 'REPAIR',
          label: `Sửa chữa: ${report.title}`,
          sourceRoute: `/manager/maintenance/${report.id}`,
          amount: r.cost,
        })
  const prepaid: InvoiceSources['prepaid'] = []
  for (const p of e.tenant.state.payments.filter(
    (p) => p.contractTenantId === t.id && p.status === 'VERIFIED' && !p.invoiceId,
  ))
    for (const bucket of ['FIRST_MONTH', 'LAST_MONTH'] as const) {
      const received = bucket === 'FIRST_MONTH' ? p.prepaidFirstAmount : p.prepaidLastAmount,
        applied = bucket === 'FIRST_MONTH' ? p.prepaidFirstApplied : p.prepaidLastApplied,
        reserved = sumVnd(
          e.tenant.state.invoices
            .filter((i) => i.id !== excludingInvoice && i.documentStatus === 'DRAFT')
            .flatMap((i) =>
              (e.state.sources[i.id] || [])
                .filter((s) => s.type === 'PREPAID' && s.id === p.id && s.bucket === bucket)
                .map((s) => s.amount),
            ),
        ),
        cap = bucket === 'FIRST_MONTH' ? schedule?.firstMax || 0 : schedule?.lastMax || 0,
        available = Math.max(0, Math.min(received - applied - reserved, cap))
      if (available)
        prepaid.push({
          paymentId: p.id,
          bucket,
          available,
          label: `${p.reference} · ${bucket === 'FIRST_MONTH' ? 'Kỳ đầu' : 'Kỳ cuối'}`,
        })
    }
  return {
    rentAmount: schedule?.amount || 0,
    policyNote:
      schedule?.note ||
      'Chưa có lịch tiền thuê đã duyệt cho tháng này. Quản lý cần xác nhận số tiền thỏa thuận, không tự chia theo ngày.',
    dueDate: `${month.slice(0, 7)}-05`,
    prepaid,
    sources,
  }
}
export function financeAction(
  e: ManagerEngine,
  actor: User,
  branchId: string,
  resource: ManagerResource,
  id: string | null,
  action: string,
  input: unknown,
): unknown {
  if (resource === 'payments') {
    const view = paymentViews(e, branchId).find((p) => p.id === id)
    if (!view) throw new MockError('Không tìm thấy thanh toán thuộc chi nhánh.', 404)
    const data = z
      .object({
        decision: z.enum(['verify', 'review']),
        note: z.string().trim().min(10).max(1000),
        reference: z.string().optional(),
        amount: z.number().int().positive().optional(),
        providerTransactionId: z.string().optional(),
      })
      .parse(input)
    if (!['PENDING', 'REVIEW'].includes(view.status))
      throw new MockError('Giao dịch đã được xử lý, không xác minh hoặc phân bổ lần hai.', 409)
    if (data.decision === 'review') {
      if (view.status === 'REVIEW') throw new MockError('Giao dịch đã ở trạng thái đối soát.', 409)
      const payment =
        e.tenant.state.payments.find((p) => p.id === id) ||
        e.db.state.payments.find((p) => p.id === id)
      if (!payment) throw new MockError('Không tìm thấy thanh toán.', 404)
      payment.status = 'REVIEW'
      const meta = e.state.paymentMeta[view.id] || {
        providerTransactionId: '',
        expectedReference: view.reference,
        amount: view.amountReceived,
        history: [],
        note: '',
      }
      meta.note = data.note
      meta.history.push(e.audit(actor, 'Đưa giao dịch vào đối soát: ' + data.note))
      e.state.paymentMeta[view.id] = meta
      return { ...view, status: 'REVIEW' }
    }
    if (view.method !== 'TRANSFER' || view.environment === 'SANDBOX')
      throw new MockError(
        'Thanh toán sandbox chỉ được xác minh bởi bộ xử lý nhà cung cấp mô phỏng.',
        403,
      )
    const payment = e.tenant.state.payments.find((p) => p.id === id),
      meta = e.state.paymentMeta[view.id]
    if (!payment || !meta || !payment.invoiceId)
      throw new MockError('Giao dịch chưa có bằng chứng hoặc nghĩa vụ hợp lệ để xác minh.', 409)
    if (
      data.reference !== meta.expectedReference ||
      data.amount !== meta.amount ||
      data.providerTransactionId !== meta.providerTransactionId ||
      !payment.evidence.length
    )
      throw new MockError(
        'Tham chiếu, số tiền hoặc mã giao dịch không khớp biên nhận ngân hàng.',
        422,
      )
    if (
      [...e.tenant.state.payments, ...e.db.state.payments].some(
        (p) =>
          p.id !== payment.id &&
          p.status === 'VERIFIED' &&
          e.state.paymentMeta[p.id]?.providerTransactionId === meta.providerTransactionId,
      )
    )
      throw new MockError('Mã giao dịch nhà cung cấp đã được xác minh cho khoản khác.', 409)
    const t = e.tenancy(branchId, payment.contractTenantId),
      invoice = e.tenant.invoice(t, payment.invoiceId)
    if (t.userId === actor.id)
      throw new MockError('Không tự xác minh thanh toán cho nghĩa vụ của chính mình.', 403)
    if (invoice.documentStatus !== 'ISSUED' || payment.amountReceived > invoice.outstanding)
      throw new MockError(
        'Không thể phân bổ vượt nghĩa vụ còn lại hoặc vào hóa đơn chưa phát hành.',
        409,
      )
    payment.status = 'VERIFIED'
    payment.allocatedAmount = payment.amountReceived
    payment.verifiedAt = new Date().toISOString()
    payment.settlementAt = 0
    meta.note = data.note
    meta.history.push(e.audit(actor, 'Xác minh biên nhận và phân bổ đúng hóa đơn: ' + data.note))
    e.notifyTenant(t, 'Thanh toán đã được quản lý xác minh', 'TENANT_PAYMENT', payment.id)
    return paymentViews(e, branchId).find((p) => p.id === id)
  }
  const existing = id ? e.tenant.state.invoices.find((i) => i.id === id) : null
  if (
    id &&
    (!existing ||
      !e.tenant.state.tenancies.some(
        (t) => t.id === existing.contractTenantId && t.branchId === branchId,
      ))
  )
    throw new MockError('Không tìm thấy hóa đơn thuộc chi nhánh.', 404)
  if (action === 'issue') {
    if (!existing || existing.documentStatus !== 'DRAFT')
      throw new MockError('Chỉ phát hành hóa đơn nháp hợp lệ một lần.', 409)
    const t = e.tenancy(branchId, existing.contractTenantId)
    if (t.status !== 'ACTIVE' && t.status !== 'LEFT')
      throw new MockError('Quan hệ thuê chưa đủ điều kiện lập hóa đơn.', 409)
    if (
      e.tenant.state.invoices.some(
        (i) =>
          i.id !== id &&
          i.contractTenantId === t.id &&
          i.billingMonth === existing.billingMonth &&
          i.documentStatus !== 'CANCELLED',
      )
    )
      throw new MockError('Kỳ này đã có hóa đơn khác.', 409)
    const sources = e.state.sources[existing.id]
    if (!sources?.some((s) => s.type === 'RENT'))
      throw new MockError('Hóa đơn chưa có nguồn tiền thuê được duyệt.', 422)
    const eligible = invoiceSources(e, branchId, t.id, existing.billingMonth, existing.id)
    if (existing.items.find((i) => i.type === 'RENT')?.amount !== eligible.rentAmount)
      throw new MockError(
        'Lịch tiền thuê đã thay đổi. Đối chiếu lại nháp trước khi phát hành.',
        409,
      )
    for (const source of sources.filter((s) => ['UTILITY', 'SERVICE', 'REPAIR'].includes(s.type)))
      if (
        !eligible.sources.some(
          (s) => s.id === source.id && s.type === source.type && s.amount === source.amount,
        )
      )
        throw new MockError('Nguồn phí đã thay đổi hoặc không còn đủ điều kiện. Sửa lại nháp.', 409)
    for (const source of sources.filter((s) => s.type === 'PREPAID'))
      if (
        !eligible.prepaid.some(
          (p) =>
            p.paymentId === source.id && p.bucket === source.bucket && p.available >= source.amount,
        )
      )
        throw new MockError('Nguồn trả trước đã được sử dụng hoặc không đủ hạn mức.', 409)
    existing.documentStatus = 'ISSUED'
    existing.issuedAt = new Date().toISOString()
    for (const source of sources) {
      if (source.type === 'PREPAID') {
        const p = e.tenant.state.payments.find((p) => p.id === source.id)!
        if (source.bucket === 'FIRST_MONTH') p.prepaidFirstApplied += source.amount
        else p.prepaidLastApplied += source.amount
      } else if (['UTILITY', 'SERVICE'].includes(source.type)) {
        const c = e.tenant.state.charges.find(
          (c) => c.id === source.id && c.contractTenantId === t.id,
        )
        if (c) c.invoiceId = existing.id
      }
    }
    e.notifyTenant(t, 'Hóa đơn mới đã phát hành', 'TENANT_INVOICE', existing.id)
    return existing
  }
  if (action === 'cancel') {
    if (!existing || existing.documentStatus !== 'DRAFT')
      throw new MockError(
        'Điều chỉnh/hủy sau phát hành cần quy trình chủ sở hữu, Manager không được ghi đè.',
        403,
      )
    existing.documentStatus = 'CANCELLED'
    return existing
  }
  if (action && action !== 'save') throw new MockError('Thao tác tài chính không được hỗ trợ.', 404)
  if (existing && existing.documentStatus !== 'DRAFT')
    throw new MockError('Manager không được sửa số tiền hóa đơn đã phát hành.', 403)
  const data = invoiceInputSchema.parse(input),
    t = e.tenancy(branchId, data.contractTenantId)
  if (t.status !== 'ACTIVE' && t.status !== 'LEFT')
    throw new MockError('Chọn nghĩa vụ thuê đang hiệu lực hoặc có lịch sử được phép lập phí.', 409)
  if (existing && existing.contractTenantId !== t.id)
    throw new MockError('Không đổi người chịu nghĩa vụ của hóa đơn đã tạo.', 409)
  if (
    e.tenant.state.invoices.some(
      (i) =>
        i.id !== id &&
        i.contractTenantId === t.id &&
        i.billingMonth === data.billingMonth &&
        i.documentStatus !== 'CANCELLED',
    )
  )
    throw new MockError('Mỗi quan hệ thuê chỉ có một hóa đơn chưa hủy trong một tháng.', 409)
  const eligible = invoiceSources(e, branchId, t.id, data.billingMonth, id || undefined)
  if (data.dueDate < data.billingMonth)
    throw new MockError('Hạn thanh toán không thể trước kỳ hóa đơn.', 422)
  if (data.adjustment !== 0 && data.adjustmentReason.trim().length < 10)
    throw new MockError('Điều chỉnh nháp cần lý do từ 10 ký tự.', 422)
  if (new Set(data.sources.map((s) => `${s.type}:${s.id}`)).size !== data.sources.length)
    throw new MockError('Nguồn phí bị chọn trùng.', 422)
  const selected = data.sources.map((s) => {
    const actual = eligible.sources.find((a) => a.id === s.id && a.type === s.type)
    if (!actual)
      throw new MockError('Nguồn phí chưa được chốt, chưa được duyệt hoặc đã lập hóa đơn.', 422)
    return actual
  })
  let schedule = e.state.rentSchedules.find(
    (s) => s.contractTenantId === t.id && s.billingMonth === data.billingMonth,
  )
  if (schedule && schedule.amount !== data.rentAmount)
    throw new MockError(
      'Tiền thuê không khớp lịch đã duyệt. Thay đổi nghĩa vụ cần quy trình thỏa thuận.',
      409,
    )
  if (!schedule) {
    schedule = {
      id: crypto.randomUUID(),
      contractTenantId: t.id,
      billingMonth: data.billingMonth,
      amount: data.rentAmount,
      firstMax: 0,
      lastMax: 0,
      approvedBy: actor.id,
      note: data.rentApprovalNote,
    }
  }
  const total = sumVnd([data.rentAmount, ...selected.map((s) => s.amount), data.adjustment])
  if (data.prepaidAmount > total)
    throw new MockError('Áp dụng trả trước không vượt tổng nghĩa vụ.', 422)
  if (data.prepaidAmount > data.rentAmount)
    throw new MockError(
      'Tiền thuê trả trước chỉ áp dụng trong phần tiền thuê, không trả thay phí dịch vụ/sửa chữa.',
      422,
    )
  if (
    data.prepaidAmount > 0 &&
    !eligible.prepaid.some(
      (p) =>
        p.paymentId === data.prepaidSourcePaymentId &&
        p.bucket === data.prepaidBucket &&
        p.available >= data.prepaidAmount,
    )
  )
    throw new MockError('Nguồn trả trước không được phép áp dụng hoặc vượt số dư đã duyệt.', 422)
  const invoiceId = existing?.id || crypto.randomUUID(),
    items = [
      {
        id: crypto.randomUUID(),
        type: 'RENT' as const,
        label: 'Tiền thuê theo lịch đã duyệt',
        amount: data.rentAmount,
        snapshot: data.rentApprovalNote,
      },
      ...selected.map((s) => ({
        id: crypto.randomUUID(),
        type: s.type,
        label: s.label,
        amount: s.amount,
        snapshot: 'Nguồn phí đã chốt/được duyệt: ' + s.id,
      })),
      ...(data.adjustment
        ? [
            {
              id: crypto.randomUUID(),
              type: 'ADJUSTMENT' as const,
              label: 'Điều chỉnh trong nháp',
              amount: data.adjustment,
              snapshot: data.adjustmentReason,
            },
          ]
        : []),
    ]
  const invoice = {
    id: invoiceId,
    contractTenantId: t.id,
    code:
      existing?.code ||
      `HD-${data.billingMonth.slice(0, 7)}-${invoiceId.slice(0, 6).toUpperCase()}`,
    billingMonth: data.billingMonth,
    dueDate: data.dueDate,
    issuedAt: null,
    documentStatus: 'DRAFT' as const,
    items,
    totalAmount: total,
    prepaidApplied: data.prepaidAmount,
    prepaidSourcePaymentId: data.prepaidAmount ? data.prepaidSourcePaymentId : null,
    verifiedAllocated: 0,
    outstanding: 0,
    availableToPay: 0,
    financialStatus: 'UNPAID' as const,
    instructions: {
      environment: 'SANDBOX' as const,
      reference: `TP-SBX-${invoiceId.slice(0, 8).toUpperCase()}`,
      qrUrl: null,
      text: 'Thanh toán mô phỏng, không chuyển tiền thật.',
    },
  }
  if (existing) Object.assign(existing, invoice)
  else e.tenant.state.invoices.unshift(invoice)
  if (!e.state.rentSchedules.some((s) => s.id === schedule.id)) e.state.rentSchedules.push(schedule)
  e.state.sources[invoiceId] = [
    { type: 'RENT', id: schedule.id, amount: data.rentAmount },
    ...selected.map((s) => ({ type: s.type, id: s.id, amount: s.amount })),
    ...(data.prepaidAmount
      ? [
          {
            type: 'PREPAID' as const,
            id: data.prepaidSourcePaymentId!,
            amount: data.prepaidAmount,
            bucket: data.prepaidBucket,
          },
        ]
      : []),
  ]
  return invoice
}
export function reportSummary(e: ManagerEngine, branchId: string, month: string): ManagerSummary {
  if (!z.iso.date().safeParse(`${month}-01`).success)
    throw new MockError('Kỳ báo cáo chưa hợp lệ.', 422)
  const ids = new Set(
      e.tenant.state.tenancies.filter((t) => t.branchId === branchId).map((t) => t.id),
    ),
    all = e.tenant.state.invoices.filter(
      (i) => ids.has(i.contractTenantId) && i.documentStatus === 'ISSUED',
    ),
    invoices = all
      .filter((i) => i.billingMonth.startsWith(month))
      .map((i) => e.tenant.invoice(e.tenancy(branchId, i.contractTenantId), i.id)),
    payments = paymentViews(e, branchId).filter(
      (p) => p.status === 'VERIFIED' && p.targetType !== 'BOOKING_HOLD',
    ),
    rooms = e.inventory.state.rooms.filter((r) => r.branchId === branchId),
    today = new Date().toISOString().slice(0, 10),
    tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    views = rooms.map((r) => e.occupancy(r, today, tomorrow)),
    slots = e.inventory.state.slots.filter(
      (s) => s.branchId === branchId && s.operationalStatus === 'ACTIVE',
    )
  const receipts = (period: string, sandbox: boolean) =>
    sumVnd(
      payments
        .filter(
          (p) => p.verifiedAt?.startsWith(period) && (p.environment === 'SANDBOX') === sandbox,
        )
        .map((p) => p.amountReceived),
    )
  const bookings = e.db.state.bookings.filter((b) => b.branchId === branchId),
    reports = e.tenant.state.reports.filter((r) => ids.has(r.contractTenantId)),
    service = e.tenant.state.services.filter((s) => ids.has(s.contractTenantId)),
    proposals = e.tenant.state.proposals.filter((p) => ids.has(p.contractTenantId))
  const series = Array.from({ length: 4 }, (_, n) => {
    const d = new Date(`${month}-01T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - 3 + n)
    const period = d.toISOString().slice(0, 7)
    return {
      period,
      billed: sumVnd(
        all.filter((i) => i.billingMonth.startsWith(period)).map((i) => i.totalAmount),
      ),
      receipts: receipts(period, false),
      sandbox: receipts(period, true),
    }
  })
  return {
    period: month,
    rooms: {
      total: rooms.length,
      available: views.filter((r) => r.availability === 'AVAILABLE').length,
      occupied: views.filter((r) => r.availability === 'OCCUPIED').length,
      held: views.filter((r) => r.availability === 'HELD').length,
      maintenance: views.filter((r) => r.operationalStatus !== 'ACTIVE').length,
    },
    slots: {
      total: slots.length,
      occupied: views
        .filter((r) => r.rentalMode === 'SLOT')
        .reduce((s, r) => s + (r.occupiedResources || 0), 0),
      held: views.filter((r) => r.rentalMode === 'SLOT').reduce((s, r) => s + (r.heldResources || 0), 0),
      available: slots.filter((s) => !e.overlapsRoom(s.roomId, s.id, today, tomorrow)).length,
    },
    billed: sumVnd(invoices.map((i) => i.totalAmount)),
    receipts: receipts(month, false),
    sandboxReceipts: receipts(month, true),
    debt: sumVnd(invoices.map((i) => i.outstanding)),
    overdue: sumVnd(
      invoices.filter((i) => i.financialStatus === 'OVERDUE').map((i) => i.outstanding),
    ),
    overdueCount: invoices.filter((i) => i.financialStatus === 'OVERDUE').length,
    activeContracts: e.state.contracts.filter(
      (c) => c.branchId === branchId && c.status === 'ACTIVE',
    ).length,
    activeTenancies: e.tenant.state.tenancies.filter((t) => ids.has(t.id) && t.status === 'ACTIVE')
      .length,
    pending: [
      {
        label: 'Lịch xem',
        count: e.db.state.appointments.filter(
          (a) => rooms.some((r) => r.id === a.roomId) && a.status === 'PENDING',
        ).length,
        route: '/manager/appointments',
      },
      {
        label: 'Giữ phòng',
        count: bookings.filter((b) => ['REQUESTED', 'AWAITING_PAYMENT'].includes(b.status)).length,
        route: '/manager/bookings',
      },
      {
        label: 'Dịch vụ',
        count: service.filter((s) => ['PENDING', 'CANCEL_REQUESTED'].includes(s.status || ''))
          .length,
        route: '/manager/service-requests',
      },
      {
        label: 'Phân bổ phí',
        count: proposals.filter((p) => p.status === 'PENDING').length,
        route: '/manager/cost-allocations',
      },
      {
        label: 'Sửa chữa',
        count: reports.filter((r) => ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length,
        route: '/manager/maintenance',
      },
    ],
    series,
    bookingCounts: [...new Set(bookings.map((b) => b.status))].map((status) => ({
      status,
      count: bookings.filter((b) => b.status === status).length,
    })),
    maintenanceCounts: [...new Set(reports.map((r) => r.status))].map((status) => ({
      status,
      count: reports.filter((r) => r.status === status).length,
    })),
  }
}
