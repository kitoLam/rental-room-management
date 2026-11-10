package com.kitolam.rentalroommanagement.modules.invoice.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceGenerateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceGenerateResponse;

/** Builds the monthly DRAFT invoice of each contract (rent + slot services + share of room services). */
public interface InvoiceGenerationService {

    /**
     * Idempotent: an existing DRAFT is recomputed (manual items kept), an issued invoice is skipped.
     * One contract failing never stops the others.
     */
    InvoiceGenerateResponse generate(InvoiceGenerateRequest request, AuthPrincipal principal);
}
