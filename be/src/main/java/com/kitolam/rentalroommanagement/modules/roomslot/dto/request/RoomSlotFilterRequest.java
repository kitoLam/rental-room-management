package com.kitolam.rentalroommanagement.modules.roomslot.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;

/** Query parameters for search; all optional. */
public record RoomSlotFilterRequest(
        @ValidObjectId String roomId,
        RoomSlotStatus status,
        String keyword
) {
}
