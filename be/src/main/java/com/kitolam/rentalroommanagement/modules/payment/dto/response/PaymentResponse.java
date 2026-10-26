package com.kitolam.rentalroommanagement.modules.payment.dto.response;

import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentResponse(
        String id,
        String invoiceId,
        String contractTenantId,
        BigDecimal amount,
        PaymentMethod method,
        String transactionCode,
        Instant paidAt,
        PaymentStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
