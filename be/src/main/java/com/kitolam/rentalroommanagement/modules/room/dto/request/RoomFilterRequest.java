package com.kitolam.rentalroommanagement.modules.room.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomMode;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;

/** Query parameters for search; all optional. */
public record RoomFilterRequest(
        @ValidObjectId String branchId,
        @ValidObjectId String roomTypeId,
        @ValidObjectId String managerId,
        RoomMode roomMode,
        RoomStatus status,
        String keyword
) {
}
