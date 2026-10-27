import { HttpResponse } from 'msw'
import type { User } from '@/interfaces/domain'
import { managerRoomSchema } from '@/interfaces/manager'
import { propertyInputSchema, propertyRoomInputSchema } from '@/services/owner-properties'
import { ownerDb as o } from './owner-engine'
import { MockError } from './database'

const ok = (data: unknown, status = 200) => HttpResponse.json({ status, code: 0, data }, { status })
const roomView = (r: typeof o.e.inventory.state.rooms[number]) => ({
  id: r.id, branchId: r.branchId, code: r.code, rentalMode: r.rentalMode, capacity: r.capacity,
  areaSqm: r.sizeM2, floorNumber: r.floor, referencePrice: r.price, description: r.description,
  isPublic: r.isPublic, operationalStatus: r.operationalStatus === 'ACTIVE' ? 'AVAILABLE' : r.operationalStatus,
})
function view(actor: User, id: string) {
  const b = o.branch(actor, id), metadata = o.state.metadata[id]
  return { id, name: b.name, address: b.address, description: b.description, status: b.status,
    propertyType: metadata.propertyType || 'APARTMENT',
    declaredRoomCount: metadata.declaredRoomCount ?? Math.max(10, b.roomCount), roomCount: b.roomCount }
}

export async function handleOwnerProperties(request: Request, actor: User) {
  o.authorize(actor)
  const path = new URL(request.url).pathname.replace('/__mock/api/owner/properties', '')
  const method = request.method
  if (!path && method === 'GET') return ok(o.branches(actor).map((b) => view(actor, b.id)))
  const match = path.match(/^\/([^/]+)(\/rooms)?$/)
  if (!path && method === 'POST' || match && !match[2] && method === 'PUT') {
    const input = propertyInputSchema.parse(await request.json())
    const id = match?.[1] || crypto.randomUUID()
    if (match) {
      const current = view(actor, id)
      if (input.declaredRoomCount < current.roomCount) throw new MockError('Tổng số phòng không được nhỏ hơn số phòng đã đăng ký.', 422)
    }
    o.e.transaction(() => {
      const current = o.e.state.branches.find((b) => b.id === id)
      if (current) { current.name = input.name; current.address = input.address }
      else o.e.state.branches.push({ id, name: input.name, address: input.address, ownerId: actor.id, managerId: null, managerName: '', status: 'ACTIVE', zaloUrl: null, zaloEnabled: false })
      o.state.metadata[id] = {
        ...(o.state.metadata[id] || { code: `CN-${id.slice(0, 8)}`, province: '', district: '', ward: '', latitude: null, longitude: null,
        rules: [], publicPhone: '', publicEmail: '', images: [], isPublic: true, qrPublicId: null, qrUrl: null,
        version: 1, assignedAt: null }), description: input.description,
        propertyType: input.propertyType, declaredRoomCount: input.declaredRoomCount,
      }
      for (const room of o.e.inventory.state.rooms.filter((r) => r.branchId === id)) { room.branchName = input.name; room.address = input.address }
    })
    return ok(view(actor, id), match ? 200 : 201)
  }
  if (match) {
    const id = match[1], branch = view(actor, id)
    if (!match[2] && method === 'GET') return ok(branch)
    if (match[2] && method === 'GET') return ok(o.e.inventory.state.rooms.filter((r) => r.branchId === id).map(roomView))
    if (match[2] && method === 'POST') {
      const input = propertyRoomInputSchema.parse(await request.json())
      const room = o.e.transaction(() => {
        if (branch.roomCount >= branch.declaredRoomCount) throw new MockError('Chi nhánh đã đủ số phòng đăng ký.', 409)
        if (o.e.inventory.state.rooms.some((r) => r.branchId === id && r.code.toLowerCase() === input.code.toLowerCase())) throw new MockError('Mã phòng đã tồn tại.', 409)
        const type = { id: crypto.randomUUID(), branchId: id, code: `LP-${crypto.randomUUID().slice(0, 8)}`, name: input.roomTypeName, defaultCapacity: input.capacity, description: '', active: true }
        const result = managerRoomSchema.parse({
          id: crypto.randomUUID(), branchId: id, branchName: branch.name, address: branch.address, areaKey: '',
          code: input.code, title: `${input.roomTypeName} ${input.code}`, roomTypeId: type.id, roomTypeName: type.name,
          rentalMode: input.rentalMode, capacity: input.capacity, sizeM2: input.areaSqm, floor: input.floorNumber,
          price: input.referencePrice, description: input.description, isPublic: input.isPublic,
          status: 'AVAILABLE', operationalStatus: 'ACTIVE', availableSlots: input.rentalMode === 'SLOT' ? input.capacity : null,
          imageUrl: '/demo/room-1.webp', imageAlt: `Ảnh minh họa phòng ${input.code}`, images: ['/demo/room-1.webp'],
          amenities: [], services: [], availability: 'AVAILABLE', occupiedResources: 0, heldResources: 0,
        })
        o.e.inventory.state.types.push(type); o.e.inventory.state.rooms.push(result)
        if (input.rentalMode === 'SLOT') for (let n = 1; n <= input.capacity; n++) o.e.inventory.state.slots.push({ id: crypto.randomUUID(), branchId: id, roomId: result.id, code: `S${n}`, name: `Chỗ ${n}`, operationalStatus: 'ACTIVE', availability: 'AVAILABLE', occupancy: [] })
        return result
      })
      return ok(roomView(room), 201)
    }
  }
  throw new MockError('Không tìm thấy chức năng chi nhánh.', 404)
}
