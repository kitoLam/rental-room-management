package com.kitolam.rentalroommanagement.modules.serviceitem.dto.request;

import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.QuantityRule;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/** PATCH semantics: null fields are left unchanged. */
public record ServiceItemUpdateRequest(
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String name,
        @Pattern(regexp = ".*\\S.*", message = "không được để trống") String unit,
        @PositiveOrZero BigDecimal unitPrice,
        CalculationType calculationType,
        QuantityRule quantityRule,
        ServiceScope scope,
        ServiceStatus status,
        Boolean mandatory
) {
}
