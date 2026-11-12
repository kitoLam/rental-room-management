package com.kitolam.rentalroommanagement.modules.payment.service;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentCreateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentFilterRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.response.PaymentResponse;
import org.springframework.data.domain.Pageable;

public interface PaymentService {

    PaymentResponse create(PaymentCreateRequest request);

    PaymentResponse getById(String id);

    PagedResponse<PaymentResponse> search(PaymentFilterRequest filter, Pageable pageable);

    default PagedResponse<PaymentResponse> search(PaymentFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        return search(filter, pageable);
    }

    PaymentResponse update(String id, PaymentUpdateRequest request);

    void delete(String id);
    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewPayment> readForOverview(List<String> ids, java.time.Instant from, java.time.Instant to);

    record OverviewPayment(String invoiceId, java.math.BigDecimal amount) { }

    /** Successful invoice receipts in [from, to); IDs must already be authorized by the caller. */
    List<ReportPayment> readForReports(List<String> invoiceIds, java.time.Instant from, java.time.Instant to);

    record ReportPayment(String invoiceId, java.math.BigDecimal amount, java.time.Instant paidAt) { }
}
