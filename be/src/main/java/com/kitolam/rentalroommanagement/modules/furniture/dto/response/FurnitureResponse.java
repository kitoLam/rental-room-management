package com.kitolam.rentalroommanagement.modules.furniture.dto.response;

import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;

import java.time.Instant;

public record FurnitureResponse(
        String id,
        String roomId,
        String name,
        Integer quantity,
        FurnitureCondition condition,
        Instant createdAt,
        Instant updatedAt
) {
}
