package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import org.springframework.data.mongodb.core.MongoTemplate;

import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.InvoiceMapper;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {

    private final MongoTemplate overviewMongo;

    private final InvoiceRepository invoiceRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final StaffAccess staffAccess;

    @Override
    public InvoiceResponse getById(String id, AuthPrincipal principal) {
        Invoice invoice = invoiceRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hoá đơn"));
        if (principal != null && "TENANT".equals(principal.role())) {
            Tenant tenant = currentTenant(principal);
            if (!Objects.equals(invoice.getTenantId(), tenant.getId()) && !memberContractIds(tenant).contains(invoice.getContractId())) {
                throw new ForbiddenException("Hoá đơn không thuộc về bạn");
            }
        } else if (invoice.getBranchId() != null) {
            staffAccess.requireBranch(invoice.getBranchId(), principal);
        } else {
            staffAccess.requireStaff(principal);
        }
        return InvoiceMapper.toResponse(invoice);
    }

    @Override
    public List<InvoiceResponse> listForBranch(String branchId, String period, AuthPrincipal principal) {
        staffAccess.requireBranch(branchId, principal);
        return invoiceRepository.findByBranchIdAndPeriodAndIsDeletedFalse(branchId, period).stream()
                .sorted(Comparator.comparing(Invoice::getRoomNumber, Comparator.nullsLast(String::compareTo))
                        .thenComparing(Invoice::getSlotCode, Comparator.nullsLast(String::compareTo)))
                .map(InvoiceMapper::toResponse)
                .toList();
    }

    @Override
    public PagedResponse<InvoiceResponse> my(AuthPrincipal principal, int page, int size) {
        Tenant tenant = currentTenant(principal);
        List<String> contracts = new ArrayList<>(memberContractIds(tenant));
        Criteria owner = contracts.isEmpty()
                ? Criteria.where("tenantId").is(MongoQueryHelper.toObjectId(tenant.getId()))
                : new Criteria().orOperator(Criteria.where("tenantId").is(MongoQueryHelper.toObjectId(tenant.getId())),
                Criteria.where("contractId").in(contracts.stream().map(MongoQueryHelper::toObjectId).toList()));
        Query query = new Query(new Criteria().andOperator(MongoQueryHelper.notDeleted(), owner,
                Criteria.where("status").nin("DRAFT", "CANCELLED")));
        long total = overviewMongo.count(query, Invoice.class);
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 100);
        query.with(Sort.by(Sort.Order.desc("period"), Sort.Order.asc("roomNumber")))
                .skip((long) (safePage - 1) * safeSize).limit(safeSize);
        List<InvoiceResponse> content = overviewMongo.find(query, Invoice.class).stream().map(InvoiceMapper::toResponse).toList();
        return PagedResponse.of(content, safePage, safeSize, total);
    }

    private Set<String> memberContractIds(Tenant tenant) {
        return contractTenantRepository.findByTenantIdAndIsDeletedFalse(tenant.getId()).stream()
                .map(ContractTenant::getContractId).filter(Objects::nonNull).collect(Collectors.toSet());
    }

    private Tenant currentTenant(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
    }

    @Override
    public List<OverviewInvoice> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractId", ids);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").nin("DRAFT", "CANCELLED"));
        query.fields().include("contractId");
        return overviewMongo.find(query, Invoice.class).stream()
                .map(item -> new OverviewInvoice(item.getId(), item.getContractId())).toList();
    }
    @Override
    public List<TenantInvoice> readForTenantOverview(List<String> contractIds) {
        if (contractIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractId", contractIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").nin("DRAFT", "CANCELLED"));
        query.fields().include("invoiceNumber", "period", "dueDate", "totalAmount", "remainingAmount", "status");
        return overviewMongo.find(query, Invoice.class).stream().map(item -> new TenantInvoice(item.getId(),
                item.getInvoiceNumber(), item.getPeriod(), item.getDueDate(), item.getTotalAmount(), item.getRemainingAmount(), item.getStatus())).toList();
    }

    @Override
    public List<DebtInvoice> readDebts(List<String> contractIds) {
        if (contractIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractId", contractIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status")
                .in("ISSUED", "PARTIALLY_PAID", "OVERDUE"));
        query.fields().include("contractId", "invoiceNumber", "period", "dueDate", "totalAmount", "remainingAmount");
        return overviewMongo.find(query, Invoice.class).stream()
                .filter(item -> item.getRemainingAmount() != null && item.getRemainingAmount().signum() > 0)
                .map(item -> new DebtInvoice(item.getId(), item.getContractId(), item.getInvoiceNumber(),
                        item.getPeriod(), item.getDueDate(), item.getTotalAmount(), item.getRemainingAmount()))
                .toList();
    }

    @Override
    public List<OverviewInvoice> readForReports(List<String> contractIds) {
        if (contractIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractId", contractIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").nin("DRAFT", "CANCELLED"));
        // A partial receipt cannot be split between rent and deposit without allocation data.
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("items.type").ne("DEPOSIT"));
        query.fields().include("contractId");
        return overviewMongo.find(query, Invoice.class).stream()
                .map(item -> new OverviewInvoice(item.getId(), item.getContractId())).toList();
    }
}
