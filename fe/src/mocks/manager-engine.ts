import { z } from 'zod'
import { db, MockDatabase, MockError, overlaps } from './database'
import { inventory, seedInventory, type MockInventory } from './inventory'
import { tenantDb, type TenantEngine } from './tenant-engine'
import {
  seedManager,
  managerUser,
  ownerUser,
  otherManager,
  type ManagerState,
} from './manager-fixtures'
import { fixtureId, allocations } from './fixtures'
import { tenantUser, roommateUser, seedTenant } from './tenant-fixtures'
import {
  roomInputSchema,
  roomTypeInputSchema,
  slotInputSchema,
  type ManagerResource,
  type ManagerRoom,
} from '@/interfaces/manager'
import type { User } from '@/interfaces/domain'
import type { Tenancy } from '@/interfaces/tenant'
import { leasingAction } from './manager-leasing'
import { financeAction, paymentViews, invoiceSources, reportSummary } from './manager-finance'
import { operationsAction, chargeViews } from './manager-operations'
import { validateImage } from './image-validation'

export class ManagerEngine {
  ownerEligible: (user: User) => boolean = (user) => user.id === ownerUser.id
  private transactionDepth = 0
  state: ManagerState
  db: MockDatabase
  tenant: TenantEngine
  inventory: MockInventory
  constructor(
    database: MockDatabase,
    tenants: TenantEngine,
    catalog: MockInventory,
    state?: ManagerState,
  ) {
    this.db = database
    this.tenant = tenants
    this.inventory = catalog
    this.state = state || seedManager(tenants.state, catalog.state)
    this.initialize()
  }
  initialize() {
    const database = this.db,
      tenants = this.tenant
    for (const user of [managerUser, ownerUser, otherManager, tenantUser, roommateUser])
      if (!database.state.users.some((u) => u.id === user.id))
        database.state.users.push(structuredClone(user))
    for (const service of tenants.state.services) {
      const t = tenants.state.tenancies.find((t) => t.id === service.contractTenantId)
      const actual = this.state.services.find(
        (s) => s.branchId === t?.branchId && s.name === service.name,
      )
      if (actual) service.id = actual.id
    }
    database.occupancyProvider = () =>
      tenants.state.tenancies
        .filter(
          (t) =>
            ['DRAFT', 'ACTIVE'].includes(t.status) &&
            ['DRAFT', 'ACTIVE'].includes(t.contractStatus),
        )
        .map((t) => ({
          roomId: t.roomId,
          reserved: t.status === 'DRAFT',
          roomSlotId: t.roomSlotId,
          startDate: t.startDate,
          endDate: t.actualLeaveDate || t.endDate,
        }))
    database.bookingAllocationActive = (b) => b.status !== 'CONVERTED'
    tenants.branchSettings = (id) => {
      const b = this.state.branches.find((b) => b.id === id)
      return { zaloUrl: b?.zaloUrl || null, enabled: !!b?.zaloEnabled }
    }
    tenants.serviceEligibility = (t, serviceId, start, end) => {
      if (
        !this.state.services.some(
          (s) => s.id === serviceId && s.branchId === t.branchId && s.active,
        )
      )
        return null
      const configs = this.state.roomServices
        .filter((s) => s.roomId === t.roomId && s.serviceId === serviceId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
      const quote = configs.find((s) => s.startDate <= start && s.endDate > start)
      let cursor = start
      for (const config of configs)
        if (config.startDate <= cursor && config.endDate > cursor) cursor = config.endDate
      return quote && cursor >= end ? quote.unitPrice : null
    }
    tenants.furnitureProvider = (t) => [
      ...this.state.assets
        .filter(
          (a) =>
            a.roomId === t.roomId &&
            a.operationalStatus !== 'INACTIVE' &&
            (!a.roomSlotId || a.roomSlotId === t.roomSlotId),
        )
        .map((a) => ({
          id: a.id,
          name: a.name,
          category: 'FURNITURE' as const,
          condition: a.condition,
        })),
      ...tenants.state.services
        .filter((s) => s.contractTenantId === t.id && s.mandatory)
        .map((s) => ({
          id: s.id,
          name: s.name,
          category: 'SERVICE' as const,
          condition: 'Đang hoạt động',
        })),
    ]
    if (!this.state.paymentMeta[fixtureId(7900)]) {
      const t = tenants.state.tenancies.find((t) => t.id === fixtureId(5101)),
        i = tenants.state.invoices.find(
          (i) => i.contractTenantId === t?.id && i.documentStatus === 'ISSUED',
        )
      if (t && i) {
        tenants.state.payments.push({
          id: fixtureId(7900),
          contractTenantId: t.id,
          invoiceId: i.id,
          reference: 'TP-QR-DEMO-01',
          amountReceived: 50000,
          allocatedAmount: 0,
          prepaidFirstAmount: 0,
          prepaidLastAmount: 0,
          prepaidFirstApplied: 0,
          prepaidLastApplied: 0,
          payerName: 'Trần Gia Linh',
          method: 'TRANSFER',
          environment: 'LIVE',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          verifiedAt: null,
          evidence: ['/demo/room-2.webp'],
          settlementAt: 0,
          outcome: 'pending',
          idempotencyKey: fixtureId(7901),
        })
        this.state.paymentMeta[fixtureId(7900)] = {
          providerTransactionId: 'BANK-DEMO-0001',
          expectedReference: 'TP-QR-DEMO-01',
          amount: 50000,
          history: [],
          note: 'Biên nhận ngân hàng giả lập được nạp bởi bộ dữ liệu demo.',
        }
      }
    }
  }
  save() {
    if (this.transactionDepth > 0) return
    if (typeof sessionStorage === 'undefined') return
    const entries = [
      ['tropro-inventory-v1', JSON.stringify(this.inventory.state)],
      ['tropro-tenant-v1', JSON.stringify(this.tenant.state)],
      ['tropro-demo-v2', JSON.stringify(this.db.state)],
      ['tropro-manager-v1', JSON.stringify(this.state)],
    ] as const
    const previous = entries.map(([key]) => [key, sessionStorage.getItem(key)] as const)
    try {
      for (const [key, value] of entries) sessionStorage.setItem(key, value)
    } catch {
      for (const [key, value] of previous) {
        try {
          if (value === null) sessionStorage.removeItem(key)
          else sessionStorage.setItem(key, value)
        } catch {
          /* Preserve the in-memory rollback even when storage is unavailable. */
        }
      }
      throw new MockError('Bộ nhớ demo đã đầy. Giảm số lượng hoặc dung lượng ảnh rồi thử lại.', 422)
    }
  }
  transaction<T>(operation: () => T, preview = false): T {
    const before = structuredClone({
      manager: this.state,
      tenant: this.tenant.state,
      db: this.db.state,
      inventory: this.inventory.state,
    })
    const restore = () => {
      this.state = before.manager
      this.tenant.state = before.tenant
      this.db.state = before.db
      this.inventory.state = before.inventory
    }
    this.transactionDepth++
    let result: T
    try {
      result = operation()
      if (preview) {
        result = structuredClone(result)
        restore()
      }
    } catch (error) {
      restore()
      throw error
    } finally {
      this.transactionDepth--
    }
    try {
      if (!preview) this.save()
      return result
    } catch (error) {
      restore()
      throw error
    }
  }
  branches(actor: User) {
    const canonical = this.db.state.users.find((u) => u.id === actor.id && u.status === 'ACTIVE')
    if (!canonical) return []
    actor = canonical
    if (!actor.roles.some((r) => r === 'MANAGER' || r === 'OWNER')) return []
    return this.state.branches.filter(
      (b) =>
        (actor.roles.includes('OWNER') && this.ownerEligible(actor) && b.ownerId === actor.id) ||
        (actor.roles.includes('MANAGER') &&
          b.managerId === actor.id &&
          this.state.ownerManagers.some(
            (a) => a.managerId === actor.id && a.ownerId === b.ownerId,
          )),
    )
  }
  scope(actor: User, branchId: string, write = false) {
    if (!z.string().uuid().safeParse(branchId).success)
      throw new MockError('Mã chi nhánh chưa hợp lệ.', 422)
    const branch = this.branches(actor).find((b) => b.id === branchId)
    if (!branch) throw new MockError('Bạn không còn quyền quản lý chi nhánh này.', 403)
    if (write && branch.status !== 'ACTIVE')
      throw new MockError('Chi nhánh không còn hoạt động.', 409)
    return branch
  }
  room(branchId: string, id: string) {
    const room = this.inventory.state.rooms.find((r) => r.id === id && r.branchId === branchId)
    if (!room) throw new MockError('Không tìm thấy phòng thuộc chi nhánh.', 404)
    return room
  }
  tenancy(branchId: string, id: string) {
    const t = this.tenant.state.tenancies.find((t) => t.id === id && t.branchId === branchId)
    if (!t) throw new MockError('Không tìm thấy quan hệ thuê thuộc chi nhánh.', 404)
    return t
  }
  contract(branchId: string, id: string) {
    const c = this.state.contracts.find((c) => c.id === id && c.branchId === branchId)
    if (!c) throw new MockError('Không tìm thấy hợp đồng thuộc chi nhánh.', 404)
    return c
  }
  user(id: string) {
    const user = this.db.state.users.find((u) => u.id === id && u.status === 'ACTIVE')
    if (!user) throw new MockError('Chọn tài khoản đã xác minh.', 422)
    return user
  }
  namedTenancy(t: Tenancy) {
    const u = this.db.state.users.find((u) => u.id === t.userId)
    return {
      ...t,
      userName: u?.fullName || 'Người thuê',
      email: u?.email || '',
      phone: u?.phone || null,
      sourceBookingId:
        this.state.contracts.find((c) => c.id === t.contractId)?.sourceBookingId || null,
    }
  }
  overlapsRoom(
    roomId: string,
    slotId: string | null,
    start: string,
    end: string,
    excludeContract?: string,
    excludeBooking?: string,
  ) {
    return [
      ...allocations.filter((a) => a.roomId === roomId),
      ...this.tenant.state.tenancies
        .filter(
          (t) =>
            t.roomId === roomId &&
            t.contractId !== excludeContract &&
            ['DRAFT', 'ACTIVE'].includes(t.status) &&
            ['DRAFT', 'ACTIVE'].includes(t.contractStatus),
        )
        .map((t) => ({
          roomId: t.roomId,
          roomSlotId: t.roomSlotId,
          startDate: t.startDate,
          endDate: t.endDate,
        })),
      ...this.db.state.bookings.filter(
        (b) =>
          b.roomId === roomId &&
          b.id !== excludeBooking &&
          ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(b.status),
      ),
    ].some(
      (a) =>
        (!slotId || !a.roomSlotId || a.roomSlotId === slotId) &&
        overlaps(start, end, a.startDate, a.endDate),
    )
  }
  protectedRoom(roomId: string) {
    return (
      this.state.contracts.some(
        (c) => c.roomId === roomId && ['DRAFT', 'ACTIVE'].includes(c.status),
      ) ||
      this.tenant.state.tenancies.some(
        (t) =>
          t.roomId === roomId &&
          ['DRAFT', 'ACTIVE'].includes(t.status) &&
          ['DRAFT', 'ACTIVE'].includes(t.contractStatus),
      ) ||
      this.db.state.bookings.some(
        (b) =>
          b.roomId === roomId && ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(b.status),
      )
    )
  }
  occupancy(room: ManagerRoom, start: string, end: string) {
    const ts = this.tenant.state.tenancies.filter(
      (t) =>
        t.roomId === room.id &&
        t.status === 'ACTIVE' &&
        overlaps(start, end, t.startDate, t.endDate),
    )
    const holds = [
      ...this.db.state.bookings.filter((b) =>
        ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(b.status),
      ),
      ...this.tenant.state.tenancies.filter(
        (t) => t.status === 'DRAFT' && ['DRAFT', 'ACTIVE'].includes(t.contractStatus),
      ),
    ].filter((b) => b.roomId === room.id && overlaps(start, end, b.startDate, b.endDate))
    const occupied =
      room.rentalMode === 'ROOM'
        ? Number(
            ts.length > 0 ||
              allocations.some(
                (a) =>
                  a.roomId === room.id &&
                  !a.roomSlotId &&
                  overlaps(start, end, a.startDate, a.endDate),
              ),
          )
        : new Set([
            ...ts.map((t) => t.roomSlotId),
            ...allocations
              .filter((a) => a.roomId === room.id && overlaps(start, end, a.startDate, a.endDate))
              .map((a) => a.roomSlotId),
          ]).size
    const held =
      room.rentalMode === 'ROOM'
        ? Number(!occupied && holds.length > 0)
        : new Set(
            holds
              .map((b) => b.roomSlotId)
              .filter(
                (id) =>
                  !ts.some((t) => t.roomSlotId === id) &&
                  !allocations.some(
                    (a) =>
                      a.roomId === room.id &&
                      a.roomSlotId === id &&
                      overlaps(start, end, a.startDate, a.endDate),
                  ),
              ),
          ).size
    return {
      ...room,
      occupiedResources: occupied,
      heldResources: held,
      availability:
        room.operationalStatus !== 'ACTIVE'
          ? room.operationalStatus
          : occupied >= (room.rentalMode === 'ROOM' ? 1 : room.capacity)
            ? 'OCCUPIED'
            : held
              ? 'HELD'
              : 'AVAILABLE',
    } as ManagerRoom
  }
  list(
    actor: User,
    branchId: string,
    resource: ManagerResource,
    params = new URLSearchParams(),
  ): unknown[] {
    this.scope(actor, branchId)
    for (const key of ['startDate', 'endDate', 'from', 'to'])
      if (params.get(key) && !z.iso.date().safeParse(params.get(key)).success)
        throw new MockError('Bộ lọc ngày chưa hợp lệ.', 422)
    if (
      (params.get('startDate') &&
        params.get('endDate') &&
        params.get('endDate')! <= params.get('startDate')!) ||
      (params.get('from') && params.get('to') && params.get('to')! < params.get('from')!)
    )
      throw new MockError('Khoảng ngày lọc chưa hợp lệ.', 422)
    if (
      params.get('minPrice') &&
      params.get('maxPrice') &&
      Number(params.get('minPrice')) > Number(params.get('maxPrice'))
    )
      throw new MockError('Khoảng giá chưa hợp lệ.', 422)
    const today = new Date().toISOString().slice(0, 10),
      end = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      roomIds = new Set(
        this.inventory.state.rooms.filter((r) => r.branchId === branchId).map((r) => r.id),
      )
    let records: unknown[] = []
    switch (resource) {
      case 'meters':
        records = this.inventory.state.rooms
          .filter((r) => r.branchId === branchId)
          .flatMap((r) =>
            this.state.services
              .filter((s) => s.branchId === branchId && s.billingMethod === 'METERED')
              .flatMap((s) =>
                [0, 1].map((n) => ({
                  id: this.meterId(r.id, s.id, n),
                  branchId,
                  roomId: r.id,
                  serviceId: s.id,
                  label: `${r.code} · ${s.name} · ${n ? 'Công tơ thay thế' : 'Công tơ chính'}`,
                })),
              ),
          )
        break
      case 'rooms':
        records = this.inventory.state.rooms
          .filter((r) => r.branchId === branchId)
          .map((r) =>
            this.occupancy(r, params.get('startDate') || today, params.get('endDate') || end),
          )
        break
      case 'room-types':
        records = this.inventory.state.types.filter((t) => t.branchId === branchId)
        break
      case 'slots':
        records = this.inventory.state.slots
          .filter(
            (s) =>
              s.branchId === branchId &&
              (!params.get('roomId') || s.roomId === params.get('roomId')),
          )
          .map((s) => {
            const ts = this.tenant.state.tenancies.filter((t) => t.roomSlotId === s.id)
            const active = ts.some(
              (t) =>
                t.status === 'ACTIVE' &&
                overlaps(
                  params.get('startDate') || today,
                  params.get('endDate') || end,
                  t.startDate,
                  t.endDate,
                ),
            )
            const held =
              ts.some(
                (t) =>
                  t.status === 'DRAFT' &&
                  ['DRAFT', 'ACTIVE'].includes(t.contractStatus) &&
                  overlaps(
                    params.get('startDate') || today,
                    params.get('endDate') || end,
                    t.startDate,
                    t.endDate,
                  ),
              ) ||
              this.db.state.bookings.some(
                (b) =>
                  b.roomSlotId === s.id &&
                  ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(b.status) &&
                  overlaps(
                    params.get('startDate') || today,
                    params.get('endDate') || end,
                    b.startDate,
                    b.endDate,
                  ),
              )
            return {
              ...s,
              availability:
                s.operationalStatus !== 'ACTIVE'
                  ? s.operationalStatus
                  : active
                    ? 'OCCUPIED'
                    : held
                      ? 'HELD'
                      : 'AVAILABLE',
              occupancy: ts.map((t) => ({
                id: t.id,
                name: this.namedTenancy(t).userName,
                startDate: t.startDate,
                endDate: t.endDate,
                status: t.status,
              })),
            }
          })
        break
      case 'tenants':
        records = this.tenant.state.tenancies
          .filter((t) => t.branchId === branchId)
          .map((t) => this.namedTenancy(t))
        break
      case 'appointments':
        records = this.db.state.appointments
          .filter((a) => roomIds.has(a.roomId))
          .map((a) => ({ ...a, ...this.contact(a.requesterUserId) }))
        break
      case 'bookings':
        records = this.db.state.bookings
          .filter((b) => b.branchId === branchId)
          .map((b) => ({ ...b, ...this.contact(b.requesterUserId) }))
        break
      case 'contracts':
        records = this.state.contracts
          .filter((c) => c.branchId === branchId)
          .map((c) => {
            const ts = this.tenant.state.tenancies.filter((t) => t.contractId === c.id)
            const rep =
              ts.find((t) => t.role === 'REPRESENTATIVE' && t.status === 'ACTIVE') ||
              ts.find((t) => t.role === 'REPRESENTATIVE')
            return {
              ...c,
              tenantCount: ts.length,
              roomName: this.room(branchId, c.roomId).title,
              representativeName: rep ? this.namedTenancy(rep).userName : null,
            }
          })
        break
      case 'services':
        records = this.state.services.filter((s) => s.branchId === branchId)
        break
      case 'room-services':
        records = this.state.roomServices.filter((s) => s.branchId === branchId)
        break
      case 'service-requests':
        records = this.tenant.state.services
          .filter(
            (s) =>
              this.tenant.state.tenancies.some(
                (t) => t.id === s.contractTenantId && t.branchId === branchId,
              ) && s.subscriptionId,
          )
          .map((s) => {
            const t = this.tenancy(branchId, s.contractTenantId)
            return {
              ...s,
              id: s.subscriptionId!,
              serviceId: s.id,
              roomId: t.roomId,
              tenantName: this.namedTenancy(t).userName,
              roomName: t.roomName,
            }
          })
        break
      case 'utility-charges':
        records = chargeViews(this, branchId)
        break
      case 'cost-allocations':
        records = this.tenant.state.proposals
          .filter((p) =>
            this.tenant.state.tenancies.some(
              (t) => t.id === p.contractTenantId && t.branchId === branchId,
            ),
          )
          .map((p) => {
            const t = this.tenancy(branchId, p.contractTenantId),
              c = this.tenant.state.charges.find(
                (c) => c.id === p.chargeId && c.contractTenantId === t.id,
              )
            return {
              ...p,
              roomId: t.roomId,
              tenantName: this.namedTenancy(t).userName,
              chargeName: c?.name || 'Phí sinh hoạt',
              invoiceId: c?.invoiceId || null,
              sourceAmount: c?.totalAmount || 0,
              defaultShares:
                c?.participants.map((s) => ({ id: s.id, label: s.label, amount: s.amount })) || [],
            }
          })
        break
      case 'invoices':
        records = this.tenant.state.invoices
          .filter((i) =>
            this.tenant.state.tenancies.some(
              (t) => t.id === i.contractTenantId && t.branchId === branchId,
            ),
          )
          .map((i) => {
            const t = this.tenancy(branchId, i.contractTenantId)
            return {
              ...this.tenant.invoice(t, i.id),
              tenantName: this.namedTenancy(t).userName,
              roomName: t.roomName,
              roomId: t.roomId,
            }
          })
        break
      case 'payments':
        records = paymentViews(this, branchId)
        break
      case 'furnitures':
        records = this.state.assets.filter((a) => a.branchId === branchId)
        break
      case 'maintenance':
        records = this.tenant.state.reports
          .filter((r) =>
            this.tenant.state.tenancies.some(
              (t) => t.id === r.contractTenantId && t.branchId === branchId,
            ),
          )
          .map((r) => {
            const t = this.tenancy(branchId, r.contractTenantId)
            return {
              ...r,
              roomId: t.roomId,
              roomName: t.roomName,
              tenantName: this.namedTenancy(t).userName,
            }
          })
        break
    }
    const q = (params.get('q') || '').toLocaleLowerCase('vi')
    return records.filter((row) => {
      const r = row as Record<string, unknown>
      return (
        (!q || JSON.stringify(r).toLocaleLowerCase('vi').includes(q)) &&
        [
          'status',
          'documentStatus',
          'financialStatus',
          'rentalMode',
          'operationalStatus',
          'availability',
          'roomId',
          'roomTypeId',
          'contractTenantId',
          'contractId',
          'roomSlotId',
          'bookingId',
          'invoiceId',
          'targetType',
          'environment',
          'assetId',
        ].every((k) => !params.get(k) || String(r[k]) === params.get(k)) &&
        (params.get('debtOnly') !== 'true' || Number(r.outstanding) > 0) &&
        (!params.get('month') ||
          String(r.billingMonth || r.createdAt).startsWith(params.get('month')!)) &&
        (!params.get('minPrice') || Number(r.price) >= Number(params.get('minPrice'))) &&
        (!params.get('maxPrice') || Number(r.price) <= Number(params.get('maxPrice'))) &&
        (!params.get('capacity') || Number(r.capacity) >= Number(params.get('capacity'))) &&
        (!params.get('from') ||
          String(r.endDate || r.endAt || r.createdAt) >= params.get('from')!) &&
        (!params.get('to') ||
          String(r.startDate || r.startAt || r.createdAt).slice(0, 10) <= params.get('to')!)
      )
    })
  }
  get(actor: User, branchId: string, resource: ManagerResource, id: string) {
    const row = this.list(actor, branchId, resource).find(
      (row) => (row as { id: string }).id === id,
    )
    if (!row) throw new MockError('Không tìm thấy dữ liệu thuộc chi nhánh.', 404)
    return row
  }
  meterId(roomId: string, serviceId: string, index: number) {
    return (
      roomId.slice(0, 8) +
      '-' +
      serviceId.slice(-4) +
      '-4' +
      roomId.slice(-3) +
      '-a' +
      serviceId.slice(-3) +
      '-' +
      roomId.slice(-11) +
      (index ? '1' : '0')
    )
  }
  contact(userId: string) {
    const user = this.db.state.users.find((u) => u.id === userId)
    return {
      requesterName: user?.fullName || 'Người yêu cầu',
      requesterEmail: user?.email || '',
      requesterPhone: user?.phone || null,
    }
  }
  roomWrite(
    actor: User,
    branchId: string,
    resource: 'rooms' | 'room-types' | 'slots',
    id: string | null,
    method: string,
    input: unknown,
  ) {
    this.scope(actor, branchId, true)
    if (resource === 'rooms') {
      const current = id ? this.room(branchId, id) : null
      if (method === 'DELETE') {
        if (!current) throw new MockError('Không tìm thấy phòng.', 404)
        if (
          this.protectedRoom(current.id) ||
          this.tenant.state.tenancies.some((t) => t.roomId === current.id) ||
          this.state.contracts.some((c) => c.roomId === current.id) ||
          this.db.state.bookings.some((v) => v.roomId === current.id) ||
          this.db.state.appointments.some((v) => v.roomId === current.id) ||
          this.state.assets.some((a) => a.roomId === current.id)
        )
          throw new MockError('Phòng có hồ sơ liên quan; hãy ngừng công khai thay vì xóa.', 409)
        this.inventory.state.rooms = this.inventory.state.rooms.filter((r) => r.id !== id)
        this.inventory.state.slots = this.inventory.state.slots.filter((s) => s.roomId !== id)
        this.state.roomServices = this.state.roomServices.filter((s) => s.roomId !== id)
        return null
      }
      const data = roomInputSchema.parse(input),
        type = this.inventory.state.types.find(
          (t) => t.id === data.roomTypeId && t.branchId === branchId && t.active,
        )
      if (!type) throw new MockError('Loại phòng không thuộc chi nhánh hoặc đã ngừng sử dụng.', 422)
      if (
        this.inventory.state.rooms.some(
          (r) =>
            r.branchId === branchId &&
            r.id !== id &&
            r.code.toLowerCase() === data.code.toLowerCase(),
        )
      )
        throw new MockError('Mã phòng đã tồn tại trong chi nhánh.', 409)
      if (
        current &&
        this.protectedRoom(current.id) &&
        (current.rentalMode !== data.rentalMode ||
          data.capacity < current.capacity ||
          data.operationalStatus !== 'ACTIVE')
      )
        throw new MockError('Thay đổi ảnh hưởng hợp đồng hoặc giữ chỗ đang hiệu lực.', 409)
      if (
        current &&
        data.capacity < this.inventory.state.slots.filter((s) => s.roomId === id).length
      )
        throw new MockError('Sức chứa nhỏ hơn số chỗ đã tạo.', 409)
      if (
        current &&
        current.rentalMode !== data.rentalMode &&
        this.inventory.state.slots.some((s) => s.roomId === id)
      )
        throw new MockError('Phòng còn chỗ ở; không thể đổi hình thức thuê.', 409)
      for (const url of data.images)
        if (url.startsWith('data:')) validateImage(url)
        else if (
          !url.startsWith('/demo/') &&
          !/^https:\/\//.test(url) &&
          !/^data:image\/(png|jpeg|webp);base64,/.test(url)
        )
          throw new MockError('Ảnh phòng cần là HTTPS hoặc ảnh hợp lệ đã tải lên.', 422)
      const b = this.state.branches.find((b) => b.id === branchId)!,
        room = {
          ...(current || {
            id: crypto.randomUUID(),
            branchId,
            branchName: b.name,
            address: b.address,
            areaKey: 'thu-duc',
            availableSlots: null,
            status: 'AVAILABLE' as const,
            services: [],
            occupiedResources: 0,
            heldResources: 0,
            availability: 'AVAILABLE' as const,
          }),
          ...data,
          roomTypeName: type.name,
          imageUrl: data.images[0] || '/demo/room-1.webp',
          imageAlt: data.title,
        }
      if (current) Object.assign(current, room)
      else {
        this.inventory.state.rooms.push(room)
        for (const service of this.state.services.filter(
          (s) => s.branchId === branchId && s.mandatory && s.active,
        ))
          this.state.roomServices.push({
            id: crypto.randomUUID(),
            branchId,
            roomId: room.id,
            serviceId: service.id,
            serviceName: service.name,
            roomName: room.title,
            startDate: new Date().toISOString().slice(0, 10),
            endDate: '2099-01-01',
            unitPrice: service.unitPrice,
            status: 'ACTIVE',
          })
      }
      for (const t of this.tenant.state.tenancies.filter((t) => t.roomId === room.id))
        t.roomName = room.title
      return room
    }
    if (resource === 'room-types') {
      const current = id
        ? this.inventory.state.types.find((t) => t.id === id && t.branchId === branchId)
        : null
      if (id && !current) throw new MockError('Không tìm thấy loại phòng.', 404)
      if (method === 'DELETE') {
        if (this.inventory.state.rooms.some((r) => r.roomTypeId === id))
          throw new MockError('Loại phòng đang được sử dụng.', 409)
        this.inventory.state.types = this.inventory.state.types.filter((t) => t.id !== id)
        return null
      }
      const data = roomTypeInputSchema.parse(input)
      if (
        this.inventory.state.types.some(
          (t) =>
            t.branchId === branchId &&
            t.id !== id &&
            t.code.toLowerCase() === data.code.toLowerCase(),
        )
      )
        throw new MockError('Mã loại phòng đã tồn tại.', 409)
      if (current) Object.assign(current, data)
      else this.inventory.state.types.push({ id: crypto.randomUUID(), branchId, ...data })
      return current || this.inventory.state.types.at(-1)
    }
    const raw = z.object({ roomId: z.string().uuid() }).parse(input),
      room = this.room(branchId, raw.roomId),
      current = id
        ? this.inventory.state.slots.find((s) => s.id === id && s.roomId === room.id)
        : null
    if (room.rentalMode !== 'SLOT' || (id && !current))
      throw new MockError('Chỗ ở chỉ thuộc phòng thuê SLOT hợp lệ.', 422)
    if (method === 'DELETE')
      throw new MockError('Giữ lịch sử chỗ ở; dùng trạng thái ngừng sử dụng.', 409)
    const data = slotInputSchema.parse(input)
    if (
      this.inventory.state.slots.some(
        (s) =>
          s.roomId === room.id && s.id !== id && s.code.toLowerCase() === data.code.toLowerCase(),
      )
    )
      throw new MockError('Mã chỗ đã tồn tại trong phòng.', 409)
    if (
      !current &&
      this.inventory.state.slots.filter((s) => s.roomId === room.id).length >= room.capacity
    )
      throw new MockError('Số chỗ vượt sức chứa phòng.', 409)
    if (
      current &&
      data.operationalStatus !== 'ACTIVE' &&
      (this.tenant.state.tenancies.some(
        (t) => t.roomSlotId === id && ['ACTIVE', 'DRAFT'].includes(t.status),
      ) ||
        this.db.state.bookings.some(
          (b) =>
            b.roomSlotId === id &&
            ['CONFIRMED', 'AWAITING_PAYMENT', 'REQUESTED'].includes(b.status),
        ))
    )
      throw new MockError('Chỗ đang có người thuê hoặc giữ chỗ.', 409)
    if (current) Object.assign(current, data)
    else
      this.inventory.state.slots.push({
        id: crypto.randomUUID(),
        branchId,
        roomId: room.id,
        ...data,
        availability: 'AVAILABLE',
        occupancy: [],
      })
    return current || this.inventory.state.slots.at(-1)
  }
  action(
    actor: User,
    branchId: string,
    resource: ManagerResource,
    id: string | null,
    action: string,
    input: unknown,
    method = 'POST',
  ): unknown {
    this.scope(actor, branchId, true)
    return this.transaction(() => {
      let result: unknown
      if (['rooms', 'room-types', 'slots'].includes(resource))
        result = this.roomWrite(
          actor,
          branchId,
          resource as 'rooms' | 'room-types' | 'slots',
          id,
          method,
          input,
        )
      else if (['appointments', 'bookings', 'contracts', 'tenants'].includes(resource))
        result = leasingAction(this, actor, branchId, resource, id, action, input)
      else if (['invoices', 'payments'].includes(resource))
        result = financeAction(this, actor, branchId, resource, id, action, input)
      else result = operationsAction(this, actor, branchId, resource, id, action, input, method)
      this.scanInbox()
      return result
    })
  }
  sources(actor: User, branchId: string, tenancyId: string, month: string) {
    this.scope(actor, branchId)
    return invoiceSources(this, branchId, tenancyId, month)
  }
  previewCharge(actor: User, branchId: string, input: unknown) {
    this.scope(actor, branchId, true)
    return this.transaction(
      () => operationsAction(this, actor, branchId, 'utility-charges', null, '', input, 'POST'),
      true,
    )
  }
  summary(actor: User, branchId: string, month: string) {
    this.scope(actor, branchId)
    return reportSummary(this, branchId, month)
  }
  notifyTenant(t: Tenancy, title: string, type: string, id: string) {
    this.db.notify(t.userId, title, 'Mở để xem thông tin mới nhất.', type, id, t.id)
  }
  audit(actor: User, note: string) {
    return { at: new Date().toISOString(), actor: actor.fullName, note }
  }
  scanInbox() {
    const events = [
      ...this.db.state.appointments
        .filter((a) => a.status === 'PENDING')
        .map((a) => ({
          id: a.id,
          branchId: this.inventory.state.rooms.find((r) => r.id === a.roomId)?.branchId,
          type: 'MANAGER_APPOINTMENT',
          title: 'Lịch xem mới cần xử lý',
        })),
      ...this.db.state.bookings
        .filter((b) => ['REQUESTED', 'AWAITING_PAYMENT'].includes(b.status))
        .map((b) => ({
          id: b.id,
          branchId: b.branchId,
          type: 'MANAGER_BOOKING',
          title: 'Yêu cầu giữ phòng mới',
        })),
      ...this.tenant.state.services
        .filter((s) => ['PENDING', 'CANCEL_REQUESTED'].includes(s.status || ''))
        .map((s) => ({
          id: s.subscriptionId || s.id,
          branchId: this.tenant.state.tenancies.find((t) => t.id === s.contractTenantId)?.branchId,
          type: 'MANAGER_SERVICE',
          title: 'Dịch vụ cần xét duyệt',
        })),
      ...this.tenant.state.proposals
        .filter((p) => p.status === 'PENDING')
        .map((p) => ({
          id: p.id,
          branchId: this.tenant.state.tenancies.find((t) => t.id === p.contractTenantId)?.branchId,
          type: 'MANAGER_ALLOCATION',
          title: 'Đề xuất phân bổ mới',
        })),
      ...this.tenant.state.reports
        .filter((r) => r.status === 'OPEN')
        .map((r) => ({
          id: r.id,
          branchId: this.tenant.state.tenancies.find((t) => t.id === r.contractTenantId)?.branchId,
          type: 'MANAGER_MAINTENANCE',
          title: 'Yêu cầu sửa chữa mới',
        })),
      ...this.tenant.state.payments
        .filter((p) => ['PENDING', 'REVIEW'].includes(p.status))
        .map((p) => ({
          id: p.id,
          branchId: this.tenant.state.tenancies.find((t) => t.id === p.contractTenantId)?.branchId,
          type: 'MANAGER_PAYMENT',
          title: 'Thanh toán cần theo dõi',
        })),
    ]
    let changed = false
    for (const e of events) {
      const b = this.state.branches.find((b) => b.id === e.branchId)
      if (!b?.managerId) continue
      const key = `${e.type}:${e.id}:${b.managerId}`
      if (this.state.notices.includes(key)) continue
      this.state.notices.push(key)
      changed = true
      this.db.notify(
        b.managerId,
        e.title,
        'Có công việc mới tại ' + b.name,
        e.type,
        e.id,
        undefined,
        b.id,
      )
    }
    if (changed) this.save()
  }
  revoke(owner: User, branchId: string) {
    const b = this.state.branches.find((b) => b.id === branchId)
    if (!owner.roles.includes('OWNER') || b?.ownerId !== owner.id)
      throw new MockError('Chỉ chủ sở hữu được thay đổi phân công.', 403)
    b.managerId = null
    b.managerName = 'Chưa phân công'
    this.save()
  }
  reset() {
    return this.transaction(() => {
      const { users, sessions, refreshUserId, challenges } = this.db.state
      this.inventory.state = seedInventory()
      this.db.state = new MockDatabase(undefined, this.inventory).state
      Object.assign(this.db.state, { users, sessions, refreshUserId, challenges })
      this.tenant.state = seedTenant()
      this.state = seedManager(this.tenant.state, this.inventory.state)
      this.initialize()
      this.scanInbox()
    })
  }
}
function load() {
  try {
    return typeof sessionStorage === 'undefined'
      ? undefined
      : JSON.parse(sessionStorage.getItem('tropro-manager-v1') || 'null') || undefined
  } catch {
    return undefined
  }
}
export const managerDb = new ManagerEngine(db, tenantDb, inventory, load())
