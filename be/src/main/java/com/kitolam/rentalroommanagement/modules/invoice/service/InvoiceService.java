package com.kitolam.rentalroommanagement.modules.invoice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.MyInvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import org.springframework.data.domain.Pageable;

public interface InvoiceService {

    /** Staff of the invoice's branch, or the tenant of the invoice once it is issued. */
    InvoiceResponse getById(String id, AuthPrincipal principal);

    /** Staff search, limited to the caller's branches. */
    PagedResponse<InvoiceResponse> search(InvoiceFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    /** Issued invoices of the logged-in tenant. */
    PagedResponse<InvoiceResponse> myInvoices(MyInvoiceFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    /** Replaces the manual items of a DRAFT invoice. */
    InvoiceResponse update(String id, InvoiceUpdateRequest request, AuthPrincipal principal);

    /** DRAFT → ISSUED: sets issueDate/dueDate, locks items, marks used meter readings INVOICED, notifies the tenant. */
    InvoiceResponse issue(String id, AuthPrincipal principal);

    /** Soft-deletes a DRAFT invoice. */
    void delete(String id, AuthPrincipal principal);
}
