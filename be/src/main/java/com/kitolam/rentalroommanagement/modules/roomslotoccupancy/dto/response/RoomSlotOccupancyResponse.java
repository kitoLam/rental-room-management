package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.response;

import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;

import java.time.Instant;
import java.time.LocalDate;

public record RoomSlotOccupancyResponse(
        String id,
        String roomSlotId,
        String contractTenantId,
        LocalDate startDate,
        LocalDate endDate,
        OccupancyStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
