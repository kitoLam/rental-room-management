package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.invoice.billing.BillingPeriod;
import com.kitolam.rentalroommanagement.modules.invoice.billing.MissingMeterReadingException;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.ContractInvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceGenerateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceGenerateResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceGenerateResponse.Failed;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceGenerateResponse.Skipped;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceKind;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceGenerationService;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.ContractBillingLoader;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.InvoiceComposer;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.InvoiceNumberGenerator;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.InvoiceResponses;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InvoiceGenerationServiceImpl implements InvoiceGenerationService {

    private static final List<ContractStatus> BILLABLE_CONTRACT =
            List.of(ContractStatus.ACTIVE, ContractStatus.EXPIRED, ContractStatus.TERMINATED);

    private final InvoiceRepository invoiceRepository;
    private final ContractRepository contractRepository;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final InvoiceComposer composer;
    private final InvoiceNumberGenerator numberGenerator;
    private final StaffAccess staffAccess;
    private final MongoTemplate mongoTemplate;
    private final TransactionTemplate transactionTemplate;

    public InvoiceGenerationServiceImpl(InvoiceRepository invoiceRepository, ContractRepository contractRepository,
                                        RoomRepository roomRepository, RoomSlotRepository roomSlotRepository,
                                        InvoiceComposer composer, InvoiceNumberGenerator numberGenerator,
                                        StaffAccess staffAccess, MongoTemplate mongoTemplate,
                                        PlatformTransactionManager transactionManager) {
        this.invoiceRepository = invoiceRepository;
        this.contractRepository = contractRepository;
        this.roomRepository = roomRepository;
        this.roomSlotRepository = roomSlotRepository;
        this.composer = composer;
        this.numberGenerator = numberGenerator;
        this.staffAccess = staffAccess;
        this.mongoTemplate = mongoTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Override
    public InvoiceGenerateResponse generate(InvoiceGenerateRequest request, AuthPrincipal principal) {
        staffAccess.requireStaff(principal);
        BillingPeriod period = BillingPeriod.parse(request.period());
        boolean dryRun = Boolean.TRUE.equals(request.dryRun());
        boolean explicit = request.contractId() != null || request.roomId() != null;

        List<InvoiceResponse> created = new ArrayList<>();
        List<InvoiceResponse> regenerated = new ArrayList<>();
        List<Skipped> skipped = new ArrayList<>();
        List<Failed> failed = new ArrayList<>();

        Set<String> branchIds = staffAccess.manageableBranchIds(principal);
        Map<String, String> roomBranch = new HashMap<>();
        for (Contract contract : resolveContracts(request, period)) {
            try {
                String branchId = roomBranch.computeIfAbsent(contract.getRoomId(), this::branchOf);
                if (branchIds != null && !branchIds.contains(branchId)) {
                    if (explicit) throw new ForbiddenException("Bạn không có quyền quản lý chi nhánh này");
                    skipped.add(new Skipped(contract.getId(), "NO_ACCESS"));
                    continue;
                }
                Outcome outcome = generateOne(contract, branchId, period, dryRun);
                switch (outcome.kind) {
                    case CREATED -> created.add(outcome.invoice);
                    case REGENERATED -> regenerated.add(outcome.invoice);
                    case SKIPPED -> skipped.add(new Skipped(contract.getId(), outcome.reason));
                }
            } catch (ForbiddenException e) {
                throw e;
            } catch (MissingMeterReadingException e) {
                failed.add(new Failed(contract.getId(), e.getMessage()));
            } catch (DuplicateKeyException e) {
                // Another run created the invoice at the same time
                skipped.add(new Skipped(contract.getId(), "ALREADY_EXISTS"));
            } catch (RuntimeException e) {
                log.warn("Invoice generation failed for contract {}", contract.getId(), e);
                failed.add(new Failed(contract.getId(), e.getMessage()));
            }
        }
        return new InvoiceGenerateResponse(created, regenerated, skipped, failed);
    }

    private Outcome generateOne(Contract contract, String branchId, BillingPeriod period, boolean dryRun) {
        if (!BILLABLE_CONTRACT.contains(contract.getStatus())) {
            return Outcome.skipped("CONTRACT_NOT_ACTIVE");
        }
        if (ContractBillingLoader.billingWindow(contract, period).isEmpty()) {
            return Outcome.skipped("NOT_IN_PERIOD");
        }
        Invoice existing = invoiceRepository
                .findByContractIdAndPeriodAndKindAndIsDeletedFalse(contract.getId(), period.code(), InvoiceKind.MONTHLY)
                .orElse(null);
        if (existing != null && existing.getStatus() != InvoiceStatus.DRAFT) {
            return Outcome.skipped("ALREADY_ISSUED");
        }
        if (composer.otherDraft(contract.getId(), period, existing == null ? null : existing.getId()).isPresent()) {
            return Outcome.skipped("SUPPLEMENTARY_DRAFT_PENDING");
        }

        Invoice draft = existing != null ? existing : newInvoice(contract, branchId, period, InvoiceKind.MONTHLY);
        composer.compose(contract, period, draft);
        Invoice result = dryRun ? draft : save(draft, period);
        return new Outcome(existing != null ? Kind.REGENERATED : Kind.CREATED, InvoiceResponses.of(result), null);
    }

    @Override
    public InvoiceResponse createForContract(String contractId, ContractInvoiceCreateRequest request, AuthPrincipal principal) {
        BillingPeriod period = BillingPeriod.parse(request.period());
        Contract contract = contractRepository.findByIdAndIsDeletedFalse(contractId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng"));
        String branchId = branchOf(contract.getRoomId());
        staffAccess.requireBranch(branchId, principal);
        if (!BILLABLE_CONTRACT.contains(contract.getStatus())) {
            throw new BadRequestException("Hợp đồng chưa có hiệu lực, không thể lập hoá đơn");
        }
        if (ContractBillingLoader.stayWindow(contract, period).isEmpty()) {
            throw new BadRequestException("Hợp đồng không có ngày ở nào trong kỳ " + period.label());
        }

        List<Invoice> live = invoiceRepository.findByContractIdAndPeriodAndIsDeletedFalse(contract.getId(), period.code());
        Invoice existingDraft = live.stream().filter(invoice -> invoice.getStatus() == InvoiceStatus.DRAFT).findFirst().orElse(null);
        boolean isNew = existingDraft == null;
        Invoice draft = existingDraft;
        if (isNew) {
            boolean hasMonthly = live.stream().anyMatch(invoice -> invoice.getKind() == InvoiceKind.MONTHLY);
            draft = newInvoice(contract, branchId, period, hasMonthly ? InvoiceKind.SUPPLEMENTARY : InvoiceKind.MONTHLY);
        }

        InvoiceComposer.Result result = composer.compose(contract, period, draft);
        if (isNew && result.computed() == 0) {
            throw new BadRequestException("Kỳ " + period.label() + " chưa có khoản nào để thu (chưa tới ngày tính tiền phòng và không có dịch vụ)");
        }
        if (isNew && result.remaining() == 0) {
            throw new ConflictException("Mọi khoản của kỳ " + period.label() + " đã được lập hoá đơn, không còn gì để thu thêm");
        }
        return InvoiceResponses.of(Boolean.TRUE.equals(request.dryRun()) ? draft : save(draft, period));
    }

    private Invoice save(Invoice draft, BillingPeriod period) {
        return transactionTemplate.execute(status -> {
            if (draft.getInvoiceNumber() == null) draft.setInvoiceNumber(numberGenerator.next(period.month()));
            return invoiceRepository.save(draft);
        });
    }

    private Invoice newInvoice(Contract contract, String branchId, BillingPeriod period, InvoiceKind kind) {
        Invoice invoice = new Invoice();
        invoice.setKind(kind);
        invoice.setContractId(contract.getId());
        invoice.setTenantId(contract.getTenantId());
        invoice.setBranchId(branchId);
        invoice.setPeriod(period.code());
        invoice.setStatus(InvoiceStatus.DRAFT);
        return invoice;
    }

    private List<Contract> resolveContracts(InvoiceGenerateRequest request, BillingPeriod period) {
        if (request.contractId() != null) {
            return List.of(contractRepository.findByIdAndIsDeletedFalse(request.contractId())
                    .orElseThrow(() -> new NotFoundException("Không tìm thấy hợp đồng")));
        }
        if (request.roomId() != null) {
            List<String> slotIds = roomSlotRepository.findByRoomIdAndIsDeletedFalse(request.roomId()).stream()
                    .map(RoomSlot::getId).toList();
            Set<String> contractIds = mongoTemplate.find(new Query(new Criteria().andOperator(
                            MongoQueryHelper.notDeleted(),
                            Criteria.where("roomSlotId").in(slotIds.stream().map(ObjectId::new).toList()),
                            Criteria.where("contractId").ne(null),
                            Criteria.where("status").in(OccupancyStatus.ACTIVE.name(), OccupancyStatus.ENDED.name()),
                            Criteria.where("startDate").lt(period.range().to()),
                            new Criteria().orOperator(Criteria.where("endDate").is(null),
                                    Criteria.where("endDate").gt(period.range().from())))),
                    RoomSlotOccupancy.class).stream()
                    .map(RoomSlotOccupancy::getContractId)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            return contractRepository.findAllById(contractIds).stream().filter(c -> !Boolean.TRUE.equals(c.getIsDeleted())).toList();
        }
        return mongoTemplate.find(new Query(new Criteria().andOperator(
                MongoQueryHelper.notDeleted(),
                Criteria.where("status").in(BILLABLE_CONTRACT.stream().map(Enum::name).toList()),
                Criteria.where("startDate").lt(period.range().to()),
                new Criteria().orOperator(Criteria.where("endDate").is(null),
                        Criteria.where("endDate").gt(period.range().from())))), Contract.class);
    }

    private String branchOf(String roomId) {
        return roomRepository.findByIdAndIsDeletedFalse(roomId)
                .map(Room::getBranchId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phòng của hợp đồng"));
    }

    private enum Kind { CREATED, REGENERATED, SKIPPED }

    private record Outcome(Kind kind, InvoiceResponse invoice, String reason) {
        static Outcome skipped(String reason) {
            return new Outcome(Kind.SKIPPED, null, reason);
        }
    }
}
