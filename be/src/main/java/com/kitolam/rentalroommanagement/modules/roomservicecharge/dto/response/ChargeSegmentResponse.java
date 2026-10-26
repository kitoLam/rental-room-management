package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ChargeSegmentResponse(
        String id,
        LocalDate startAt,
        LocalDate endAt,
        BigDecimal previousReading,
        BigDecimal currentReading,
        BigDecimal usage,
        BigDecimal unitPrice,
        BigDecimal amount,
        List<SegmentAllocationResponse> allocations
) {
}
