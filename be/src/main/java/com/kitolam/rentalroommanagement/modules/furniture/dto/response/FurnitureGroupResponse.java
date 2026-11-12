package com.kitolam.rentalroommanagement.modules.furniture.dto.response;

import java.util.List;

/** Furniture of a branch grouped by name, with the rooms that have it. */
public record FurnitureGroupResponse(
        String branchId,
        String name,
        int totalQuantity,
        List<FurnitureGroupRoomResponse> rooms
) {
}
