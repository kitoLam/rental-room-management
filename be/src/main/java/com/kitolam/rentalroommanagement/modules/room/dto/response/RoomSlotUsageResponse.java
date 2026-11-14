package com.kitolam.rentalroommanagement.modules.room.dto.response;

import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;

import java.time.LocalDate;

/**
 * A slot of a room as staff see it: busy = someone lives in / holds it, a booking request on it is
 * being processed, or a draft / running contract uses it (busyReason says which).
 */
public record RoomSlotUsageResponse(
        String id,
        String slotCode,
        Integer slotNumber,
        RoomSlotStatus status,
        LocalDate availableFrom,
        boolean busy,
        String busyReason,
        boolean depositPaused
) {
}
