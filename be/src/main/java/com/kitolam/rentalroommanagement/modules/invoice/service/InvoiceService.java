package com.kitolam.rentalroommanagement.modules.invoice.service;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import org.springframework.data.domain.Pageable;

public interface InvoiceService {

    InvoiceResponse create(InvoiceCreateRequest request);

    InvoiceResponse getById(String id);

    PagedResponse<InvoiceResponse> search(InvoiceFilterRequest filter, Pageable pageable);

    InvoiceResponse update(String id, InvoiceUpdateRequest request);

    void delete(String id);
    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewInvoice> readForOverview(List<String> ids);

    /** Issued, non-cancelled invoices without deposit lines; tenancy IDs must already be authorized. */
    List<OverviewInvoice> readForReports(List<String> contractTenantIds);

    /** Read issued invoices for already-authorized tenancy IDs, without calculating or updating balances. */
    List<TenantInvoice> readForTenantOverview(List<String> contractTenantIds);

    record TenantInvoice(String id, String invoiceNumber, String period, java.time.LocalDate dueDate,
                         java.math.BigDecimal totalAmount, java.math.BigDecimal remainingAmount,
                         com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus status) { }

    /** Issued invoices that still have an outstanding balance; tenancy IDs must already be authorized. */
    List<DebtInvoice> readDebts(List<String> contractTenantIds);

    record DebtInvoice(String id, String contractTenantId, String invoiceNumber, String period,
                       java.time.LocalDate dueDate, java.math.BigDecimal totalAmount,
                       java.math.BigDecimal remainingAmount) { }

    record OverviewInvoice(String id, String contractTenantId) { }
}
