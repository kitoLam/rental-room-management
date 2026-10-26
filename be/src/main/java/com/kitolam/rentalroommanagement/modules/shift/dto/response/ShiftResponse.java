package com.kitolam.rentalroommanagement.modules.shift.dto.response;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.Set;

public record ShiftResponse(
        String id,
        String roomId,
        String name,
        Set<DayOfWeek> daysOfWeek,
        String startTime,
        String endTime,
        Integer maxAppointments,
        Boolean isActive,
        Instant createdAt,
        Instant updatedAt
) {
}
