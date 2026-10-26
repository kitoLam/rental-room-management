package com.kitolam.rentalroommanagement.modules.payment.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentMethod;
import com.kitolam.rentalroommanagement.modules.payment.enums.PaymentStatus;

/** Query parameters for search; all optional. */
public record PaymentFilterRequest(
        @ValidObjectId String invoiceId,
        @ValidObjectId String contractTenantId,
        PaymentMethod method,
        PaymentStatus status,
        String keyword
) {
}
