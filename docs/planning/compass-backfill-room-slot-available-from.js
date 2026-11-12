// Dán vào MongoDB Compass → tab "mongosh" (chọn database rental_room_management) rồi Run.
// Gán availableFrom cho mọi slot AVAILABLE chưa có field; chạy lại nhiều lần không ghi đè.
// Ngày ghi dạng BSON Date 00:00 UTC — Spring Data (Jsr310Converters + systemDefault) đọc lại đúng ngày
// khi server chạy ở UTC hoặc Asia/Ho_Chi_Minh (mọi múi giờ từ UTC-0 trở về phía đông).
const DAYS = [
  ISODate('2026-12-30T00:00:00Z'), // ưu tiên 30/12/2026
  ISODate('2026-12-15T00:00:00Z'),
  ISODate('2026-12-01T00:00:00Z'),
];
const slotFilter = { status: 'AVAILABLE', isDeleted: false, availableFrom: null }; // null khớp cả field chưa tồn tại

// String.hashCode() của Java (int32 overflow) — giống hệt RoomSlotAvailableFromMigration bên backend.
const javaHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};
const bucketOf = (id) => ((javaHash(id) % DAYS.length) + DAYS.length) % DAYS.length;

const total = db.room_slots.countDocuments(slotFilter);
print('Slots AVAILABLE thiếu availableFrom: ' + total);
if (total === 0) {
  print('Không còn slot nào cần gán — không thay đổi dữ liệu.');
} else {
  // Slot đang được giữ chỗ/đang thuê thì không phải slot trống thực sự.
  const held = new Set(db.room_slot_occupancies
    .find({ isDeleted: false, status: { $in: ['RESERVED', 'ACTIVE'] } }, { roomSlotId: 1 })
    .toArray()
    .map((o) => o.roomSlotId.toString()));

  // Chia bucket tất định theo _id: cùng slot luôn nhận cùng ngày, kể cả khi chạy lại sau lỗi giữa chừng.
  const buckets = [[], [], []];
  db.room_slots.find(slotFilter, { _id: 1 }).forEach((slot) => {
    const id = slot._id.toString();
    if (held.has(id)) return;
    buckets[bucketOf(id)].push(slot._id);
  });
  let updated = 0;
  buckets.forEach((ids, i) => {
    if (ids.length === 0) return;
    const result = db.room_slots.updateMany(
      { _id: { $in: ids }, availableFrom: null }, // chốt lại điều kiện, tránh ghi đè nếu có người sửa song song
      { $set: { availableFrom: DAYS[i], updatedAt: new Date() } },
    );
    updated += result.modifiedCount;
    print('  ' + DAYS[i].toISOString().slice(0, 10) + ': ' + result.modifiedCount + ' slot');
  });
  print('Đã gán availableFrom cho ' + updated + ' slot.');
}
print('Còn lại thiếu availableFrom: ' + db.room_slots.countDocuments(slotFilter));