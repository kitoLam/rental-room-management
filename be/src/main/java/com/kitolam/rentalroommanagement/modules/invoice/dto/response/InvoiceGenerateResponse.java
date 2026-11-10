package com.kitolam.rentalroommanagement.modules.invoice.dto.response;

import java.util.List;

public record InvoiceGenerateResponse(
        List<InvoiceResponse> created,
        List<InvoiceResponse> regenerated,
        List<Skipped> skipped,
        List<Failed> failed
) {

    /** reason: CONTRACT_NOT_ACTIVE, NOT_IN_PERIOD, ALREADY_ISSUED, NO_ACCESS. */
    public record Skipped(String contractId, String reason) {
    }

    public record Failed(String contractId, String error) {
    }
}
