package com.kitolam.rentalroommanagement.modules.shift.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;

/** Query parameters for search; all optional. */
public record ShiftFilterRequest(
        @ValidObjectId String roomId,
        Boolean isActive,
        String keyword
) {
}
