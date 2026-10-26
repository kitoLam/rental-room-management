package com.kitolam.rentalroommanagement.modules.payment.dto.request;

import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;

import java.time.Instant;

/** PATCH semantics: null fields are left unchanged. */
public record PaymentUpdateRequest(
        PaymentMethod method,
        String transactionCode,
        Instant paidAt,
        PaymentStatus status
) {
}
