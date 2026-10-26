package com.kitolam.rentalroommanagement.modules.roomservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;

/** Query parameters for search; all optional. */
public record RoomServiceFilterRequest(
        @ValidObjectId String roomId,
        @ValidObjectId String serviceId,
        RoomServiceStatus status
) {
}
