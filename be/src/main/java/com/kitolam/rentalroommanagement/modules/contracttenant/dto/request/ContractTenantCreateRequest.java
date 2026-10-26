package com.kitolam.rentalroommanagement.modules.contracttenant.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContractTenantCreateRequest(
        @NotBlank @ValidObjectId String contractId,
        @NotBlank @ValidObjectId String tenantId,
        @ValidObjectId String bookingId,
        Boolean isRepresentative,
        @NotNull @PositiveOrZero BigDecimal rentAmount,
        @NotNull LocalDate joinedAt,
        LocalDate leftAt
) {
}
