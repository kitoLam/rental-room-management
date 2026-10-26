package com.kitolam.rentalroommanagement.modules.booking.dto.response;

import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.DepositStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record BookingResponse(
        String id,
        String tenantId,
        String roomId,
        LocalDate expectedMoveInDate,
        BigDecimal holdingDepositAmount,
        Instant paymentDeadline,
        Instant holdExpiresAt,
        String cancellationPolicy,
        DepositStatus depositStatus,
        String rejectReason,
        BookingStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
