package com.kitolam.rentalroommanagement.modules.invoice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtResponse;
import org.springframework.data.domain.Pageable;

public interface InvoiceService {

    InvoiceResponse create(InvoiceCreateRequest request);

    InvoiceResponse getById(String id);

    PagedResponse<InvoiceResponse> search(InvoiceFilterRequest filter, Pageable pageable);

    PagedResponse<TenantDebtResponse> listDebts(
            String branchId,
            String keyword,
            boolean overdueOnly,
            String period,
            Pageable pageable,
            AuthPrincipal principal
    );

    TenantDebtResponse payDebt(String debtId, AuthPrincipal principal);

    TenantDebtResponse unpayDebt(String debtId, AuthPrincipal principal);

    InvoiceResponse update(String id, InvoiceUpdateRequest request);

    void delete(String id);
}
