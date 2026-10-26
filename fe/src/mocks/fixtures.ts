import type {
  Appointment,
  Booking,
  Branch,
  BranchPolicy,
  Notification,
  Room,
  User,
} from '@/interfaces/domain'
import { addDays } from '@/lib/validation'

export const fixtureId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const demoUser: User = {
  id: fixtureId(1),
  fullName: 'Nguyễn Minh An',
  email: 'an@tropro.demo',
  roles: ['USER'],
  phone: '0901234567',
  dateOfBirth: null,
  gender: null,
  status: 'ACTIVE',
}
// Local illustrative photographs; provenance is recorded in public/demo/README.md.
const images = ['/demo/room-1.webp', '/demo/room-2.webp', '/demo/room-3.webp', '/demo/room-4.webp']
export const branches: Branch[] = [
  {
    id: fixtureId(10),
    name: 'TroPro Thủ Đức',
    address: '214 Lê Văn Việt, Thủ Đức, TP.HCM',
    description:
      'Một khoảng riêng yên tĩnh giữa nhịp sống thành phố. Gần khu Công nghệ cao, thuận tiện đi học và đi làm.',
    images: [images[0], images[2]],
    publicPhone: '02873000001',
    publicEmail: 'thuduc@example.com',
    latitude: 10.8461,
    longitude: 106.7894,
    rules: [
      'Giữ yên tĩnh sau 22:00.',
      'Không hút thuốc tại khu vực chung.',
      'Khách đến thăm cần đăng ký tại quầy.',
    ],
  },
  {
    id: fixtureId(11),
    name: 'TroPro Bình Thạnh',
    address: '31 Nguyễn Gia Trí, Bình Thạnh, TP.HCM',
    description:
      'Không gian sống gọn gàng, nhiều ánh sáng. Khu sinh hoạt chung và bãi xe trong nhà dành cho cư dân.',
    images: [images[1], images[3]],
    publicPhone: null,
    publicEmail: null,
    latitude: 10.8015,
    longitude: 106.7146,
    rules: ['Phân loại rác tại khu vực quy định.', 'Không sử dụng bếp gas trong phòng.'],
  },
  {
    id: fixtureId(12),
    name: 'TroPro Làng Đại học',
    address: '12 Tô Vĩnh Diện, Làng Đại học Thủ Đức, TP.HCM',
    description:
      'Chỗ ở gần trường với phòng nguyên căn và chỗ ở ghép. Khu vực chung được vệ sinh theo lịch.',
    images: [images[2], images[0]],
    publicPhone: null,
    publicEmail: null,
    latitude: null,
    longitude: null,
    rules: ['Giữ vệ sinh không gian chung.', 'Tôn trọng giờ nghỉ của bạn cùng phòng.'],
  },
]
// Demo policy values are configuration fixtures, never hardcoded into booking components.
export const policies: BranchPolicy[] = branches.map((branch, index) => ({
  id: fixtureId(20 + index),
  branchId: branch.id,
  version: 1,
  effectiveFrom: '2025-01-01T00:00:00Z',
  bookingHoldAmount: [500000, 750000, 300000][index],
  paymentWindowMinutes: 30,
  temporaryHoldMinutes: 30,
  confirmedHoldMinutes: 1440,
  cancellationTerms:
    'Có thể hủy khi chưa xác nhận. Sau khi đã xác nhận, liên hệ chi nhánh để được xử lý theo thỏa thuận; tiền giữ chỗ không tự động hoàn.',
  appointmentPolicy: {
    openingHour: 8,
    closingHour: 18,
    maxDurationMinutes: 60,
    cancellationHours: 2,
  },
}))
export const roomTypes = [
  { id: fixtureId(30), name: 'Studio' },
  { id: fixtureId(31), name: 'Phòng có gác' },
  { id: fixtureId(32), name: 'Phòng ở ghép' },
]
const titles = [
  'Studio đón nắng, có bếp riêng',
  'Phòng có gác và cửa sổ lớn',
  'Chỗ ở ghép, góc học tập riêng',
  'Studio với ban công thoáng',
  'Phòng có gác gần trường',
  'Chỗ ở ghép trong phòng 4 người',
  'Phòng sáng, khu dân cư yên tĩnh',
  'Studio gọn gàng cho hai người',
  'Phòng ở ghép có máy lạnh',
  'Phòng có gác, không gian rộng',
  'Studio đang được nâng cấp',
  'Phòng ở ghép tạm ngừng cho thuê',
]
export const rooms: Room[] = titles.map((title, index) => {
  const branch = branches[index % 3]
  const isSlot = index % 3 === 2
  const type = roomTypes[isSlot ? 2 : index % 2]
  return {
    id: fixtureId(100 + index),
    code: `${['TD', 'BT', 'LDH'][index % 3]}-${201 + index}`,
    title,
    branchId: branch.id,
    branchName: branch.name,
    address: branch.address,
    areaKey: ['khu-cong-nghe-cao', 'binh-thanh', 'lang-dai-hoc'][index % 3],
    price: isSlot ? 1500000 + index * 50000 : 2800000 + index * 200000,
    sizeM2: 22 + index * 2,
    capacity: isSlot ? 4 : 2,
    availableSlots: isSlot ? 3 : 1,
    rentalMode: isSlot ? 'SLOT' : 'ROOM',
    roomTypeId: type.id,
    roomTypeName: type.name,
    status: 'AVAILABLE',
    operationalStatus: index === 10 ? 'MAINTENANCE' : index === 11 ? 'INACTIVE' : 'ACTIVE',
    imageUrl: images[index % images.length],
    imageAlt: title,
    images: [
      images[index % images.length],
      images[(index + 1) % images.length],
      images[(index + 2) % images.length],
    ],
    floor: 1 + (index % 4),
    description:
      'Không gian dễ sắp xếp với ánh sáng tự nhiên, cửa sổ thoáng và khu vệ sinh riêng. Giá hiển thị là giá tham khảo; giá thuê và dịch vụ sẽ được thống nhất trước khi ký hợp đồng.',
    amenities: [
      'Máy lạnh',
      'Cửa sổ',
      'Wifi',
      'Chỗ để xe',
      ...(isSlot ? ['Tủ cá nhân'] : ['Bếp riêng']),
    ],
    services: [
      { name: 'Điện', price: 3500, unit: 'kWh' },
      { name: 'Nước', price: 18000, unit: 'm³' },
      { name: 'Internet', price: 100000, unit: 'phòng/tháng' },
    ],
  }
})
export type Allocation = {
  reserved?: boolean
  roomId: string
  roomSlotId: string | null
  startDate: string
  endDate: string
}
export const allocations: Allocation[] = [
  { roomId: rooms[6].id, roomSlotId: null, startDate: addDays(-30), endDate: addDays(180) },
  {
    roomId: rooms[2].id,
    roomSlotId: fixtureId(1000 + 2 * 10),
    startDate: addDays(-30),
    endDate: addDays(180),
  },
]
export function seedActivity() {
  const base = rooms[0]
  const policy = policies[0]
  const startAt = `${addDays(2)}T09:00:00+07:00`
  const appointment: Appointment = {
    id: fixtureId(200),
    requesterUserId: demoUser.id,
    roomId: base.id,
    roomTitle: base.title,
    branchName: base.branchName,
    startAt,
    endAt: `${addDays(2)}T09:30:00+07:00`,
    note: 'Mình muốn xem phòng và khu để xe.',
    status: 'CONFIRMED',
    assignedManager: 'Quản lý chi nhánh Thủ Đức',
    policySnapshot: policy,
    createdAt: new Date().toISOString(),
    timeline: [
      { status: 'PENDING', at: new Date().toISOString(), note: 'Đã gửi lịch hẹn.' },
      {
        status: 'CONFIRMED',
        at: new Date().toISOString(),
        note: 'Chi nhánh đã xác nhận lịch xem phòng.',
      },
    ],
  }
  const history: Appointment = {
    ...appointment,
    id: fixtureId(201),
    startAt: `${addDays(-5)}T09:00:00+07:00`,
    endAt: `${addDays(-5)}T09:30:00+07:00`,
    status: 'COMPLETED',
    note: 'Đã xem phòng.',
    timeline: [
      {
        status: 'COMPLETED',
        at: `${addDays(-5)}T10:00:00+07:00`,
        note: 'Lịch xem phòng đã hoàn tất.',
      },
    ],
  }
  const booking = (index: number, status: Booking['status']): Booking => {
    const room = rooms[index]
    const selectedPolicy = policies[index % 3]
    const due = new Date(Date.now() + (status === 'EXPIRED' ? -60000 : 30 * 60000)).toISOString()
    return {
      id: fixtureId(300 + index),
      requesterUserId: demoUser.id,
      roomId: room.id,
      roomTitle: room.title,
      branchId: room.branchId,
      branchName: room.branchName,
      roomSlotId: room.rentalMode === 'SLOT' ? fixtureId(1000 + index * 10 + 1) : null,
      slotLabel: room.rentalMode === 'SLOT' ? 'Chỗ 2' : null,
      rentalMode: room.rentalMode,
      startDate: index === 4 ? addDays(0) : addDays(7),
      endDate: addDays(67),
      holdAmount: selectedPolicy.bookingHoldAmount,
      paymentDueAt: due,
      temporaryHoldUntil: due,
      confirmedHoldUntil:
        status === 'CONFIRMED' ? new Date(Date.now() + 86400000).toISOString() : null,
      status,
      policySnapshot: selectedPolicy,
      paymentEnvironment: 'SANDBOX',
      createdAt: new Date().toISOString(),
      timeline: [
        {
          status,
          at: new Date().toISOString(),
          note:
            status === 'EXPIRED' ? 'Đã quá hạn thanh toán.' : 'Yêu cầu mẫu trong môi trường demo.',
        },
      ],
      contractId: null,
    }
  }
  const bookings: Booking[] = [
    booking(4, 'AWAITING_PAYMENT'),
    booking(5, 'CONFIRMED'),
    booking(7, 'EXPIRED'),
    booking(8, 'CANCELLED'),
    booking(9, 'REJECTED'),
    booking(3, 'REQUESTED'),
  ]
  const notifications: (Notification & { recipientUserId: string })[] = [
    {
      id: fixtureId(400),
      recipientUserId: demoUser.id,
      title: 'Lịch xem phòng đã được xác nhận',
      message: 'Chi nhánh đã xác nhận lịch hẹn của bạn. Xem lại thời gian trước khi đến.',
      type: 'APPOINTMENT',
      createdAt: new Date().toISOString(),
      read: false,
      referenceType: 'APPOINTMENT',
      referenceId: appointment.id,
    },
    {
      id: fixtureId(401),
      recipientUserId: demoUser.id,
      title: 'Hoàn tất khoản giữ chỗ',
      message: 'Yêu cầu giữ chỗ đang chờ thanh toán. Kiểm tra thời hạn trong chi tiết.',
      type: 'BOOKING',
      createdAt: new Date().toISOString(),
      read: false,
      referenceType: 'BOOKING',
      referenceId: bookings[0].id,
    },
    {
      id: fixtureId(402),
      recipientUserId: demoUser.id,
      title: 'Chào mừng đến TroPro',
      message: 'Bắt đầu bằng việc tìm một không gian phù hợp với bạn.',
      type: 'SYSTEM',
      createdAt: new Date().toISOString(),
      read: true,
      referenceType: null,
      referenceId: null,
    },
  ]
  return { appointments: [appointment, history], bookings, notifications }
}
