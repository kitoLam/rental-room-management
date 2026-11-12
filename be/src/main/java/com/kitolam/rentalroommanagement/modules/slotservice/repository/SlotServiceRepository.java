package com.kitolam.rentalroommanagement.modules.slotservice.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;

import java.util.Collection;
import java.util.List;

public interface SlotServiceRepository extends BaseRepository<SlotService> {

    List<SlotService> findByBranchIdAndStatusAndIsDeletedFalseOrderByNameAsc(String branchId, SlotServiceStatus status);

    List<SlotService> findByIdInAndIsDeletedFalse(Collection<String> ids);
}
