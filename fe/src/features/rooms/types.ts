/** Kiểu dữ liệu phòng công khai — bám theo ROOMS / ROOM_TYPES / ROOM_SLOTS trong ERD. */
export type { RentalMode } from '@/interfaces/domain'
import type { Room } from '@/interfaces/domain'

export type RoomStatus = Room['status']

export type RoomListing = Room
