package com.kitolam.rentalroommanagement.modules.roomtype.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

/** PATCH semantics: null fields are left unchanged. */
public record RoomTypeUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String name,
        String description,
        @Min(1) Integer maxOccupants
) {
}
