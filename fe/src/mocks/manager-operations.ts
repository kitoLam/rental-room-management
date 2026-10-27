import { z } from 'zod'
import {
  serviceCatalogInputSchema,
  roomServiceInputSchema,
  chargeInputSchema,
  assetInputSchema,
  warrantyInputSchema,
  recordInputSchema,
  type ManagerCharge,
  type ManagerResource,
} from '@/interfaces/manager'
import type { User } from '@/interfaces/domain'
import type { UtilityCharge } from '@/interfaces/tenant'
import type { ManagerEngine } from './manager-engine'
import { MockError, overlaps } from './database'
import { allocateVnd, residentDays, safeZalo } from '@/lib/tenant-finance'
import { validateAttachments } from './image-validation'

function period(start: string, end: string) {
  if (end <= start) throw new MockError('Khoảng ngày chưa hợp lệ.', 422)
}
function thousandths(n: number) {
  const value = String(n)
  if (!/^\d+(\.\d{1,3})?$/.test(value))
    throw new MockError('Chỉ số và số lượng tối đa 3 chữ số thập phân.', 422)
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'))
}
export function chargeViews(e: ManagerEngine, branchId: string): ManagerCharge[] {
  const own = e.tenant.state.charges.filter((c) =>
    e.tenant.state.tenancies.some((t) => t.id === c.contractTenantId && t.branchId === branchId),
  )
  const unique = [...new Map(own.map((c) => [c.id, c])).values()].map((c) => {
    const t = e.tenancy(branchId, c.contractTenantId)
    return {
      ...c,
      roomId: t.roomId,
      roomName: t.roomName,
      serviceId: e.state.services.find((s) => s.branchId === branchId && s.name === c.name)!.id,
      status: 'FINALIZED' as const,
    }
  })
  return [
    ...e.state.charges.filter((c) =>
      e.inventory.state.rooms.some((r) => r.id === c.roomId && r.branchId === branchId),
    ),
    ...unique.filter((c) => !e.state.charges.some((d) => d.id === c.id)),
  ]
}
export function operationsAction(
  e: ManagerEngine,
  actor: User,
  branchId: string,
  resource: ManagerResource,
  id: string | null,
  action: string,
  input: unknown,
  method: string,
): unknown {
  if (resource === 'services') {
    const current = id ? e.state.services.find((s) => s.id === id && s.branchId === branchId) : null
    if (id && !current) throw new MockError('Không tìm thấy dịch vụ thuộc chi nhánh.', 404)
    const data = serviceCatalogInputSchema.parse(input)
    if (['ELECTRICITY', 'WATER'].includes(data.type) && (!data.mandatory || !data.active))
      throw new MockError('Điện và nước phải giữ là dịch vụ bắt buộc đang hoạt động.', 422)
    if (current?.mandatory && (data.type !== current.type || !data.mandatory || !data.active))
      throw new MockError('Không thể ngừng hoặc đổi loại dịch vụ bắt buộc.', 409)
    if (
      e.state.services.some(
        (s) =>
          s.branchId === branchId &&
          s.id !== id &&
          s.code.toLowerCase() === data.code.toLowerCase(),
      )
    )
      throw new MockError('Mã dịch vụ đã tồn tại.', 409)
    if (
      current &&
      !data.active &&
      e.tenant.state.services.some(
        (s) => s.id === id && ['PENDING', 'APPROVED', 'CANCEL_REQUESTED'].includes(s.status || ''),
      )
    )
      throw new MockError('Dịch vụ còn đăng ký hiệu lực hoặc chờ xử lý.', 409)
    if (current) Object.assign(current, data)
    else e.state.services.push({ id: crypto.randomUUID(), branchId, ...data })
    return current || e.state.services.at(-1)
  }
  if (resource === 'room-services') {
    const data = roomServiceInputSchema.parse(input)
    period(data.startDate, data.endDate)
    const room = e.room(branchId, data.roomId),
      service = e.state.services.find(
        (s) => s.id === data.serviceId && s.branchId === branchId && s.active,
      ),
      current = id ? e.state.roomServices.find((s) => s.id === id && s.branchId === branchId) : null
    if (!service || (id && !current))
      throw new MockError('Cấu hình phòng/dịch vụ không thuộc chi nhánh.', 422)
    if (current && (current.roomId !== data.roomId || current.serviceId !== data.serviceId))
      throw new MockError('Không đổi nguồn phòng hoặc dịch vụ của cấu hình đã lưu.', 409)
    if (
      current &&
      (data.startDate <= current.startDate ||
        data.startDate < new Date().toISOString().slice(0, 10))
    )
      throw new MockError('Thay giá bằng giai đoạn mới từ hiện tại; không sửa giá lịch sử.', 409)
    if (
      e.state.roomServices.some(
        (s) =>
          s.id !== id &&
          s.roomId === room.id &&
          s.serviceId === service.id &&
          overlaps(data.startDate, data.endDate, s.startDate, s.endDate),
      )
    )
      throw new MockError('Cấu hình dịch vụ có giai đoạn chồng lấn.', 409)
    if (current) {
      current.endDate = data.startDate
      current.status = 'ENDED'
    }
    const created = {
      ...data,
      id: crypto.randomUUID(),
      branchId,
      roomName: room.title,
      serviceName: service.name,
      status: 'ACTIVE' as const,
    }
    e.state.roomServices.push(created)
    for (const t of e.tenant.state.tenancies.filter((t) => t.roomId === room.id))
      if (!e.tenant.state.services.some((s) => s.contractTenantId === t.id && s.id === service.id))
        e.tenant.state.services.push({
          id: service.id,
          contractTenantId: t.id,
          name: service.name,
          mandatory: service.mandatory,
          unit: service.unit,
          unitPrice: data.unitPrice,
          subscriptionId: service.mandatory ? crypto.randomUUID() : null,
          status: service.mandatory ? 'APPROVED' : null,
          startDate: service.mandatory ? t.startDate : null,
          endDate: service.mandatory ? t.endDate : null,
          note: '',
          history: [],
          decisionAt: 0,
        })
    return created
  }
  if (resource === 'service-requests') {
    const data = z
        .object({
          contractTenantId: z.string().uuid(),
          decision: z.enum(['approve', 'reject']),
          reason: z.string().trim().min(5).max(1000),
        })
        .parse(input),
      t = e.tenancy(branchId, data.contractTenantId),
      service = e.tenant.state.services.find(
        (s) => s.contractTenantId === t.id && (s.id === id || s.subscriptionId === id),
      )
    if (!service) throw new MockError('Không tìm thấy yêu cầu dịch vụ.', 404)
    e.tenant.active(t)
    if (service.mandatory || !['PENDING', 'CANCEL_REQUESTED'].includes(service.status || ''))
      throw new MockError('Dịch vụ bắt buộc hoặc yêu cầu đã được xử lý.', 409)
    const catalog = e.state.services.find(
      (s) => s.id === service.id && s.branchId === branchId && s.active,
    )
    if (!catalog) throw new MockError('Dịch vụ không còn được cung cấp.', 409)
    service.status =
      data.decision === 'approve'
        ? service.status === 'PENDING'
          ? 'APPROVED'
          : 'CANCELLED'
        : service.status === 'PENDING'
          ? 'REJECTED'
          : 'APPROVED'
    service.decisionAt = 0
    service.history.push({
      status: service.status,
      at: new Date().toISOString(),
      note: `${actor.fullName}: ${data.reason}`,
    })
    e.notifyTenant(t, 'Yêu cầu dịch vụ đã có kết quả', 'TENANT_SERVICE', service.id)
    return service
  }
  if (resource === 'utility-charges') {
    const current = id
      ? e.state.charges.find(
          (c) =>
            c.id === id &&
            e.inventory.state.rooms.some((r) => r.id === c.roomId && r.branchId === branchId),
        )
      : null
    if (action === 'finalize') {
      if (!current || current.status !== 'DRAFT')
        throw new MockError('Chỉ chốt khoản phí nháp một lần.', 409)
      const service = e.state.services.find(
        (s) => s.id === current.serviceId && s.branchId === branchId,
      )!
      const bounds = (t: (typeof e.tenant.state.tenancies)[number]) => {
        const subscription = service.mandatory
          ? null
          : e.tenant.state.services.find(
              (s) =>
                s.contractTenantId === t.id &&
                s.id === service.id &&
                ['APPROVED', 'CANCEL_REQUESTED'].includes(s.status || ''),
            )
        return {
          start:
            subscription?.startDate && subscription.startDate > t.startDate
              ? subscription.startDate
              : t.startDate,
          end:
            subscription?.endDate && subscription.endDate < (t.actualLeaveDate || t.endDate)
              ? subscription.endDate
              : t.actualLeaveDate || t.endDate,
        }
      }
      const participants = e.tenant.state.tenancies.filter(
        (t) =>
          t.roomId === current.roomId &&
          ['ACTIVE', 'LEFT'].includes(t.status) &&
          overlaps(
            current.startDate,
            current.endDate,
            t.startDate,
            t.actualLeaveDate || t.endDate,
          ) &&
          (service.mandatory ||
            e.tenant.state.services.some(
              (s) =>
                s.contractTenantId === t.id &&
                s.id === service.id &&
                ['APPROVED', 'CANCEL_REQUESTED'].includes(s.status || ''),
            )) &&
          residentDays(current.startDate, current.endDate, bounds(t).start, bounds(t).end) > 0,
      )
      if (!participants.length)
        throw new MockError('Không có cư trú/dịch vụ hợp lệ để phân bổ phí.', 422)
      if (
        chargeViews(e, branchId).some(
          (c) =>
            c.id !== current.id &&
            c.roomId === current.roomId &&
            c.serviceId === service.id &&
            c.status === 'FINALIZED' &&
            overlaps(c.startDate, c.endDate, current.startDate, current.endDate),
        )
      )
        throw new MockError('Khoản phí đã chốt có giai đoạn chồng lấn.', 409)
      const totals = new Map(participants.map((t) => [t.id, 0]))
      for (const segment of current.segments) {
        if (
          participants.every(
            (t) =>
              residentDays(segment.startDate, segment.endDate, bounds(t).start, bounds(t).end) ===
              0,
          )
        )
          throw new MockError('Đoạn tính phí không có ngày cư trú/dịch vụ hợp lệ.', 422)
        const shares = allocateVnd(
          segment.amount,
          participants.map((t) => ({
            id: t.id,
            days: residentDays(segment.startDate, segment.endDate, bounds(t).start, bounds(t).end),
          })),
        )
        for (const s of shares) totals.set(s.id, totals.get(s.id)! + s.amount)
      }
      const baseParticipants = participants.map((t, n) => ({
        id: t.id,
        label: `Người cư trú ${n + 1}`,
        startDate: bounds(t).start,
        endDate: bounds(t).end,
        days: residentDays(current.startDate, current.endDate, bounds(t).start, bounds(t).end),
        amount: totals.get(t.id)!,
      }))
      const projections: UtilityCharge[] = participants.map((t) => ({
        ...current,
        contractTenantId: t.id,
        myAmount: totals.get(t.id)!,
        invoiceId: null,
        participants: baseParticipants.map((p) => ({
          ...p,
          label: p.id === t.id ? 'Phần của bạn' : p.label,
        })),
      }))
      current.status = 'FINALIZED'
      current.participants = baseParticipants
      e.tenant.state.charges.push(...projections)
      for (const t of participants)
        e.notifyTenant(t, 'Chi phí sinh hoạt đã được chốt', 'TENANT_UTILITY', current.id)
      return current
    }
    if (id && !current)
      throw new MockError('Khoản phí đã chốt hoặc không thuộc chi nhánh; không sửa lịch sử.', 409)
    if (current?.status === 'FINALIZED')
      throw new MockError('Khoản phí đã chốt, không sửa trực tiếp.', 409)
    const data = chargeInputSchema.parse(input),
      room = e.room(branchId, data.roomId),
      service = e.state.services.find(
        (s) => s.id === data.serviceId && s.branchId === branchId && s.active,
      )
    if (!service) throw new MockError('Dịch vụ không thuộc chi nhánh.', 422)
    validateAttachments(data.evidence)
    if (
      !data.segments.every((segment) =>
        e.state.roomServices.some(
          (config) =>
            config.roomId === room.id &&
            config.serviceId === service.id &&
            config.startDate <= segment.startDate &&
            config.endDate >= segment.endDate,
        ),
      )
    )
      throw new MockError(
        'Chưa có cấu hình dịch vụ cho phòng trong toàn bộ giai đoạn tính phí.',
        422,
      )
    if (!data.billingMonth.endsWith('-01'))
      throw new MockError('Kỳ tính phí phải là ngày đầu tháng.', 422)
    const nextDate = new Date(data.billingMonth)
    nextDate.setUTCMonth(nextDate.getUTCMonth() + 1)
    const next = nextDate.toISOString().slice(0, 10),
      sorted = [...data.segments].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const segments = sorted.map((s, n) => {
      period(s.startDate, s.endDate)
      if (
        s.startDate < data.billingMonth ||
        s.endDate > next ||
        (n > 0 && sorted[n - 1].endDate !== s.startDate)
      )
        throw new MockError('Các đoạn phải liên tiếp, không chồng lấn và nằm trong tháng.', 422)
      let quantity = thousandths(s.quantity)
      if (service.billingMethod === 'METERED') {
        if (s.previousReading === null || s.currentReading === null || !s.meterId)
          throw new MockError('Dịch vụ tính theo chỉ số cần công tơ và hai số đọc.', 422)
        if (![0, 1].some((n) => e.meterId(room.id, service.id, n) === s.meterId))
          throw new MockError('Công tơ không thuộc phòng và dịch vụ đang tính phí.', 422)
        if (n > 0 && s.reason === 'METER_REPLACEMENT' && sorted[n - 1].meterId === s.meterId)
          throw new MockError('Thay công tơ cần chọn thiết bị khác.', 422)
        if (n > 0 && s.reason !== 'METER_REPLACEMENT' && sorted[n - 1].meterId !== s.meterId)
          throw new MockError('Công tơ thay đổi cần khai báo đoạn thay thiết bị.', 422)
        const start = thousandths(s.previousReading),
          end = thousandths(s.currentReading)
        if (end < start)
          throw new MockError(
            'Chỉ số cuối không nhỏ hơn đầu. Khi thay/reset công tơ, tách thành đoạn mới.',
            422,
          )
        if (s.reason === 'METER_RESET' && start !== 0n)
          throw new MockError('Đoạn sau reset phải bắt đầu từ số đọc 0.', 422)
        if (
          n > 0 &&
          !['METER_RESET', 'METER_REPLACEMENT'].includes(s.reason) &&
          sorted[n - 1].currentReading !== s.previousReading
        )
          throw new MockError('Chỉ số giữa các đoạn không liên tục.', 422)
        quantity = end - start
      }
      if (quantity <= 0n) throw new MockError('Số lượng tiêu thụ phải lớn hơn 0.', 422)
      const amount = Number((quantity * BigInt(s.unitPrice) + 500n) / 1000n)
      if (!Number.isSafeInteger(amount)) throw new MockError('Số tiền tính phí vượt giới hạn.', 422)
      return {
        id: crypto.randomUUID(),
        startDate: s.startDate,
        endDate: s.endDate,
        previousReading: service.billingMethod === 'METERED' ? s.previousReading : null,
        currentReading: service.billingMethod === 'METERED' ? s.currentReading : null,
        quantity: Number(quantity) / 1000,
        unit: service.unit,
        unitPrice: s.unitPrice,
        amount,
        reasonType: s.reason,
        meterId: s.meterId,
        reason:
          s.reason === 'NORMAL'
            ? 'Chốt chỉ số thông thường'
            : s.reason === 'PRICE_CHANGE'
              ? 'Thay đổi đơn giá'
              : s.reason === 'METER_RESET'
                ? 'Đặt lại công tơ'
                : 'Thay công tơ',
      }
    })
    const total = segments.reduce((sum, s) => sum + s.amount, 0)
    if (!Number.isSafeInteger(total)) throw new MockError('Tổng khoản phí vượt giới hạn.', 422)
    const value: ManagerCharge = {
      id: current?.id || crypto.randomUUID(),
      roomId: room.id,
      roomName: room.title,
      serviceId: service.id,
      contractTenantId: null,
      name: service.name,
      billingMonth: data.billingMonth,
      startDate: segments[0].startDate,
      endDate: segments.at(-1)!.endDate,
      status: 'DRAFT',
      totalAmount: total,
      myAmount: 0,
      invoiceId: null,
      segments,
      participants: [],
      evidence: data.evidence.map((a) => a.url),
      snapshot:
        'Giá và chỉ số theo từng đoạn được quản lý chốt. Tiền VND làm tròn nửa lên; phân bổ từng đoạn theo ngày cư trú và phần dư lớn nhất.',
    }
    if (current) Object.assign(current, value)
    else e.state.charges.push(value)
    return value
  }
  if (resource === 'cost-allocations') {
    const p = e.tenant.state.proposals.find(
      (p) =>
        p.id === id &&
        e.tenant.state.tenancies.some(
          (t) => t.id === p.contractTenantId && t.branchId === branchId,
        ),
    )
    if (!p) throw new MockError('Không tìm thấy đề xuất thuộc chi nhánh.', 404)
    const data = z
      .object({
        decision: z.enum(['approve', 'reject']),
        reason: z.string().trim().min(5).max(1000),
      })
      .parse(input)
    if (p.status !== 'PENDING') throw new MockError('Đề xuất đã có kết quả xử lý.', 409)
    const t = e.tenancy(branchId, p.contractTenantId),
      charge = e.tenant.state.charges.find(
        (c) => c.id === p.chargeId && c.contractTenantId === t.id,
      )
    if (!charge) throw new MockError('Khoản phí nguồn không còn hợp lệ.', 409)
    if (data.decision === 'approve') {
      const ids = charge.participants.map((p) => p.id)
      if (
        p.shares.length !== ids.length ||
        new Set(p.shares.map((s) => s.id)).size !== ids.length ||
        p.shares.some(
          (s) => !ids.includes(s.id) || !Number.isSafeInteger(s.amount) || s.amount < 0,
        ) ||
        p.shares.reduce((sum, s) => sum + s.amount, 0) !== charge.totalAmount
      )
        throw new MockError(
          'Không thể duyệt đề xuất có tổng hoặc người tham gia không hợp lệ.',
          422,
        )
      for (const old of e.tenant.state.proposals.filter(
        (old) => old.id !== p.id && old.chargeId === p.chargeId && old.status === 'APPROVED',
      ))
        old.status = 'SUPERSEDED'
      const finalized = e.tenant.state.charges
        .filter((c) => c.id === charge.id)
        .some(
          (c) =>
            c.invoiceId &&
            e.tenant.state.invoices.some(
              (i) => i.id === c.invoiceId && i.documentStatus === 'ISSUED',
            ),
        )
      if (!finalized)
        for (const c of e.tenant.state.charges.filter((c) => c.id === charge.id)) {
          c.myAmount = p.shares.find((s) => s.id === c.contractTenantId)?.amount || 0
          c.participants = c.participants.map((part) => ({
            ...part,
            amount: p.shares.find((s) => s.id === part.id)!.amount,
          }))
        }
    }
    p.status = data.decision === 'approve' ? 'APPROVED' : 'REJECTED'
    p.decisionAt = 0
    p.decidedAt = new Date().toISOString()
    p.decision = `${actor.fullName}: ${data.reason}. Hóa đơn đã phát hành giữ nguyên; điều chỉnh cần quy trình được duyệt.`
    e.notifyTenant(t, 'Đề xuất phân bổ đã được quản lý xử lý', 'TENANT_ALLOCATION', p.id)
    return p
  }
  if (resource === 'furnitures') {
    const current = id ? e.state.assets.find((a) => a.id === id && a.branchId === branchId) : null
    if (id && !current) throw new MockError('Không tìm thấy tài sản thuộc chi nhánh.', 404)
    if (action.startsWith('warranty')) {
      if (!current) throw new MockError('Chọn tài sản.', 422)
      const raw = z.object({ warrantyId: z.string().uuid().optional() }).parse(input),
        warranty = current.warranties.find((w) => w.id === raw.warrantyId)
      if (action === 'warranty-delete') {
        if (!warranty) throw new MockError('Không tìm thấy bảo hành.', 404)
        if (warranty.startDate <= new Date().toISOString().slice(0, 10))
          throw new MockError('Giữ lịch sử bảo hành đã có hiệu lực.', 409)
        current.warranties = current.warranties.filter((w) => w.id !== warranty.id)
        return current
      }
      const data = warrantyInputSchema.parse(input)
      period(data.startDate, data.endDate)
      if (warranty) Object.assign(warranty, data)
      else current.warranties.push({ id: crypto.randomUUID(), ...data })
      return current
    }
    if (method === 'DELETE') {
      if (e.tenant.state.reports.some((r) => r.assetId === id))
        throw new MockError('Tài sản có lịch sử sửa chữa; không thể xóa.', 409)
      e.state.assets = e.state.assets.filter((a) => a.id !== id)
      return null
    }
    const data = assetInputSchema.parse(input)
    e.room(branchId, data.roomId)
    if (
      data.roomSlotId &&
      !e.inventory.state.slots.some((s) => s.id === data.roomSlotId && s.roomId === data.roomId)
    )
      throw new MockError('Chỗ ở không thuộc phòng của tài sản.', 422)
    if (
      e.state.assets.some(
        (a) =>
          a.branchId === branchId &&
          a.id !== id &&
          a.code.toLowerCase() === data.code.toLowerCase(),
      )
    )
      throw new MockError('Mã tài sản đã tồn tại.', 409)
    if (current && (current.roomId !== data.roomId || current.roomSlotId !== data.roomSlotId))
      throw new MockError(
        'Không chuyển tài sản có hồ sơ giữa các phòng/chỗ trong giai đoạn này.',
        409,
      )
    if (
      current &&
      data.operationalStatus === 'INACTIVE' &&
      e.tenant.state.reports.some(
        (r) => r.assetId === id && ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status),
      )
    )
      throw new MockError('Tài sản đang trong quy trình sửa chữa.', 409)
    if (current) Object.assign(current, data)
    else e.state.assets.push({ id: crypto.randomUUID(), branchId, ...data, warranties: [] })
    return current || e.state.assets.at(-1)
  }
  if (resource === 'maintenance') {
    const r = e.tenant.state.reports.find(
      (r) =>
        r.id === id &&
        e.tenant.state.tenancies.some(
          (t) => t.id === r.contractTenantId && t.branchId === branchId,
        ),
    )
    if (!r) throw new MockError('Không tìm thấy yêu cầu sửa chữa thuộc chi nhánh.', 404)
    const t = e.tenancy(branchId, r.contractTenantId),
      data = z
        .object({
          reason: z.string().trim().min(5).max(2000),
          handler: z.string().trim().min(2).max(100).optional(),
          recordId: z.string().uuid().optional(),
        })
        .parse(input)
    const append = (status: string, description: string, evidence: string[] = []) =>
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status,
        description,
        performedBy: actor.fullName,
        evidence,
        cost: 0,
        responsibleParty: null,
        approvalStatus: null,
      })
    if (action === 'accept') {
      if (r.status !== 'OPEN') throw new MockError('Chỉ tiếp nhận yêu cầu mới.', 409)
      r.status = 'ACCEPTED'
      r.assignedTo = data.handler || actor.fullName
      append(r.status, data.reason)
    } else if (action === 'reject') {
      if (r.status !== 'OPEN') throw new MockError('Chỉ từ chối yêu cầu chưa được tiếp nhận.', 409)
      r.status = 'REJECTED'
      append(r.status, data.reason)
    } else if (action === 'assign') {
      if (!['ACCEPTED', 'IN_PROGRESS'].includes(r.status) || !data.handler)
        throw new MockError('Cần yêu cầu đang xử lý và người được phân công.', 409)
      r.assignedTo = data.handler
      append(r.status, `${data.reason} · Phân công ${data.handler}.`)
    } else if (action === 'start') {
      if (r.status !== 'ACCEPTED' || !r.assignedTo)
        throw new MockError('Tiếp nhận và phân công trước khi bắt đầu sửa.', 409)
      r.status = 'IN_PROGRESS'
      append(r.status, data.reason)
    } else if (action === 'record') {
      if (!['ACCEPTED', 'IN_PROGRESS'].includes(r.status))
        throw new MockError('Chỉ thêm nhật ký trong quá trình xử lý.', 409)
      const record = recordInputSchema.parse(input)
      validateAttachments(record.evidence)
      if (record.cost > 0 && !record.responsibleParty)
        throw new MockError('Chi phí cần khai báo bên chịu trách nhiệm.', 422)
      r.records.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: r.status,
        description: record.description,
        performedBy: actor.fullName,
        evidence: record.evidence.map((a) => a.url),
        cost: record.cost,
        responsibleParty: record.cost ? record.responsibleParty : null,
        approvalStatus: record.cost ? 'PENDING' : null,
      })
    } else if (action === 'cost-approve' || action === 'cost-reject') {
      if (t.userId === actor.id)
        throw new MockError('Không tự duyệt trách nhiệm tài chính của chính mình.', 403)
      const record = r.records.find((v) => v.id === data.recordId && v.cost > 0)
      if (!record || record.approvalStatus !== 'PENDING')
        throw new MockError('Khoản chi phí không còn chờ xét duyệt.', 409)
      record.approvalStatus = action === 'cost-approve' ? 'APPROVED' : 'REJECTED'
      append(r.status, `${data.reason} · Chi phí ${record.id}: ${record.approvalStatus}.`)
    } else if (action === 'complete') {
      if (
        r.status !== 'IN_PROGRESS' ||
        !r.records.some((record) => record.status === 'IN_PROGRESS')
      )
        throw new MockError('Cần bắt đầu xử lý và có nhật ký trước khi hoàn tất.', 409)
      r.status = 'COMPLETED'
      append(r.status, data.reason)
    } else throw new MockError('Thao tác sửa chữa không được hỗ trợ.', 404)
    r.workflowAt = 0
    e.notifyTenant(t, 'Yêu cầu sửa chữa đã được cập nhật', 'TENANT_MAINTENANCE', r.id)
    return r
  }
  throw new MockError('Thao tác quản lý không được hỗ trợ.', 404)
}
export function saveZalo(e: ManagerEngine, actor: User, branchId: string, input: unknown) {
  const b = e.scope(actor, branchId, true),
    data = z.object({ url: z.string().trim().max(500), enabled: z.boolean() }).parse(input)
  if ((data.url && !safeZalo(data.url)) || (data.enabled && !data.url))
    throw new MockError('Nhập liên kết nhóm HTTPS trên zalo.me/g/ hợp lệ.', 422)
  b.zaloUrl = data.url ? safeZalo(data.url) : null
  b.zaloEnabled = data.enabled
  e.save()
  for (const t of e.tenant.state.tenancies.filter(
    (t) => t.branchId === branchId && t.status === 'ACTIVE',
  ))
    e.notifyTenant(t, 'Thông tin nhóm sinh hoạt chi nhánh đã cập nhật', 'TENANT_BRANCH', b.id)
  return b
}
