package com.kitolam.rentalroommanagement.modules.booking.dto.response;

import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record BookingPaymentResponse(
        String id,
        String bookingId,
        BigDecimal amount,
        String transactionCode,
        PaymentMethod method,
        PaymentStatus status,
        Instant createdAt,
        Instant paidAt,
        String paymentUrl
) {
}
