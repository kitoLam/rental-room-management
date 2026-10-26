package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ChargeSegmentRequest(
        @NotNull LocalDate startAt,
        @NotNull LocalDate endAt,
        BigDecimal previousReading,
        BigDecimal currentReading,
        @NotNull @PositiveOrZero BigDecimal unitPrice,
        @PositiveOrZero BigDecimal amount,
        List<@Valid SegmentAllocationRequest> allocations
) {
}
