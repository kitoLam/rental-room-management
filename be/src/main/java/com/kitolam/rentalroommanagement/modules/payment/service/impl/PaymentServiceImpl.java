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
    private final com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository tenantRepository;
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    @Override
    public java.util.List<com.kitolam.rentalroommanagement.modules.payment.dto.response.MyPaymentResponse> mine(
            com.kitolam.rentalroommanagement.common.security.AuthPrincipal principal) {
        if (principal == null) throw new com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException("Vui lòng đăng nhập");
        var tenant = tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException("Không tìm thấy hồ sơ người thuê"));
        var bookingIds = mongoTemplate.find(org.springframework.data.mongodb.core.query.Query.query(
                        org.springframework.data.mongodb.core.query.Criteria.where("tenantId")
                                .is(com.kitolam.rentalroommanagement.common.util.MongoQueryHelper.toObjectId(tenant.getId()))
                                .and("isDeleted").is(false)),
                com.kitolam.rentalroommanagement.modules.booking.document.Booking.class)
                .stream().map(b -> com.kitolam.rentalroommanagement.common.util.MongoQueryHelper.toObjectId(b.getId())).toList();
        if (bookingIds.isEmpty()) return java.util.List.of();
        var query = org.springframework.data.mongodb.core.query.Query.query(
                        org.springframework.data.mongodb.core.query.Criteria.where("bookingId").in(bookingIds).and("isDeleted").is(false))
                .with(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        return mongoTemplate.find(query, com.kitolam.rentalroommanagement.modules.payment.document.Payment.class).stream()
                .map(p -> new com.kitolam.rentalroommanagement.modules.payment.dto.response.MyPaymentResponse(p.getId(),
                        p.getBookingId(), p.getInvoiceId(), p.getAmount(), p.getMethod(), p.getStatus(), p.getTransactionCode(),
                        p.getPaidAt(), p.getCreatedAt()))
                .toList();
    }

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
