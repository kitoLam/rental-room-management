package com.kitolam.rentalroommanagement.modules.roomtype.dto.request;

import jakarta.validation.constraints.NotBlank;

public record RoomTypeCreateRequest(
        @NotBlank String name,
        String description
) {
}
