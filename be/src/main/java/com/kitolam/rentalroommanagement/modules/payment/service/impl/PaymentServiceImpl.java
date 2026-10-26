package com.kitolam.rentalroommanagement.modules.payment.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentCreateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentFilterRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.response.PaymentResponse;
import com.kitolam.rentalroommanagement.modules.payment.repository.PaymentRepository;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;

    @Override
    public PaymentResponse create(PaymentCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PaymentResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<PaymentResponse> search(PaymentFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PaymentResponse update(String id, PaymentUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
