package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** PATCH semantics: null fields are left unchanged. */
public record ContractUpdateRequest(
        @ValidObjectId String managerId,
        LocalDate startDate,
        LocalDate endDate,
        @PositiveOrZero BigDecimal rentPrice,
        @PositiveOrZero BigDecimal contractDepositAmount,
        @Min(1) @Max(28) Integer paymentDueDay,
        String terms,
        String signedFileUrl,
        Instant terminatedAt,
        String terminationReason,
        ContractStatus status
) {
}
