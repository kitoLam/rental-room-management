package com.kitolam.rentalroommanagement.modules.branch.dto.response;

import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import java.time.Instant;
import java.math.BigDecimal;

public record BranchResponse(
        String id,
        String name,
        String address,
        String phone,
        String email,
        String description,
        BranchStatus status,
        Instant createdAt,
        Instant updatedAt,
        String ownerAccountId,
        BigDecimal electricityRate,
        BigDecimal waterRate,
        BigDecimal parkingRate
) {
}
