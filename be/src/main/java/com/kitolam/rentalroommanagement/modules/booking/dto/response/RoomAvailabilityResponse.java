package com.kitolam.rentalroommanagement.modules.booking.dto.response;

import java.time.LocalDate;
import java.util.List;

public record RoomAvailabilityResponse(
        String roomId,
        LocalDate startDate,
        LocalDate endDate,
        boolean available,
        String reason,
        List<Object> slots
) {
}
