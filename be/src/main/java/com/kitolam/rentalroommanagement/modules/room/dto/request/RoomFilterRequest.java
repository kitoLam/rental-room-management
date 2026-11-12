package com.kitolam.rentalroommanagement.modules.room.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import jakarta.validation.constraints.Min;

import java.math.BigDecimal;

/** Query parameters for search; all optional. */
public record RoomFilterRequest(
        @ValidObjectId String branchId,
        RoomStatus status,
        String keyword,
        @Min(1) Integer minCapacity,
        BigDecimal minPrice,
        BigDecimal maxPrice
) {
}
