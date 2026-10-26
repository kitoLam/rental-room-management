import { rooms as originalRooms, roomTypes, fixtureId, branches } from './fixtures'
import type { ManagerRoom, ManagerRoomType, ManagerSlot } from '@/interfaces/manager'
export type InventoryState = {
  rooms: ManagerRoom[]
  types: ManagerRoomType[]
  slots: ManagerSlot[]
}
export function seedInventory(): InventoryState {
  const rooms: ManagerRoom[] = structuredClone(originalRooms).map((r) => ({
    ...r,
    isPublic: true,
    availability: r.status === 'UNKNOWN' ? 'AVAILABLE' : r.status,
    occupiedResources: 0,
    heldResources: 0,
  }))
  const types: ManagerRoomType[] = branches.flatMap((branch, n) =>
    roomTypes.map((t, i) => ({
      ...t,
      id: n === i ? t.id : fixtureId(8000 + n * 10 + i),
      branchId: branch.id,
      code: `TYPE-${i + 1}`,
      defaultCapacity: i === 2 ? 4 : 2,
      description: 'Loại phòng tiêu chuẩn của chi nhánh.',
      active: true,
    })),
  )
  for (const room of rooms)
    room.roomTypeId = types.find(
      (t) => t.branchId === room.branchId && t.name === room.roomTypeName,
    )!.id
  const slots: ManagerSlot[] = rooms.flatMap((r, index) =>
    r.rentalMode === 'SLOT'
      ? Array.from({ length: r.capacity }, (_, n) => ({
          id: fixtureId(1000 + index * 10 + n),
          roomId: r.id,
          branchId: r.branchId,
          code: `S${n + 1}`,
          name: `Chỗ ${n + 1}`,
          operationalStatus: 'ACTIVE' as const,
          availability: 'AVAILABLE',
          occupancy: [],
        }))
      : [],
  )
  return { rooms, types, slots }
}
export class MockInventory {
  state: InventoryState
  constructor(state?: InventoryState) {
    this.state = state || seedInventory()
    for(const room of this.state.rooms){
      const type=this.state.types.find(t=>t.id===room.roomTypeId)
      if(type&&type.branchId!==room.branchId){let local=this.state.types.find(t=>t.branchId===room.branchId&&t.name===type.name);if(!local){local={...type,id:crypto.randomUUID(),branchId:room.branchId};this.state.types.push(local)}room.roomTypeId=local.id}
    }
  }
  save() {
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem('tropro-inventory-v1', JSON.stringify(this.state))
  }
  reset() {
    this.state = seedInventory()
    this.save()
  }
}
function load() {
  try {
    return typeof sessionStorage === 'undefined'
      ? undefined
      : JSON.parse(sessionStorage.getItem('tropro-inventory-v1') || 'null') || undefined
  } catch {
    return undefined
  }
}
export const inventory = new MockInventory(load())
