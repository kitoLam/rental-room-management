package com.kitolam.rentalroommanagement.modules.roomslot.dto.response;

import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;

import java.time.Instant;
import java.time.LocalDate;

public record RoomSlotResponse(
        String id,
        String roomId,
        String slotCode,
        Integer slotNumber,
        RoomSlotStatus status,
        LocalDate availableFrom,
        Instant createdAt,
        Instant updatedAt
) {
}
