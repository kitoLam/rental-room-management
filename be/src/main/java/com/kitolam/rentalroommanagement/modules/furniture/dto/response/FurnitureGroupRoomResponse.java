package com.kitolam.rentalroommanagement.modules.furniture.dto.response;

import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;

/** One furniture document (one room); reportCount = report requests that mention it. */
public record FurnitureGroupRoomResponse(
        String furnitureId,
        String roomId,
        String roomNumber,
        String roomTitle,
        Integer quantity,
        FurnitureCondition condition,
        long reportCount
) {
}
