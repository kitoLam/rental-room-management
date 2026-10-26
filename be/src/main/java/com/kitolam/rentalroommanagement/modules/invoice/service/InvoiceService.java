package com.kitolam.rentalroommanagement.modules.invoice.service;

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
}
