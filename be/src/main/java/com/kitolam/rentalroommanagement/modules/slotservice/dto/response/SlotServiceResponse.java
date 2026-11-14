package com.kitolam.rentalroommanagement.modules.slotservice.dto.response;

import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record SlotServiceResponse(
        String id,
        String branchId,
        String name,
        BigDecimal unitPrice,
        String description,
        SlotServiceStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
