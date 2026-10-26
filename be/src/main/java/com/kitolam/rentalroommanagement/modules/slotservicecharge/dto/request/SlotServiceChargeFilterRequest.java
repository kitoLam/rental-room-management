package com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.enums.SlotServiceChargeStatus;

/** Query parameters for search; all optional. */
public record SlotServiceChargeFilterRequest(
        @ValidObjectId String slotServiceId,
        String period,
        SlotServiceChargeStatus status
) {
}
