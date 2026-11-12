package com.kitolam.rentalroommanagement.modules.payment.service.impl;

import org.springframework.data.mongodb.core.MongoTemplate;

import com.kitolam.rentalroommanagement.modules.payment.document.Payment;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;

import java.util.List;

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

    private final MongoTemplate overviewMongo;

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
    @Override
    public List<OverviewPayment> readForOverview(List<String> ids, java.time.Instant from, java.time.Instant to) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("invoiceId", ids);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("paidAt").gte(from).lt(to));
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").in("SUCCESS", "LATE_PAID"));
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("bookingId").is(null));
        query.fields().include("invoiceId", "amount");
        return overviewMongo.find(query, Payment.class).stream()
                .map(item -> new OverviewPayment(item.getInvoiceId(), item.getAmount())).toList();
    }
    @Override
    public List<ReportPayment> readForReports(List<String> invoiceIds, java.time.Instant from, java.time.Instant to) {
        if (invoiceIds.isEmpty() || !from.isBefore(to)) return List.of();
        var query = MongoQueryHelper.byReferenceIds("invoiceId", invoiceIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("paidAt").gte(from).lt(to));
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").in("SUCCESS", "LATE_PAID"));
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("bookingId").is(null));
        query.fields().include("invoiceId", "amount", "paidAt");
        return overviewMongo.find(query, Payment.class).stream()
                .map(item -> new ReportPayment(item.getInvoiceId(), item.getAmount(), item.getPaidAt())).toList();
    }
}
