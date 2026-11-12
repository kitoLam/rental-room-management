package com.kitolam.rentalroommanagement.modules.roomservice.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;

import java.util.Collection;
import java.util.List;

public interface RoomServiceRepository extends BaseRepository<RoomService> {

    List<RoomService> findByBranchIdAndStatusAndIsDeletedFalseOrderByNameAsc(String branchId, RoomServiceStatus status);

    List<RoomService> findByIdInAndIsDeletedFalse(Collection<String> ids);
}
