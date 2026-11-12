package com.kitolam.rentalroommanagement.modules.payment.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.booking.document.Booking;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.payment.document.Payment;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentCreateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentFilterRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.request.PaymentUpdateRequest;
import com.kitolam.rentalroommanagement.modules.payment.dto.response.PaymentResponse;
import com.kitolam.rentalroommanagement.modules.payment.repository.PaymentRepository;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;
    private final ContractRepository contractRepository;
    private final TenantRepository tenantRepository;
    private final MongoTemplate mongo;

    @Autowired
    public PaymentServiceImpl(
            PaymentRepository paymentRepository,
            ContractRepository contractRepository,
            TenantRepository tenantRepository,
            MongoTemplate mongo) {
        this.paymentRepository = paymentRepository;
        this.contractRepository = contractRepository;
        this.tenantRepository = tenantRepository;
        this.mongo = mongo;
    }

    public PaymentServiceImpl(MongoTemplate mongo, PaymentRepository paymentRepository) {
        this(paymentRepository, null, null, mongo);
    }

    @Override
    public PaymentResponse create(PaymentCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PaymentResponse getById(String id) {
        return paymentRepository.findByIdAndIsDeletedFalse(id)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thanh toán"));
    }

    @Override
    public PagedResponse<PaymentResponse> search(PaymentFilterRequest filter, Pageable pageable) {
        return search(filter, pageable, null);
    }

    @Override
    public PagedResponse<PaymentResponse> search(PaymentFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> list = new ArrayList<>();

        if (principal != null && "TENANT".equals(principal.role())) {
            Criteria tenantScope = buildTenantScope(principal, filter != null ? filter.contractId() : null);
            if (tenantScope == null) {
                return PagedResponse.of(List.of(), pageable.getPageNumber() + 1, pageable.getPageSize(), 0);
            }
            list.add(tenantScope);
        } else if (filter != null && filter.contractId() != null && !filter.contractId().isBlank()) {
            Criteria contractScope = buildContractScope(filter.contractId());
            if (contractScope == null) {
                return PagedResponse.of(List.of(), pageable.getPageNumber() + 1, pageable.getPageSize(), 0);
            }
            list.add(contractScope);
        }

        if (filter != null) {
            if (filter.status() != null) {
                list.add(Criteria.where("status").is(filter.status()));
            }
            if (filter.method() != null) {
                list.add(Criteria.where("method").is(filter.method()));
            }
            if (filter.invoiceId() != null && !filter.invoiceId().isBlank()) {
                MongoQueryHelper.addObjectIdEquals(list, "invoiceId", filter.invoiceId());
            }
            if (filter.contractTenantId() != null && !filter.contractTenantId().isBlank()) {
                MongoQueryHelper.addObjectIdEquals(list, "contractTenantId", filter.contractTenantId());
            }
            if (filter.keyword() != null && !filter.keyword().isBlank()) {
                String kw = filter.keyword().trim();
                list.add(new Criteria().orOperator(
                        Criteria.where("transactionCode").regex(kw, "i"),
                        Criteria.where("gatewayTransactionNo").regex(kw, "i")
                ));
            }
            if (filter.date() != null && !filter.date().isBlank()) {
                try {
                    var localDate = LocalDate.parse(filter.date().trim());
                    var vnZone = ZoneId.of("Asia/Ho_Chi_Minh");
                    var startOfDay = localDate.atStartOfDay(vnZone).toInstant();
                    var endOfDay = localDate.plusDays(1).atStartOfDay(vnZone).toInstant();
                    list.add(new Criteria().orOperator(
                            Criteria.where("createdAt").gte(startOfDay).lt(endOfDay),
                            Criteria.where("paidAt").gte(startOfDay).lt(endOfDay)
                    ));
                } catch (Exception ignored) {
                }
            }
        }

        Criteria criteria = list.isEmpty() ? null : new Criteria().andOperator(list.toArray(new Criteria[0]));
        var page = paymentRepository.findWithPagination(criteria, pageable);
        return PagedResponse.from(page, this::toResponse);
    }

    private Criteria buildTenantScope(AuthPrincipal principal, String contractId) {
        if (contractId != null && !contractId.isBlank()) {
            return buildContractScope(contractId);
        }
        Set<String> tenantActorIds = new LinkedHashSet<>();
        if (principal.userId() != null && !principal.userId().isBlank()) {
            tenantActorIds.add(principal.userId());
        }
        if (principal.email() != null && !principal.email().isBlank()) {
            tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                    .ifPresent(t -> tenantActorIds.add(t.getId()));
            List<Tenant> matchedTenants = mongo.find(
                    Query.query(Criteria.where("isDeleted").is(false)
                            .and("email").regex("^" + Pattern.quote(principal.email().trim()) + "$", "i")),
                    Tenant.class
            );
            for (Tenant t : matchedTenants) {
                tenantActorIds.add(t.getId());
            }
        }

        Set<String> ctIds = new LinkedHashSet<>();
        Set<String> bookingIds = new LinkedHashSet<>();

        if (!tenantActorIds.isEmpty()) {
            List<Object> actorValues = toIdValues(tenantActorIds);

            for (ContractTenant ct : mongo.find(
                    Query.query(Criteria.where("isDeleted").is(false).and("tenantId").in(actorValues)),
                    ContractTenant.class)) {
                ctIds.add(ct.getId());
            }

            for (Booking b : mongo.find(
                    Query.query(Criteria.where("isDeleted").is(false).and("tenantId").in(actorValues)),
                    Booking.class)) {
                bookingIds.add(b.getId());
            }

            for (Contract c : mongo.find(
                    Query.query(Criteria.where("isDeleted").is(false).and("tenantId").in(actorValues)),
                    Contract.class)) {
                ctIds.add(c.getId());
                if (c.getBookingId() != null) bookingIds.add(c.getBookingId());
                for (ContractTenant ct : mongo.find(
                        Query.query(Criteria.where("isDeleted").is(false).and("contractId").in(toIdValues(Set.of(c.getId())))),
                        ContractTenant.class)) {
                    ctIds.add(ct.getId());
                }
            }
        }

        return combineScopeCriteria(ctIds, bookingIds);
    }

    private Criteria buildContractScope(String contractId) {
        Set<String> ctIds = new LinkedHashSet<>();
        ctIds.add(contractId);
        for (ContractTenant ct : mongo.find(
                Query.query(Criteria.where("isDeleted").is(false).and("contractId").in(toIdValues(Set.of(contractId)))),
                ContractTenant.class)) {
            ctIds.add(ct.getId());
        }

        Set<String> bookingIds = new LinkedHashSet<>();
        contractRepository.findByIdAndIsDeletedFalse(contractId).ifPresent(c -> {
            if (c.getBookingId() != null) bookingIds.add(c.getBookingId());
        });

        return combineScopeCriteria(ctIds, bookingIds);
    }

    private Criteria combineScopeCriteria(Set<String> ctIds, Set<String> bookingIds) {
        Set<String> invoiceIds = new LinkedHashSet<>();
        if (!ctIds.isEmpty()) {
            List<Object> ctValues = toIdValues(ctIds);
            List<Invoice> invoices = mongo.find(
                    Query.query(Criteria.where("isDeleted").is(false).and("contractTenantId").in(ctValues)),
                    Invoice.class
            );
            for (Invoice inv : invoices) {
                invoiceIds.add(inv.getId());
            }
        }

        List<Criteria> orConditions = new ArrayList<>();
        if (!ctIds.isEmpty()) {
            orConditions.add(Criteria.where("contractTenantId").in(toIdValues(ctIds)));
        }
        if (!bookingIds.isEmpty()) {
            orConditions.add(Criteria.where("bookingId").in(toIdValues(bookingIds)));
        }
        if (!invoiceIds.isEmpty()) {
            orConditions.add(Criteria.where("invoiceId").in(toIdValues(invoiceIds)));
        }
        if (orConditions.isEmpty()) {
            return null;
        }
        return new Criteria().orOperator(orConditions.toArray(new Criteria[0]));
    }

    private List<Object> toIdValues(Set<String> ids) {
        List<Object> values = new ArrayList<>();
        for (String id : ids) {
            values.add(id);
            if (ObjectId.isValid(id)) {
                values.add(new ObjectId(id));
            }
        }
        return values;
    }

    private PaymentResponse toResponse(Payment p) {
        return new PaymentResponse(
                p.getId(),
                p.getInvoiceId(),
                p.getContractTenantId(),
                p.getAmount(),
                p.getMethod(),
                p.getTransactionCode(),
                p.getPaidAt(),
                p.getStatus(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
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
        return mongo.find(query, Payment.class).stream()
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
        return mongo.find(query, Payment.class).stream()
                .map(item -> new ReportPayment(item.getInvoiceId(), item.getAmount(), item.getPaidAt())).toList();
    }
}
