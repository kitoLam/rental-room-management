package com.kitolam.rentalroommanagement.modules.contracttenant.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record ContractTenantUpdateRequest(
        @ValidObjectId String bookingId,
        Boolean isRepresentative,
        @PositiveOrZero BigDecimal rentAmount,
        LocalDate joinedAt,
        LocalDate leftAt,
        ContractTenantStatus status
) {
}
