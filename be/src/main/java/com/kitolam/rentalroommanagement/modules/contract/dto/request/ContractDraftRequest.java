package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ContractDraftRequest(
        String contractNumber,
        @NotNull @PositiveOrZero BigDecimal rentPrice,
        @NotNull @PositiveOrZero BigDecimal contractDepositAmount,
        @NotNull @Min(1) @Max(28) Integer paymentDueDay,
        @NotBlank String terms,
        @NotBlank String landlordName,
        @NotBlank String landlordIdNumber,
        @NotBlank String landlordAddress,
        @NotNull @PositiveOrZero BigDecimal electricityInitialReading,
        @NotNull @PositiveOrZero BigDecimal waterInitialReading,
        @NotNull @PositiveOrZero BigDecimal electricityRate,
        @NotNull @PositiveOrZero BigDecimal waterRate,
        @NotNull @PositiveOrZero BigDecimal parkingRate,
        @NotNull @Min(1) Integer maxOccupants,
        @NotNull Instant checkInDeadline,
        @Valid List<ContractServiceRequest> services
) {
    public record ContractServiceRequest(
            @NotBlank @ValidObjectId String serviceId,
            @NotBlank String name,
            @NotBlank String unit,
            @NotNull @PositiveOrZero BigDecimal unitPrice,
            @NotBlank String calculationType,
            boolean mandatory
    ) {}
}
