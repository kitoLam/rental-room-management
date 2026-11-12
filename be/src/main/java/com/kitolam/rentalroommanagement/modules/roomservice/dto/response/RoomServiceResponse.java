package com.kitolam.rentalroommanagement.modules.roomservice.dto.response;

import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceCalculationType;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record RoomServiceResponse(
        String id,
        String branchId,
        String name,
        String unit,
        BigDecimal unitPrice,
        RoomServiceCalculationType calculationType,
        String description,
        RoomServiceStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
