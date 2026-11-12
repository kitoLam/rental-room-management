package com.kitolam.rentalroommanagement.modules.meterreading.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Create or update the DRAFT reading of a room for a month. startReading defaults to the previous
 * month's end reading; it is required only for the very first month of a room.
 */
public record MeterReadingSaveRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        @PositiveOrZero BigDecimal startReading,
        @NotNull @PositiveOrZero BigDecimal endReading,
        @Size(max = 300) String note
) {
}
