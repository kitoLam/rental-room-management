package com.kitolam.rentalroommanagement.modules.booking.dto.request;

import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record BookingUpdateRequest(
        LocalDate expectedMoveInDate,
        @PositiveOrZero BigDecimal holdingDepositAmount,
        Instant paymentDeadline,
        Instant holdExpiresAt,
        String cancellationPolicy,
        DepositStatus depositStatus,
        String rejectReason,
        BookingStatus status
) {
}
