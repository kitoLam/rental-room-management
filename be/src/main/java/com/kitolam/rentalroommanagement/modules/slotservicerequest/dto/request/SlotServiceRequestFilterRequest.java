package com.kitolam.rentalroommanagement.modules.slotservicerequest.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.slotservicerequest.enums.SlotServiceRequestStatus;

/** Query parameters for search; all optional. */
public record SlotServiceRequestFilterRequest(
        @ValidObjectId String branchId,
        @ValidObjectId String contractId,
        SlotServiceRequestStatus status
) {
}
