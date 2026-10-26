package com.kitolam.rentalroommanagement.modules.roomtype.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RoomTypeCreateRequest(
        @NotBlank String name,
        String description,
        @NotNull @Min(1) Integer maxOccupants
) {
}
