package com.kitolam.rentalroommanagement.modules.payment.dto.response;

import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;

/** A payment of the logged-in tenant (booking deposit or invoice). */
public record MyPaymentResponse(
        String id,
        String bookingId,
        String invoiceId,
        BigDecimal amount,
        PaymentMethod method,
        PaymentStatus status,
        String transactionCode,
        Instant paidAt,
        Instant createdAt
) {
}
