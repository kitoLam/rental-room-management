package com.kitolam.rentalroommanagement.modules.meterreading.dto.response;

import com.kitolam.rentalroommanagement.modules.meterreading.enums.MeterReadingStatus;

import java.math.BigDecimal;
import java.util.List;

/**
 * Electricity of the tenant's room for one calendar year: always 12 months (1..12).
 * A month has data only when the tenant's contract covered it and a reading exists.
 */
public record TenantMeterYearResponse(
        String contractId,
        String roomId,
        String roomNumber,
        int year,
        List<Month> months
) {

    /** Fields other than month / period / available are null when available is false. */
    public record Month(int month, String period, boolean available, BigDecimal unitPrice,
                        BigDecimal startReading, BigDecimal endReading, BigDecimal usage,
                        BigDecimal amount, MeterReadingStatus status) {
    }
}
