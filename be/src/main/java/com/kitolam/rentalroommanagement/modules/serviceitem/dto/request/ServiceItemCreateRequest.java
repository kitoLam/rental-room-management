package com.kitolam.rentalroommanagement.modules.serviceitem.dto.request;

import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record ServiceItemCreateRequest(
        @NotBlank String code,
        @NotBlank String name,
        @NotBlank String unit,
        @NotNull @PositiveOrZero BigDecimal unitPrice,
        @NotNull CalculationType calculationType,
        @NotNull ServiceScope scope
) {
}
