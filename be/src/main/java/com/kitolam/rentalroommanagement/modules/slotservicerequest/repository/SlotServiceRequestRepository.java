package com.kitolam.rentalroommanagement.modules.slotservicerequest.repository;

import com.kitolam.rentalroommanagement.common.base.BaseRepository;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.document.SlotServiceRequest;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;

public interface SlotServiceRequestRepository extends BaseRepository<SlotServiceRequest> {

    boolean existsByContractIdAndSlotServiceIdAndStatusAndIsDeletedFalse(
            String contractId, String slotServiceId, SlotServiceRequestStatus status);
}
