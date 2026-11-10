package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import jakarta.validation.constraints.Pattern;

/** Query parameters for search; all optional. */
public record InvoiceFilterRequest(
        @ValidObjectId String contractId,
        @ValidObjectId String tenantId,
        @ValidObjectId String branchId,
        @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$", message = "định dạng yyyy-MM") String period,
        InvoiceStatus status,
        String keyword
) {
}
