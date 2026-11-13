package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.document.ActiveSlotService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.document.LatePaymentRecord;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.DebtPeriodHistoryResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.LatePaymentHistoryResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.enums.LatePaymentStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.repository.LatePaymentRecordRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Công nợ theo kỳ, dựng từ hoá đơn thật của hợp đồng: mỗi dòng là một hợp đồng đang hiệu lực, số tiền
 * lấy từ hoá đơn kỳ gần nhất chưa tất toán. Lịch sử trễ hạn đọc từ {@link LatePaymentRecord}.
 */
@Service
@RequiredArgsConstructor
public class TenantDebtService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> STAFF_ROLES = Set.of("OWNER", "MANAGER", "ADMIN");
    private static final List<InvoiceStatus> DEBT_STATUSES =
            List.of(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE);

    private final InvoiceRepository invoiceRepository;
    private final LatePaymentRecordRepository latePaymentRepository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final RoomRepository roomRepository;
    private final BranchService branchService;
    private final Clock clock;

    // ------------------------------------------------------------------ list

    public PagedResponse<TenantDebtResponse> listDebts(String branchId, String keyword, boolean overdueOnly,
                                                       String period, Pageable pageable, AuthPrincipal principal) {
        Scope scope = resolveScope(branchId, principal);
        if (scope.contractIds().isEmpty()) {
            return PagedResponse.of(List.of(), pageable.getPageNumber() + 1, pageable.getPageSize(), 0);
        }

        Map<String, Contract> contractById = scope.contractsById();
        List<Invoice> invoices = invoiceRepository.findByContractIdInAndIsDeletedFalse(scope.contractIds());

        Map<String, List<Invoice>> invoiceByContract = invoices.stream()
                .filter(i -> i.getStatus() != InvoiceStatus.CANCELLED)
                .filter(i -> period == null || period.isBlank() || period.trim().equals(i.getPeriod()))
                .collect(Collectors.groupingBy(Invoice::getContractId));

        LocalDate today = LocalDate.ofInstant(clock.instant(), ZONE);
        String needle = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        Map<String, List<LatePaymentRecord>> lateByContract = latePaymentRepository
                .findByContractIdInAndIsDeletedFalse(scope.contractIds()).stream()
                .collect(Collectors.groupingBy(LatePaymentRecord::getContractId));
        List<TenantDebtResponse> items = new ArrayList<>();

        for (String contractId : scope.contractIds()) {
            Contract contract = contractById.get(contractId);
            if (contract == null) continue;
            Room room = scope.roomById().get(contract.getRoomId());
            if (room == null) continue;
            Tenant tenant = scope.tenantByContract().get(contractId);

            List<Invoice> contractInvoices = invoiceByContract.getOrDefault(contractId, List.of());
            // Khoản công nợ là kỳ còn tiền chưa thu sớm nhất; kỳ đã tất toán không che mất kỳ còn nợ cũ hơn.
            Invoice invoice = contractInvoices.stream()
                    .filter(i -> i.getStatus() != InvoiceStatus.PAID && nz(i.getRemainingAmount()).signum() > 0)
                    .min(Comparator.comparing(Invoice::getPeriod, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);
            if (invoice == null) continue;

            TenantDebtResponse item = toDebtItem(contract, invoice, tenant, room,
                    scope.branchById().get(room.getBranchId()), today,
                    scope.tenancyIdByContract().get(contractId),
                    lateByContract.getOrDefault(contractId, List.of()),
                    contractInvoices);
            // Chỉ kỳ đã quá hạn trả mới là công nợ; hoá đơn còn trong hạn không hiện thành dòng công nợ.
            if (!item.overdue()) continue;
            if (!needle.isEmpty() && !matches(item, needle)) continue;
            items.add(item);
        }

        items.sort(Comparator.comparingLong(TenantDebtResponse::overdueDays).reversed()
                .thenComparing(TenantDebtResponse::dueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(TenantDebtResponse::contractNumber, Comparator.nullsLast(Comparator.naturalOrder())));

        int safePage = Math.max(pageable.getPageNumber() + 1, 1);
        int safeSize = Math.max(pageable.getPageSize(), 1);
        int from = Math.min((safePage - 1) * safeSize, items.size());
        int to = Math.min(from + safeSize, items.size());
        return PagedResponse.of(new ArrayList<>(items.subList(from, to)), safePage, safeSize, items.size());
    }

    private static final Set<InvoiceItemType> SERVICE_TYPES = Set.of(InvoiceItemType.ROOM_SERVICE,
            InvoiceItemType.PERSONAL_SERVICE, InvoiceItemType.SLOT_SERVICE);

    private TenantDebtResponse toDebtItem(Contract contract, Invoice invoice, Tenant tenant, Room room,
                                          BranchResponse branch, LocalDate today, String contractTenantId,
                                          List<LatePaymentRecord> records, List<Invoice> contractInvoices) {
        List<InvoiceItem> items = invoice.getItems() == null ? List.of() : invoice.getItems();

        BigDecimal roomRent = sumOf(items, InvoiceItemType.ROOM_RENT);
        // Hoá đơn không có kiểu riêng cho nước: đó là một dòng dịch vụ có mô tả "nước". Tách ra khỏi
        // danh sách dịch vụ để không cộng hai lần.
        List<InvoiceItem> waterItems = items.stream()
                .filter(i -> i.getType() != null && SERVICE_TYPES.contains(i.getType()))
                .filter(TenantDebtService::isWater)
                .toList();
        List<InvoiceItem> serviceItems = items.stream()
                .filter(i -> i.getType() != null && SERVICE_TYPES.contains(i.getType()))
                .filter(i -> !isWater(i))
                .toList();
        BigDecimal registeredServicesAmount = serviceItems.stream()
                .map(i -> nz(i.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal electricity = sumOf(items, InvoiceItemType.ELECTRICITY);
        BigDecimal water = waterItems.stream()
                .map(i -> nz(i.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<TenantDebtServiceItemResponse> services = serviceItems.stream()
                .map(i -> new TenantDebtServiceItemResponse(null, i.getDescription(),
                        i.getType() == InvoiceItemType.PERSONAL_SERVICE ? "người/tháng" : "tháng",
                        nz(i.getUnitPrice()), i.getQuantity() == null ? 1 : i.getQuantity().intValue(),
                        nz(i.getAmount()), i.getType() != InvoiceItemType.SLOT_SERVICE))
                .toList();

        LocalDate dueDate = invoice.getDueDate();
        // Hoá đơn đã thu đủ thì không còn trễ, bất kể đã quá hạn trả bao lâu.
        boolean settled = invoice.getStatus() == InvoiceStatus.PAID
                || nz(invoice.getRemainingAmount()).signum() <= 0;
        long overdueDays = !settled && dueDate != null && dueDate.isBefore(today)
                ? ChronoUnit.DAYS.between(dueDate, today) : 0;
        boolean overdue = overdueDays > 0;

        LatePaymentRecord record = records.stream()
                .filter(r -> Objects.equals(r.getPeriod(), invoice.getPeriod()))
                .findFirst().orElse(null);
        List<LatePaymentHistoryResponse> history = records.stream()
                .filter(r -> !Objects.equals(r.getPeriod(), invoice.getPeriod()))
                .sorted(Comparator.comparing(LatePaymentRecord::getPeriod,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(this::toHistory)
                .toList();
        List<DebtPeriodHistoryResponse> periodHistory = periodHistory(contractInvoices, records, today);

        String status = overdue ? "OVERDUE"
                : nz(invoice.getPaidAmount()).signum() > 0 ? "PARTIAL" : "UNPAID";

        return new TenantDebtResponse(
                invoice.getId(),
                contract.getId(),
                contract.getContractNumber(),
                contract.getStatus() == null ? null : contract.getStatus().name(),
                contract.getStartDate(),
                contract.getEndDate(),
                contract.getSignedDate(),
                contract.getContractDepositAmount(),
                contract.getPaymentDueDay(),
                contract.getStartDate(),
                contractTenantId,
                tenant == null ? null : tenant.getId(),
                tenant != null ? tenant.getFullName() : contract.getTenantName(),
                tenant == null ? null : tenant.getEmail(),
                tenant == null ? null : tenant.getPhone(),
                tenant != null && tenant.getIdCardNumber() != null ? tenant.getIdCardNumber() : contract.getTenantIdNumber(),
                tenant == null || tenant.getGender() == null ? null : tenant.getGender().name(),
                tenant == null ? null : tenant.getDateOfBirth(),
                tenant != null && tenant.getAddress() != null ? tenant.getAddress() : contract.getTenantAddress(),
                room.getBranchId(),
                branch == null ? null : branch.name(),
                room.getId(),
                room.getRoomNumber(),
                invoice.getPeriod(),
                dueDate,
                overdueDays,
                overdue,
                roomRent,
                services,
                registeredServicesAmount,
                electricity,
                water,
                electricity.add(water),
                nz(invoice.getTotalAmount()),
                nz(invoice.getPaidAmount()),
                nz(invoice.getRemainingAmount()),
                status,
                record == null ? 0 : record.getLateDays(),
                record == null ? 0 : record.getReminderCount(),
                history,
                periodHistory
        );
    }

    /**
     * Số ngày trễ của một kỳ, tính đến lúc tất toán (hoặc hôm nay nếu còn nợ). Kỳ đã trả đủ vẫn giữ lại
     * số ngày nó từng trễ; kỳ trả trước hạn trả về 0.
     */
    private static long lateDaysOf(Invoice inv, LocalDate today) {
        LocalDate due = inv.getDueDate();
        if (due == null) return 0;
        LocalDate settledOn = inv.getStatus() == InvoiceStatus.PAID
                || nz(inv.getRemainingAmount()).signum() <= 0
                ? (inv.getUpdatedAt() == null ? today : LocalDate.ofInstant(inv.getUpdatedAt(), ZONE))
                : null;
        LocalDate until = settledOn != null && settledOn.isBefore(today) ? settledOn : today;
        return until.isAfter(due) ? ChronoUnit.DAYS.between(due, until) : 0;
    }

    /** Các kỳ hoá đơn có công nợ của hợp đồng, mới nhất trước; ghép thêm dữ liệu trễ hạn nếu có. */
    private List<DebtPeriodHistoryResponse> periodHistory(List<Invoice> contractInvoices,
                                                          List<LatePaymentRecord> records, LocalDate today) {
        Map<String, LatePaymentRecord> recordByPeriod = records.stream()
                .filter(r -> r.getPeriod() != null)
                .collect(Collectors.toMap(LatePaymentRecord::getPeriod, r -> r, (a, b) -> a));
        return contractInvoices.stream()
                .filter(i -> i.getPeriod() != null && i.getStatus() != InvoiceStatus.CANCELLED)
                .sorted(Comparator.comparing(Invoice::getPeriod,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(inv -> {
                    LatePaymentRecord r = recordByPeriod.get(inv.getPeriod());
                    return new DebtPeriodHistoryResponse(inv.getId(), inv.getInvoiceNumber(), inv.getPeriod(),
                            inv.getDueDate(), inv.getIssueDate(), nz(inv.getTotalAmount()), nz(inv.getPaidAmount()),
                            nz(inv.getRemainingAmount()),
                            inv.getStatus() == null ? null : inv.getStatus().name(),
                            lateDaysOf(inv, today),
                            r == null ? 0 : r.getLateDays(),
                            r == null ? 0 : r.getReminderCount(),
                            r == null ? null : r.getStatus() == null ? null : r.getStatus().name());
                })
                .toList();
    }

    private boolean matches(TenantDebtResponse item, String needle) {
        return contains(item.tenantName(), needle)
                || contains(item.tenantPhone(), needle)
                || contains(item.tenantEmail(), needle)
                || contains(item.roomNumber(), needle)
                || contains(item.contractNumber(), needle)
                || contains(item.id(), needle);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    // ---------------------------------------------------------------- pay/unpay

    @Transactional
    public TenantDebtResponse payDebt(String debtId, AuthPrincipal principal) {
        Invoice invoice = requireDebtInvoice(debtId, principal, false);
        invoice.setPaidAmount(nz(invoice.getTotalAmount()));
        invoice.setRemainingAmount(BigDecimal.ZERO);
        invoice.setStatus(InvoiceStatus.PAID);
        Invoice saved = invoiceRepository.save(invoice);
        settleLatePayment(saved);
        return reloadDebt(saved.getId(), principal);
    }

    @Transactional
    public TenantDebtResponse unpayDebt(String debtId, AuthPrincipal principal) {
        Invoice invoice = requireDebtInvoice(debtId, principal, true);
        invoice.setPaidAmount(BigDecimal.ZERO);
        invoice.setRemainingAmount(nz(invoice.getTotalAmount()));
        invoice.setStatus(InvoiceStatus.ISSUED);
        Invoice saved = invoiceRepository.save(invoice);
        reopenLatePayment(saved);
        return reloadDebt(saved.getId(), principal);
    }

    private Invoice requireDebtInvoice(String debtId, AuthPrincipal principal, boolean staffOnly) {
        Scope scope = resolveScope(null, principal);
        if (staffOnly && (principal == null || !STAFF_ROLES.contains(principal.role()))) {
            throw new ForbiddenException("Chỉ Chủ cơ sở/Quản lý mới được hoàn tác thanh toán");
        }
        Invoice invoice = invoiceRepository.findByIdAndIsDeletedFalse(debtId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy khoản công nợ"));
        if (!scope.contractIds().contains(invoice.getContractId())) {
            throw new ForbiddenException("Khoản công nợ không thuộc phạm vi của bạn");
        }
        return invoice;
    }

    private TenantDebtResponse reloadDebt(String invoiceId, AuthPrincipal principal) {
        return listDebts(null, null, false, null,
                org.springframework.data.domain.PageRequest.of(0, 500), principal)
                .getContent().stream()
                .filter(d -> invoiceId.equals(d.id()))
                .findFirst()
                .orElseGet(() -> {
                    Invoice invoice = invoiceRepository.findByIdAndIsDeletedFalse(invoiceId)
                            .orElseThrow(() -> new NotFoundException("Không tìm thấy khoản công nợ"));
                    Contract contract = contractRepository.findByIdAndIsDeletedFalse(invoice.getContractId()).orElse(null);
                    Room room = contract == null ? null
                            : roomRepository.findByIdAndIsDeletedFalse(contract.getRoomId()).orElse(null);
                    Tenant tenant = contract == null ? null
                            : tenantRepository.findByIdAndIsDeletedFalse(contract.getTenantId()).orElse(null);
                    BranchResponse branch = room == null ? null : branchService.getById(room.getBranchId());
                    LocalDate today = LocalDate.ofInstant(clock.instant(), ZONE);
                    String contractTenantId = contractTenantRepository.findByContractIdInAndIsDeletedFalse(
                                    List.of(invoice.getContractId())).stream()
                            .filter(ct -> ct.getStatus() == ContractTenantStatus.ACTIVE)
                            .map(ContractTenant::getId).findFirst().orElse(null);
                    return toDebtItem(contract, invoice, tenant, room, branch, today, contractTenantId,
                            latePaymentRepository.findByContractIdInAndIsDeletedFalse(
                                    List.of(invoice.getContractId())),
                            invoiceRepository.findByContractIdInAndIsDeletedFalse(
                                    List.of(invoice.getContractId())));
                });
    }

    private void settleLatePayment(Invoice invoice) {
        localRecord(invoice).ifPresent(record -> {
            record.setStatus(LatePaymentStatus.SETTLED);
            record.setSettledAt(clock.instant());
            record.setLastEvaluatedAt(clock.instant());
            record.setPaidAmount(nz(invoice.getPaidAmount()));
            record.setRemainingAmount(BigDecimal.ZERO);
            latePaymentRepository.save(record);
        });
    }

    private void reopenLatePayment(Invoice invoice) {
        localRecord(invoice).ifPresent(record -> {
            record.setStatus(LatePaymentStatus.OPEN);
            record.setSettledAt(null);
            record.setRemainingAmount(nz(invoice.getRemainingAmount()));
            latePaymentRepository.save(record);
        });
    }

    private java.util.Optional<LatePaymentRecord> localRecord(Invoice invoice) {
        if (invoice.getContractId() == null || invoice.getPeriod() == null) return java.util.Optional.empty();
        return latePaymentRepository.findByContractIdAndPeriodAndIsDeletedFalse(
                invoice.getContractId(), invoice.getPeriod());
    }

    // -------------------------------------------------------------- history

    public List<LatePaymentHistoryResponse> latePaymentHistory(String contractId, AuthPrincipal principal) {
        Scope scope = resolveScope(null, principal);
        if (!scope.contractIds().contains(contractId)) {
            if (principal == null || !STAFF_ROLES.contains(principal.role())) {
                throw new ForbiddenException("Bạn không có quyền xem lịch sử trễ hạn của hợp đồng này");
            }
            return List.of();
        }
        return latePaymentRepository.findByContractIdInAndIsDeletedFalse(List.of(contractId)).stream()
                .sorted(Comparator.comparing(LatePaymentRecord::getPeriod,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(this::toHistory)
                .toList();
    }

    private LatePaymentHistoryResponse toHistory(LatePaymentRecord r) {
        return new LatePaymentHistoryResponse(r.getId(), r.getInvoiceId(), r.getPeriod(), r.getDueDate(),
                r.getFirstOverdueDate(), r.getLateDays(),
                r.getStatus() == null ? null : r.getStatus().name(),
                nz(r.getTotalAmount()), nz(r.getPaidAmount()), nz(r.getRemainingAmount()),
                r.getReminderCount(), r.getLastReminderAt(), r.getSettledAt());
    }

    // --------------------------------------------------------------- scope

    private Scope resolveScope(String requestedBranchId, AuthPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập");
        }
        if (STAFF_ROLES.contains(principal.role())) return staffScope(requestedBranchId, principal);
        return tenantScope(principal);
    }

    private Scope staffScope(String requestedBranchId, AuthPrincipal principal) {
        List<BranchResponse> allowed = branchService.managedBranches(principal);
        if (requestedBranchId != null && !requestedBranchId.isBlank()) {
            String trimmed = requestedBranchId.trim();
            if (allowed.stream().noneMatch(b -> b.id().equals(trimmed))) {
                branchService.requireManagementAccess(trimmed, principal);
                allowed = List.of(branchService.getById(trimmed));
            } else {
                allowed = allowed.stream().filter(b -> b.id().equals(trimmed)).toList();
            }
        }
        Map<String, BranchResponse> branchById = allowed.stream()
                .collect(Collectors.toMap(BranchResponse::id, Function.identity(), (a, b) -> a));
        if (branchById.isEmpty()) return Scope.empty();

        List<Room> rooms = roomRepository.findByBranchIdInAndIsDeletedFalse(branchById.keySet());
        Map<String, Room> roomById = rooms.stream().collect(Collectors.toMap(Room::getId, Function.identity()));
        if (roomById.isEmpty()) return Scope.empty();

        List<Contract> contracts = contractRepository.findByRoomIdInAndIsDeletedFalse(roomById.keySet()).stream()
                .filter(c -> c.getStatus() == ContractStatus.ACTIVE)
                .toList();
        return buildScope(contracts, roomById, branchById);
    }

    private Scope tenantScope(AuthPrincipal principal) {
        Tenant me = tenantRepository.findByEmailAndIsDeletedFalse(principal.email())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ người thuê"));
        List<Contract> contracts = new ArrayList<>(contractRepository.findByTenantIdAndIsDeletedFalse(me.getId()));
        Set<String> contractIds = contracts.stream().map(Contract::getId).collect(Collectors.toSet());
        for (ContractTenant ct : contractTenantRepository.findByTenantIdAndIsDeletedFalse(me.getId())) {
            if (ct.getStatus() != ContractTenantStatus.ACTIVE || ct.getContractId() == null) continue;
            if (contractIds.add(ct.getContractId())) {
                contractRepository.findByIdAndIsDeletedFalse(ct.getContractId())
                        .filter(c -> c.getStatus() == ContractStatus.ACTIVE)
                        .ifPresent(contracts::add);
            }
        }
        contracts = contracts.stream().filter(c -> c.getStatus() == ContractStatus.ACTIVE).toList();
        if (contracts.isEmpty()) return Scope.empty();

        Set<String> roomIds = contracts.stream().map(Contract::getRoomId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Room> roomById = roomRepository.findAllById(roomIds).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsDeleted()))
                .collect(Collectors.toMap(Room::getId, Function.identity()));
        Map<String, BranchResponse> branchById = new HashMap<>();
        for (Room room : roomById.values()) {
            branchById.computeIfAbsent(room.getBranchId(), branchService::getById);
        }
        return buildScope(contracts, roomById, branchById);
    }

    private Scope buildScope(List<Contract> contracts, Map<String, Room> roomById,
                             Map<String, BranchResponse> branchById) {
        if (contracts.isEmpty()) return Scope.empty();
        Map<String, Contract> contractById = contracts.stream()
                .filter(c -> c.getRoomId() != null && roomById.containsKey(c.getRoomId()))
                .collect(Collectors.toMap(Contract::getId, Function.identity(), (a, b) -> a));
        if (contractById.isEmpty()) return Scope.empty();

        Map<String, Tenant> tenantById = new HashMap<>();
        for (Contract c : contractById.values()) {
            if (c.getTenantId() != null) {
                tenantRepository.findByIdAndIsDeletedFalse(c.getTenantId())
                        .ifPresent(t -> tenantById.put(t.getId(), t));
            }
        }
        Map<String, Tenant> tenantByContract = new LinkedHashMap<>();
        contractById.values().forEach(c -> {
            if (c.getTenantId() != null && tenantById.containsKey(c.getTenantId())) {
                tenantByContract.put(c.getId(), tenantById.get(c.getTenantId()));
            }
        });
        Map<String, String> tenancyIdByContract = new LinkedHashMap<>();
        contractTenantRepository.findByContractIdInAndIsDeletedFalse(contractById.keySet()).stream()
                .filter(ct -> ct.getStatus() == ContractTenantStatus.ACTIVE)
                .forEach(ct -> tenancyIdByContract.merge(ct.getContractId(), ct.getId(), (a, b) -> a));
        return new Scope(List.copyOf(contractById.keySet()), contractById, roomById, branchById,
                tenantByContract, tenancyIdByContract);
    }

    // --------------------------------------------------------------- helpers

    private static BigDecimal sumOf(List<InvoiceItem> items, InvoiceItemType type) {
        return items.stream()
                .filter(i -> i.getType() == type && i.getAmount() != null)
                .map(InvoiceItem::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Hoá đơn tháng ghi tiền nước thành một dòng dịch vụ; nhận diện theo mô tả vì không có kiểu riêng. */
    private static boolean isWater(InvoiceItem item) {
        String description = item.getDescription();
        return description != null && description.toLowerCase(Locale.ROOT).contains("nước");
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private record Scope(List<String> contractIds, Map<String, Contract> contractsById,
                         Map<String, Room> roomById, Map<String, BranchResponse> branchById,
                         Map<String, Tenant> tenantByContract, Map<String, String> tenancyIdByContract) {
        static Scope empty() {
            return new Scope(List.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
        }
    }
}
