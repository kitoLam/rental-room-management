package com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SlotChargeAllocationResponse(
        String contractTenantId,
        LocalDate startAt,
        LocalDate endAt,
        Integer days,
        BigDecimal amount
) {
}
