package com.kitolam.rentalroommanagement.modules.meterreading.dto.response;

import com.kitolam.rentalroommanagement.modules.meterreading.enums.MeterReadingStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record MeterReadingResponse(
        String id,
        String roomId,
        String branchId,
        String period,
        BigDecimal startReading,
        BigDecimal endReading,
        BigDecimal usage,
        BigDecimal unitPrice,
        BigDecimal amount,
        MeterReadingStatus status,
        String note,
        Instant updatedAt
) {
}
