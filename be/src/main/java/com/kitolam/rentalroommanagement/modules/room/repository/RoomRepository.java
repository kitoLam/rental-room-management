package com.kitolam.rentalroommanagement.modules.room.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import java.util.Collection;
import java.util.List;

public interface RoomRepository extends BaseRepository<Room> {
    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { isDeleted: false } }",
        "{ $group: { _id: '$status', count: { $sum: 1 } } }",
        "{ $project: { _id: 0, status: '$_id', count: 1 } }"
    })
    List<com.kitolam.rentalroommanagement.modules.room.service.RoomService.StatusTotal> readStatusTotalsForAdmin();
    List<Room> findByBranchIdInAndIsDeletedFalse(Collection<String> branchIds);
    List<Room> findByBranchIdAndIsDeletedFalse(String branchId);
}
