package com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.response;

import com.kitolam.rentalroommanagement.modules.slotservicecharge.enums.SlotServiceChargeStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record SlotServiceChargeResponse(
        String id,
        String slotServiceId,
        String period,
        SlotServiceChargeStatus status,
        BigDecimal totalAmount,
        List<SlotChargeAllocationResponse> allocations,
        Instant createdAt,
        Instant updatedAt
) {
}
