package com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SlotChargeAllocationRequest(
        @NotBlank @ValidObjectId String contractTenantId,
        @NotNull LocalDate startAt,
        @NotNull LocalDate endAt,
        @NotNull @PositiveOrZero BigDecimal amount
) {
}
