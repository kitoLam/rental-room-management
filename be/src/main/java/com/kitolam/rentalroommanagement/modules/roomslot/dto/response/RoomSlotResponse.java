package com.kitolam.rentalroommanagement.modules.roomslot.dto.response;

import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;

import java.time.Instant;

public record RoomSlotResponse(
        String id,
        String roomId,
        String slotCode,
        Integer slotNumber,
        RoomSlotStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
