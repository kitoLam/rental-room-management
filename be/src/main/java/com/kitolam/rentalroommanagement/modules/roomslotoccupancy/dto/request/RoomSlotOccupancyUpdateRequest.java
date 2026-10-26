package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request;

import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;

import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record RoomSlotOccupancyUpdateRequest(
        LocalDate startDate,
        LocalDate endDate,
        OccupancyStatus status
) {
}
