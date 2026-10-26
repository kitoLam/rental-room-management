package com.kitolam.rentalroommanagement.modules.serviceitem.dto.response;

import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record ServiceItemResponse(
        String id,
        String code,
        String name,
        String unit,
        BigDecimal unitPrice,
        CalculationType calculationType,
        ServiceScope scope,
        ServiceStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
