package com.kitolam.rentalroommanagement.modules.booking.dto.response;

import java.time.LocalDate;

public record RoomAvailabilityResponse(
        String roomSlotId,
        String slotCode,
        LocalDate startDate,
        LocalDate endDate,
        boolean available,
        String reason
) {
}
