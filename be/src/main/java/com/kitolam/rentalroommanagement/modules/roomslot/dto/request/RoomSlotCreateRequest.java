package com.kitolam.rentalroommanagement.modules.roomslot.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RoomSlotCreateRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank String slotCode,
        @NotNull @Min(1) Integer slotNumber,
        LocalDate availableFrom
) {
}
