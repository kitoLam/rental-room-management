package com.kitolam.rentalroommanagement.modules.contract.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ContractTerminationRequest(
        @NotBlank String confirmation,
        @NotBlank @Size(max = 500) String reason,
        LocalDate availableFrom,
        @DecimalMin("0") @Digits(integer = 12, fraction = 3) BigDecimal electricityStartReading,
        @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 3) BigDecimal electricityEndReading
) { }
