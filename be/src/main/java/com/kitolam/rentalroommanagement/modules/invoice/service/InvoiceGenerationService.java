package com.kitolam.rentalroommanagement.modules.invoice.service;

import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.ContractInvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceGenerateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceGenerateResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;

/** Builds the monthly DRAFT invoice of each contract (rent + slot services + share of room services). */
public interface InvoiceGenerationService {

    /**
     * Idempotent: an existing DRAFT is recomputed (manual items kept), an issued invoice is skipped.
     * One contract failing never stops the others.
     */
    InvoiceGenerateResponse generate(InvoiceGenerateRequest request, AuthPrincipal principal);

    /**
     * Invoice of one contract for one month, billing only what is not billed yet:
     * <ul>
     *   <li>a DRAFT already exists: recompute it;</li>
     *   <li>no invoice yet: new MONTHLY invoice;</li>
     *   <li>the month is already issued: new SUPPLEMENTARY invoice with only the remaining amounts.</li>
     * </ul>
     * Services follow the days actually lived, so it also bills a tenant who moved in mid-month
     * before rent starts (firstBillingStartDate), which {@link #generate} skips.
     */
    InvoiceResponse createForContract(String contractId, ContractInvoiceCreateRequest request, AuthPrincipal principal);
}
