package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;

/** Query parameters for search; all optional. */
public record InvoiceFilterRequest(
        @ValidObjectId String contractTenantId,
        String period,
        InvoiceStatus status,
        String keyword
) {
}
