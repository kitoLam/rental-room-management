package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.invoice.billing.InvoiceCalculator;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceItemRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.MyInvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.InvoiceResponses;
import com.kitolam.rentalroommanagement.modules.notification.dto.request.NotificationPublishRequest;
import com.kitolam.rentalroommanagement.modules.notification.service.NotificationService;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.repository.RoomServiceChargeRepository;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final InvoiceRepository invoiceRepository;
    private final ContractRepository contractRepository;
    private final RoomServiceChargeRepository roomServiceChargeRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;

    @Override
    public InvoiceResponse getById(String id, AuthPrincipal principal) {
        Invoice invoice = getEntity(id);
        if (principal != null && "TENANT".equals(principal.role())) {
            Tenant tenant = currentTenant(principal);
            if (!tenant.getId().equals(invoice.getTenantId()) || invoice.getStatus() == InvoiceStatus.DRAFT) {
                throw new NotFoundException("Không tìm thấy hoá đơn với id: " + id);
            }
        } else {
            staffAccess.requireBranch(invoice.getBranchId(), principal);
        }
        return InvoiceResponses.of(invoice);
    }

    @Override
    public PagedResponse<InvoiceResponse> search(InvoiceFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        Set<String> branchIds = staffAccess.manageableBranchIds(principal);
        if (branchIds != null) {
            criteria.add(Criteria.where("branchId").in(branchIds.stream().map(ObjectId::new).toList()));
        }
        MongoQueryHelper.addObjectIdEquals(criteria, "contractId", filter.contractId());
        MongoQueryHelper.addObjectIdEquals(criteria, "tenantId", filter.tenantId());
        MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
        MongoQueryHelper.addEquals(criteria, "period", filter.period());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "invoiceNumber");
        Page<Invoice> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, Invoice.class);
        return PagedResponse.from(page, InvoiceResponses::of);
    }

    @Override
    public PagedResponse<InvoiceResponse> myInvoices(MyInvoiceFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        Tenant tenant = currentTenant(principal);
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("tenantId").is(new ObjectId(tenant.getId())));
        criteria.add(Criteria.where("status").ne(InvoiceStatus.DRAFT.name()));
        MongoQueryHelper.addEquals(criteria, "period", filter.period());
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        Page<Invoice> page = MongoQueryHelper.page(mongoTemplate, criteria, pageable, Invoice.class);
        return PagedResponse.from(page, InvoiceResponses::of);
    }

    @Override
    public InvoiceResponse update(String id, InvoiceUpdateRequest request, AuthPrincipal principal) {
        Invoice invoice = getEntity(id);
        staffAccess.requireBranch(invoice.getBranchId(), principal);
        requireDraft(invoice);
        List<InvoiceItem> manual = request.manualItems().stream().map(this::manualItem).toList();
        invoice.getItems().removeIf(item -> !item.getType().isGenerated());
        invoice.getItems().addAll(manual);
        InvoiceCalculator.applyTotals(invoice);
        return InvoiceResponses.of(invoiceRepository.save(invoice));
    }

    @Override
    public InvoiceResponse issue(String id, AuthPrincipal principal) {
        Invoice invoice = getEntity(id);
        staffAccess.requireBranch(invoice.getBranchId(), principal);
        requireDraft(invoice);
        if (invoice.getItems().isEmpty()) {
            throw new BadRequestException("Hoá đơn chưa có khoản nào");
        }
        Contract contract = contractRepository.findById(invoice.getContractId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng của hoá đơn"));

        LocalDate issueDate = LocalDate.now(clock.withZone(VIETNAM));
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate(issueDate, contract.getPaymentDueDay()));
        InvoiceCalculator.applyTotals(invoice);
        invoice.setStatus(invoice.getRemainingAmount().signum() == 0 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED);
        Invoice saved = invoiceRepository.save(invoice);

        markReadingsInvoiced(saved);
        notifyTenant(saved, principal);
        return InvoiceResponses.of(saved);
    }

    @Override
    public void delete(String id, AuthPrincipal principal) {
        Invoice invoice = getEntity(id);
        staffAccess.requireBranch(invoice.getBranchId(), principal);
        requireDraft(invoice);
        invoice.markDeleted();
        invoiceRepository.save(invoice);
    }

    /**
     * First date on or after issueDate whose day of month is paymentDueDay
     * (e.g. issued 01/12, due day 5 → 05/12; issued 10/12 → 05/01).
     */
    static LocalDate dueDate(LocalDate issueDate, Integer paymentDueDay) {
        if (paymentDueDay == null) return issueDate;
        LocalDate candidate = issueDate.withDayOfMonth(Math.min(paymentDueDay, issueDate.lengthOfMonth()));
        if (candidate.isBefore(issueDate)) {
            LocalDate next = issueDate.plusMonths(1);
            candidate = next.withDayOfMonth(Math.min(paymentDueDay, next.lengthOfMonth()));
        }
        return candidate;
    }

    /** A meter reading becomes INVOICED once no draft invoice still uses it. */
    private void markReadingsInvoiced(Invoice invoice) {
        invoice.getItems().stream()
                .map(InvoiceItem::getRoomServiceChargeId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(chargeId -> {
                    boolean stillInDraft = mongoTemplate.exists(new Query(new Criteria().andOperator(
                            MongoQueryHelper.notDeleted(),
                            Criteria.where("status").is(InvoiceStatus.DRAFT.name()),
                            Criteria.where("items.roomServiceChargeId").is(new ObjectId(chargeId)))), Invoice.class);
                    if (stillInDraft) return;
                    roomServiceChargeRepository.findByIdAndIsDeletedFalse(chargeId)
                            .filter(charge -> charge.getStatus() == RoomServiceChargeStatus.CONFIRMED)
                            .ifPresent(charge -> {
                                charge.setStatus(RoomServiceChargeStatus.INVOICED);
                                roomServiceChargeRepository.save(charge);
                            });
                });
    }

    /** Best effort: a notification failure never blocks issuing. */
    private void notifyTenant(Invoice invoice, AuthPrincipal principal) {
        try {
            tenantRepository.findByIdAndIsDeletedFalse(invoice.getTenantId())
                    .flatMap(tenant -> userRepository.findByEmailAndIsDeletedFalse(tenant.getEmail()))
                    .ifPresent(user -> {
                        String amount = NumberFormat.getInstance(Locale.of("vi", "VN")).format(invoice.getTotalAmount());
                        notificationService.publish(new NotificationPublishRequest(
                                "INVOICE_ISSUED:" + invoice.getId(), user.getId(), principal.userId(), null,
                                invoice.getBranchId(), "INVOICE_ISSUED",
                                "Hoá đơn tháng " + invoice.getPeriod(),
                                "Hoá đơn " + invoice.getInvoiceNumber() + ": " + amount + " ₫, hạn thanh toán "
                                        + DATE.format(invoice.getDueDate()),
                                "/tenant/invoices/" + invoice.getId(), clock.instant()));
                    });
        } catch (RuntimeException e) {
            log.warn("Could not notify tenant about invoice {}", invoice.getId(), e);
        }
    }

    private InvoiceItem manualItem(InvoiceItemRequest request) {
        if (request.type().isGenerated()) {
            throw new BadRequestException("Không thể thêm tay khoản loại " + request.type());
        }
        BigDecimal amount = request.quantity().multiply(request.unitPrice()).setScale(0, RoundingMode.HALF_UP);
        InvoiceItem item = new InvoiceItem();
        item.setId(new ObjectId().toHexString());
        item.setType(request.type());
        item.setDescription(request.description().trim());
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice());
        item.setAmount(request.type() == InvoiceItemType.DISCOUNT ? amount.negate() : amount);
        return item;
    }

    private Tenant currentTenant(AuthPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("Vui lòng đăng nhập");
        if (!"TENANT".equals(principal.role())) throw new ForbiddenException("Chỉ người thuê mới xem được hoá đơn của mình");
        return tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
    }

    private void requireDraft(Invoice invoice) {
        if (invoice.getStatus() != InvoiceStatus.DRAFT) {
            throw new ConflictException("Hoá đơn đã phát hành, không thể thay đổi");
        }
    }

    private Invoice getEntity(String id) {
        return invoiceRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hoá đơn với id: " + id));
    }
}
