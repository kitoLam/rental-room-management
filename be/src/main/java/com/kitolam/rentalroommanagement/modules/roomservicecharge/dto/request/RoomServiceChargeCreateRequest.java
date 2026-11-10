package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/**
 * Meter reading of one metered room service (electricity, water...) for a month.
 * previousReading may be omitted when the previous month already has a confirmed reading.
 */
public record RoomServiceChargeCreateRequest(
        @NotBlank @ValidObjectId String roomServiceId,
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        @PositiveOrZero BigDecimal previousReading,
        @NotNull @PositiveOrZero BigDecimal currentReading
) {
}
