package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;

/** Query parameters for search; all optional. */
public record RoomSlotOccupancyFilterRequest(
        @ValidObjectId String roomSlotId,
        @ValidObjectId String contractTenantId,
        OccupancyStatus status
) {
}
