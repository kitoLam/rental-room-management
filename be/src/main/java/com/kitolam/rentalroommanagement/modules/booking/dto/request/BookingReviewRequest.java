package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record BookingReviewRequest(
        @NotNull Boolean accepted,
        LocalDate expectedMoveInDate,
        LocalDate expectedMoveOutDate,
        @DecimalMin("0.0") BigDecimal holdingDepositAmount,
        Instant paymentDeadline,
        Instant holdExpiresAt,
        Instant checkInDeadline,
        String cancellationPolicy,
        @Size(max = 500) String rejectReason
) {
}
