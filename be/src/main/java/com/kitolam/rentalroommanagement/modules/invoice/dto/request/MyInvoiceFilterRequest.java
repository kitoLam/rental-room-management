package com.kitolam.rentalroommanagement.modules.invoice.dto.request;

import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;

/** Filters for the tenant's own invoices; all optional. */
public record MyInvoiceFilterRequest(
        String period,
        InvoiceStatus status
) {
}
