package com.kitolam.rentalroommanagement.modules.roomslot.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import java.util.Collection;
import java.util.List;

public interface RoomSlotRepository extends BaseRepository<RoomSlot> {
    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { isDeleted: false } }",
        "{ $group: { _id: '$status', count: { $sum: 1 } } }",
        "{ $project: { _id: 0, status: '$_id', count: 1 } }"
    })
    List<com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService.StatusTotal> readStatusTotalsForAdmin();
    List<RoomSlot> findByRoomIdAndIsDeletedFalse(String roomId);

    List<RoomSlot> findByRoomIdInAndIsDeletedFalse(Collection<String> roomIds);

    List<RoomSlot> findByIdInAndIsDeletedFalse(Collection<String> ids);
}
