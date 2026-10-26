package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;

/** Query parameters for search; all optional. */
public record RoomServiceChargeFilterRequest(
        @ValidObjectId String roomServiceId,
        String period,
        RoomServiceChargeStatus status
) {
}
