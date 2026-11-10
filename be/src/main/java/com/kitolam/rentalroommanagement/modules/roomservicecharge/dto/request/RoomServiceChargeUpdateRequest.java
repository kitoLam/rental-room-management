package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request;

import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/** Only a DRAFT charge can be edited. Null fields are left unchanged. */
public record RoomServiceChargeUpdateRequest(
        @PositiveOrZero BigDecimal previousReading,
        @PositiveOrZero BigDecimal currentReading
) {
}
