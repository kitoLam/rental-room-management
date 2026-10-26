package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response;

import java.math.BigDecimal;

public record SegmentAllocationResponse(
        String contractTenantId,
        BigDecimal shareRatio,
        BigDecimal amount
) {
}
