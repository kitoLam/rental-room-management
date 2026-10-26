package com.kitolam.rentalroommanagement.modules.roomslot.dto.request;

import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

/** PATCH semantics: null fields are left unchanged. */
public record RoomSlotUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String slotCode,
        @Min(1) Integer slotNumber,
        RoomSlotStatus status
) {
}
