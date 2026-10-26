package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {

    private final InvoiceRepository invoiceRepository;

    @Override
    public InvoiceResponse create(InvoiceCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public InvoiceResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<InvoiceResponse> search(InvoiceFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public InvoiceResponse update(String id, InvoiceUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
