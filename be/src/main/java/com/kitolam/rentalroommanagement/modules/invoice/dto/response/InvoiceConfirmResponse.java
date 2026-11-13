package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.util.List;

/** skippedContractIds: already invoiced for the period (or no longer billable) when confirming. */
public record InvoiceConfirmResponse(List<InvoiceResponse> created, List<String> skippedContractIds) {
}
