package com.kitolam.rentalroommanagement.modules.payment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentCreateRequest(
        @NotBlank @ValidObjectId String invoiceId,
        @NotBlank @ValidObjectId String contractTenantId,
        @NotNull @Positive BigDecimal amount,
        @NotNull PaymentMethod method,
        String transactionCode,
        Instant paidAt,
        PaymentStatus status
) {
}
