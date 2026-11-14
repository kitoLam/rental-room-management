package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.math.BigDecimal;

public record TenantDebtServiceItemResponse(
        String serviceId,
        String name,
        String unit,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal amount,
        boolean mandatory
) {
}

