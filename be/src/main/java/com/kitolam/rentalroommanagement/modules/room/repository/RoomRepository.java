package com.kitolam.rentalroommanagement.modules.room.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;

import java.util.List;

public interface RoomRepository extends BaseRepository<Room> {
    List<Room> findByBranchIdAndIsDeletedFalse(String branchId);
}
