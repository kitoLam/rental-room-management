package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ContractCreateRequest(
        @NotBlank @ValidObjectId String roomId,
        @NotBlank @ValidObjectId String managerId,
        @NotBlank String contractNumber,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @NotNull @PositiveOrZero BigDecimal rentPrice,
        @NotNull @PositiveOrZero BigDecimal contractDepositAmount,
        @NotNull @Min(1) @Max(28) Integer paymentDueDay,
        String terms,
        String signedFileUrl,
        Instant terminatedAt,
        String terminationReason
) {
}
