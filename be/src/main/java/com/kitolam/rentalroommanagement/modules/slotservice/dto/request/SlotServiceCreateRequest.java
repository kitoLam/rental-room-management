package com.kitolam.rentalroommanagement.modules.slotservice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record SlotServiceCreateRequest(
        @NotBlank @ValidObjectId String branchId,
        @NotBlank @Size(max = 100) String name,
        @NotNull @PositiveOrZero BigDecimal unitPrice,
        @Size(max = 500) String description
) {
}
