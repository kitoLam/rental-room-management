package com.kitolam.rentalroommanagement.modules.slotservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;

/** Query parameters for search; all optional. */
public record SlotServiceFilterRequest(
        @ValidObjectId String roomSlotId,
        @ValidObjectId String serviceId,
        SlotServiceStatus status
) {
}
