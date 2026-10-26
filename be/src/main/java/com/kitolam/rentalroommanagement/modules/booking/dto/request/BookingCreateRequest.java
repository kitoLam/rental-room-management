package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record BookingCreateRequest(
        @NotBlank @ValidObjectId String tenantId,
        @NotBlank @ValidObjectId String roomId,
        @NotNull LocalDate expectedMoveInDate,
        @PositiveOrZero BigDecimal holdingDepositAmount,
        Instant paymentDeadline,
        Instant holdExpiresAt,
        String cancellationPolicy,
        String rejectReason
) {
}
