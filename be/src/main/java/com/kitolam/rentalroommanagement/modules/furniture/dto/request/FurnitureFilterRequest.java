package com.kitolam.rentalroommanagement.modules.furniture.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;

/** Query parameters for search; all optional. */
public record FurnitureFilterRequest(
        @ValidObjectId String roomId,
        FurnitureCondition condition,
        String keyword
) {
}
