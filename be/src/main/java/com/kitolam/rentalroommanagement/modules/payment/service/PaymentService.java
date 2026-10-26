package com.kitolam.rentalroommanagement.modules.payment.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentCreateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentFilterRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.response.PaymentResponse;
import org.springframework.data.domain.Pageable;

public interface PaymentService {

    PaymentResponse create(PaymentCreateRequest request);

    PaymentResponse getById(String id);

    PagedResponse<PaymentResponse> search(PaymentFilterRequest filter, Pageable pageable);

    PaymentResponse update(String id, PaymentUpdateRequest request);

    void delete(String id);
}
