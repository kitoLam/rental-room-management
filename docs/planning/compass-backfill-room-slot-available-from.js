// Read-only preview for mongosh. Actual backfill uses the application's shared date validator.
const slots = db.room_slots.aggregate([
  { $match: { status: 'AVAILABLE', isDeleted: false, depositPaused: { $ne: true }, availableFrom: null } },
  { $lookup: {
    from: 'rooms',
    let: { roomId: { $toString: '$roomId' } },
    pipeline: [{ $match: {
      isDeleted: false,
      status: { $in: ['AVAILABLE', 'RESERVED', 'OCCUPIED'] },
      $expr: { $eq: [{ $toString: '$_id' }, '$$roomId'] },
    } }],
    as: 'openRoom',
  } },
  { $match: { 'openRoom.0': { $exists: true } } },
  { $lookup: {
    from: 'room_slot_occupancies',
    let: { slotId: { $toString: '$_id' } },
    pipeline: [{ $match: {
      isDeleted: false,
      status: { $in: ['RESERVED', 'ACTIVE'] },
      $expr: { $eq: [{ $toString: '$roomSlotId' }, '$$slotId'] },
    } }, { $limit: 1 }],
    as: 'occupancies',
  } },
  { $match: { 'occupancies.0': { $exists: false } } },
  { $project: { roomId: 1, slotCode: 1 } },
]).toArray();

print('Số chỗ đủ điều kiện bổ sung ngày cho thuê: ' + slots.length);
slots.forEach(printjson);
