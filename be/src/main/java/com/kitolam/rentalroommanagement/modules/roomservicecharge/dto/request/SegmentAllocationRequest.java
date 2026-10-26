package com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record SegmentAllocationRequest(
        @NotBlank @ValidObjectId String contractTenantId,
        @NotNull @Positive BigDecimal shareRatio
) {
}
