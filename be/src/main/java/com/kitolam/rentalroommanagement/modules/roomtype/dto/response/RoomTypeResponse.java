package com.kitolam.rentalroommanagement.modules.roomtype.dto.response;

import java.time.Instant;

public record RoomTypeResponse(
        String id,
        String name,
        String description,
        Integer maxOccupants,
        Instant createdAt,
        Instant updatedAt
) {
}
