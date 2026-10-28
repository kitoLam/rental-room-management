package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record BookingCreateRequest(
        @jakarta.validation.constraints.NotBlank @ValidObjectId String roomId,
        @NotNull LocalDate expectedMoveInDate,
        @NotNull LocalDate expectedMoveOutDate
) {
}
