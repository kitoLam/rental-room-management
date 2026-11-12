package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
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
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.request.InvoiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.TenantDebtServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.document.RoomServiceCharge;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.SlotServiceStatus;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
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
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final InvoiceRepository invoiceRepository;
    private final BranchService branchService;
    private final RoomRepository roomRepository;
    private final ContractRepository contractRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final TenantRepository tenantRepository;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;

    public InvoiceServiceImpl(MongoTemplate mongoTemplate, InvoiceRepository invoiceRepository) {
        this(invoiceRepository, null, null, null, null, null, mongoTemplate, Clock.systemDefaultZone());
    }

    @Override
    public PagedResponse<TenantDebtResponse> listDebts(
            String branchId,
            String keyword,
            boolean overdueOnly,
            String period,
            Pageable pageable,
            AuthPrincipal principal
    ) {
        Map<String, BranchResponse> scopedBranches = resolveScopedBranches(branchId, principal);
        if (scopedBranches.isEmpty()) {
            return PagedResponse.from(new PageImpl<>(List.of(), pageable, 0));
        }

        List<Room> rooms = roomRepository.findByBranchIdInAndIsDeletedFalse(scopedBranches.keySet());
        if (rooms.isEmpty()) {
            return PagedResponse.from(new PageImpl<>(List.of(), pageable, 0));
        }
        Map<String, Room> roomById = rooms.stream().collect(Collectors.toMap(Room::getId, r -> r));

        List<Contract> contracts = contractRepository.findByRoomIdInAndIsDeletedFalse(roomById.keySet())
                .stream()
                .filter(c -> c.getStatus() == ContractStatus.ACTIVE)
                .toList();
        if (contracts.isEmpty()) {
            return PagedResponse.from(new PageImpl<>(List.of(), pageable, 0));
        }

        Map<String, Contract> contractById = contracts.stream().collect(Collectors.toMap(Contract::getId, c -> c));
        List<ContractTenant> contractTenants = contractTenantRepository.findByContractIdInAndIsDeletedFalse(contractById.keySet())
                .stream()
                .filter(ct -> ct.getStatus() == ContractTenantStatus.ACTIVE)
                .toList();

        Map<String, Tenant> tenantById = tenantRepository.findByIsDeletedFalse()
                .stream()
                .collect(Collectors.toMap(Tenant::getId, t -> t, (a, b) -> a));

        boolean isTenantOnly = isTenantOnlyCaller(principal);
        Set<String> callerTenantIds = isTenantOnly ? resolveCallerTenantIds(principal, tenantById) : Set.of();
        if (isTenantOnly && callerTenantIds.isEmpty()) {
            return PagedResponse.from(new PageImpl<>(List.of(), pageable, 0));
        }

        List<RoomService> activeRoomServices = mongoTemplate.find(
                new Query(Criteria.where("isDeleted").is(false)
                        .and("status").is(RoomServiceStatus.ACTIVE.name())),
                RoomService.class
        );
        Map<String, List<RoomService>> roomServicesByBranchId = activeRoomServices.stream()
                .filter(rs -> rs.getBranchId() != null)
                .collect(Collectors.groupingBy(RoomService::getBranchId));

        List<RoomServiceCharge> roomCharges = mongoTemplate.find(
                new Query(Criteria.where("isDeleted").is(false)),
                RoomServiceCharge.class
        );
        Map<String, List<RoomServiceCharge>> chargesByRoomServiceId = roomCharges.stream()
                .filter(rc -> rc.getRoomServiceId() != null)
                .collect(Collectors.groupingBy(RoomServiceCharge::getRoomServiceId));

        List<Invoice> allInvoices = mongoTemplate.find(
                new Query(Criteria.where("isDeleted").is(false)),
                Invoice.class
        );
        Map<String, List<Invoice>> invoicesByContractTenantId = allInvoices.stream()
                .filter(inv -> inv.getContractTenantId() != null)
                .collect(Collectors.groupingBy(Invoice::getContractTenantId));

        LocalDate today = LocalDate.now(clock.withZone(VIETNAM_ZONE));
        String targetPeriod = (period != null && !period.isBlank())
                ? period.trim()
                : YearMonth.from(today).toString();

        // Build map of active tenancy entries (by contract + tenant)
        Map<String, ContractTenant> ctByContractAndTenant = new LinkedHashMap<>();
        for (ContractTenant ct : contractTenants) {
            if (ct.getContractId() != null && ct.getTenantId() != null) {
                ctByContractAndTenant.put(ct.getContractId() + ":" + ct.getTenantId(), ct);
            }
        }
        // Ensure representative tenant on Contract is also included even if ContractTenant record wasn't created separately
        for (Contract c : contracts) {
            if (c.getTenantId() != null) {
                String key = c.getId() + ":" + c.getTenantId();
                ctByContractAndTenant.computeIfAbsent(key, k -> {
                    ContractTenant synthetic = new ContractTenant();
                    synthetic.setId(c.getId());
                    synthetic.setContractId(c.getId());
                    synthetic.setTenantId(c.getTenantId());
                    synthetic.setRoomSlotIds(c.getRoomSlotIds() != null ? c.getRoomSlotIds() : List.of());
                    synthetic.setServices(c.getServices() != null ? c.getServices() : List.of());
                    synthetic.setRentAmount(c.getRentPrice());
                    synthetic.setJoinedAt(c.getStartDate());
                    synthetic.setStatus(ContractTenantStatus.ACTIVE);
                    return synthetic;
                });
            }
        }

        // Keep 1 currently active contract per (tenant, room) so a tenant renting multiple rooms sees all rented rooms,
        // while excluding expired, future, or temporary (TMP-) contracts.
        Comparator<ContractTenant> activeContractPriority = (a, b) -> {
            Contract ca = contractById.get(a.getContractId());
            Contract cb = contractById.get(b.getContractId());
            boolean effA = isContractEffectiveOn(ca, today);
            boolean effB = isContractEffectiveOn(cb, today);
            if (effA != effB) {
                return effA ? -1 : 1;
            }
            LocalDate startA = ca != null && ca.getStartDate() != null ? ca.getStartDate() : LocalDate.MIN;
            LocalDate startB = cb != null && cb.getStartDate() != null ? cb.getStartDate() : LocalDate.MIN;
            int startCmp = startB.compareTo(startA);
            if (startCmp != 0) return startCmp;
            String numA = ca != null && ca.getContractNumber() != null ? ca.getContractNumber() : "";
            String numB = cb != null && cb.getContractNumber() != null ? cb.getContractNumber() : "";
            return numB.compareTo(numA);
        };

        Map<String, ContractTenant> activeCtByTenantAndRoom = new LinkedHashMap<>();
        for (ContractTenant ct : ctByContractAndTenant.values()) {
            if (ct.getTenantId() == null) continue;
            Contract c = contractById.get(ct.getContractId());
            if (!isContractEffectiveOn(c, today)) continue;
            String cNum = c.getContractNumber() != null ? c.getContractNumber().trim().toUpperCase(Locale.ROOT) : "";
            if (cNum.startsWith("TMP-")) continue;
            String roomKey = c.getRoomId() != null ? c.getRoomId() : c.getId();
            String compositeKey = ct.getTenantId() + ":" + roomKey;
            ContractTenant existing = activeCtByTenantAndRoom.get(compositeKey);
            if (existing == null || activeContractPriority.compare(ct, existing) < 0) {
                activeCtByTenantAndRoom.put(compositeKey, ct);
            }
        }

        List<TenantDebtResponse> results = new ArrayList<>();

        for (ContractTenant ct : activeCtByTenantAndRoom.values()) {
            if (isTenantOnly && !callerTenantIds.contains(ct.getTenantId())) {
                continue;
            }
            Contract contract = contractById.get(ct.getContractId());
            if (contract == null) continue;
            Room room = roomById.get(contract.getRoomId());
            if (room == null) continue;
            BranchResponse branch = scopedBranches.get(room.getBranchId());
            Tenant tenant = tenantById.get(ct.getTenantId());

            String tenantName = tenant != null && tenant.getFullName() != null
                    ? tenant.getFullName()
                    : (contract.getTenantName() != null ? contract.getTenantName() : "Người thuê");
            String tenantEmail = tenant != null && tenant.getEmail() != null ? tenant.getEmail() : "";
            String tenantPhone = tenant != null && tenant.getPhone() != null ? tenant.getPhone() : "";
            String tenantIdNumber = tenant != null && tenant.getIdCardNumber() != null && !tenant.getIdCardNumber().isBlank()
                    ? tenant.getIdCardNumber()
                    : (contract.getTenantIdNumber() != null ? contract.getTenantIdNumber() : "");
            String tenantGender = tenant != null && tenant.getGender() != null ? tenant.getGender().name() : null;
            LocalDate tenantDob = tenant != null ? tenant.getDateOfBirth() : null;
            String tenantAddr = tenant != null && tenant.getAddress() != null && !tenant.getAddress().isBlank()
                    ? tenant.getAddress()
                    : (contract.getTenantAddress() != null ? contract.getTenantAddress() : "");
            String contractNumber = contract.getContractNumber() != null && !contract.getContractNumber().isBlank()
                    ? contract.getContractNumber()
                    : ("HD-" + (room.getRoomNumber() != null ? room.getRoomNumber() : "PHONG"));
            String contractStatus = contract.getStatus() != null ? contract.getStatus().name() : "ACTIVE";
            BigDecimal depositAmount = contract.getContractDepositAmount() != null
                    ? contract.getContractDepositAmount()
                    : resolveRoomRent(null, ct, contract, room);
            Integer dueDay = contract.getPaymentDueDay() != null ? contract.getPaymentDueDay() : 5;
            LocalDate joinedAt = ct.getJoinedAt() != null ? ct.getJoinedAt() : contract.getStartDate();

            // Find latest non-cancelled invoice for this contractTenant if one exists
            List<Invoice> tenantInvoices = invoicesByContractTenantId.getOrDefault(ct.getId(), List.of());
            Invoice currentInvoice = tenantInvoices.stream()
                    .filter(inv -> inv.getStatus() != InvoiceStatus.CANCELLED)
                    .filter(inv -> period == null || period.isBlank() || period.trim().equals(inv.getPeriod()))
                    .max(Comparator.comparing(Invoice::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);

            Invoice unpaidInvoice = (currentInvoice != null && currentInvoice.getStatus() != InvoiceStatus.PAID)
                    ? currentInvoice
                    : null;
            boolean isPaid = currentInvoice != null && currentInvoice.getStatus() == InvoiceStatus.PAID;

            // 1. Chi phí phòng (Room Rent)
            BigDecimal roomRentAmount = resolveRoomRent(currentInvoice, ct, contract, room);

            // 2. Dịch vụ đã đăng ký (Registered Services, excluding metered electricity/water)
            List<TenantDebtServiceItemResponse> registeredServices = resolveRegisteredServices(
                    contract,
                    ct,
                    room,
                    roomServicesByBranchId.getOrDefault(room.getBranchId(), List.of())
            );
            BigDecimal registeredServicesAmount = registeredServices.stream()
                    .map(TenantDebtServiceItemResponse::amount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // 3. Tổng tiền điện nước chưa thanh toán (Unpaid Electricity & Water)
            UtilityBreakdown utility = resolveUnpaidUtility(
                    currentInvoice,
                    contract,
                    room,
                    branch,
                    roomServicesByBranchId.getOrDefault(room.getBranchId(), List.of()),
                    chargesByRoomServiceId
            );

            // 4. Hạn thanh toán & Đã trễ hẹn từ ngày nào
            LocalDate dueDate = resolveDueDate(currentInvoice, contract, today);
            String effectivePeriod = currentInvoice != null && currentInvoice.getPeriod() != null
                    ? currentInvoice.getPeriod()
                    : YearMonth.from(dueDate).toString();

            // Quy tắc tháng đầu mới dọn vào ở:
            // - Công nợ tháng đầu chỉ tính tiền phòng (không tính điện nước & dịch vụ, điện nước sẽ tính vào tháng sau)
            // - 1 tháng quy chuẩn = 30 ngày (100%): tính số ngày ở từ ngày hợp đồng có hiệu lực tới cuối tháng (30 ngày) rồi trừ đi phần ngày chưa ở
            LocalDate moveInDate = contract.getStartDate() != null ? contract.getStartDate() : joinedAt;
            boolean isFirstMonth = moveInDate != null
                    && YearMonth.from(moveInDate).toString().equals(effectivePeriod);
            if (isFirstMonth) {
                BigDecimal baseRoomRent = resolveRoomRent(null, ct, contract, room);
                int startDay = Math.min(30, Math.max(1, moveInDate.getDayOfMonth()));
                int stayedDays = Math.max(1, 30 - startDay + 1);
                roomRentAmount = baseRoomRent
                        .multiply(BigDecimal.valueOf(stayedDays))
                        .divide(BigDecimal.valueOf(30), 0, java.math.RoundingMode.HALF_UP);
                registeredServices = List.of();
                registeredServicesAmount = BigDecimal.ZERO;
                utility = new UtilityBreakdown(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
            }

            BigDecimal totalAmount = roomRentAmount
                    .add(registeredServicesAmount)
                    .add(utility.unpaidUtilityAmount());
            BigDecimal paidAmount = isPaid
                    ? totalAmount
                    : (unpaidInvoice != null && unpaidInvoice.getPaidAmount() != null
                            ? unpaidInvoice.getPaidAmount()
                            : BigDecimal.ZERO);
            BigDecimal remainingAmount = isPaid
                    ? BigDecimal.ZERO
                    : totalAmount.subtract(paidAmount).max(BigDecimal.ZERO);

            long overdueDays = (!isPaid && remainingAmount.compareTo(BigDecimal.ZERO) > 0 && today.isAfter(dueDate))
                    ? ChronoUnit.DAYS.between(dueDate, today)
                    : 0L;
            boolean isOverdue = !isPaid && remainingAmount.compareTo(BigDecimal.ZERO) > 0
                    && (overdueDays > 0 || (unpaidInvoice != null && unpaidInvoice.getStatus() == InvoiceStatus.OVERDUE));

            String status = isPaid ? "PAID" : (isOverdue ? "OVERDUE" : "UNPAID");

            TenantDebtResponse debtItem = new TenantDebtResponse(
                    currentInvoice != null ? currentInvoice.getId() : ct.getId(),
                    contract.getId(),
                    contractNumber,
                    contractStatus,
                    contract.getStartDate(),
                    contract.getEndDate(),
                    contract.getSignedDate(),
                    depositAmount,
                    dueDay,
                    joinedAt,
                    ct.getId(),
                    ct.getTenantId(),
                    tenantName,
                    tenantEmail,
                    tenantPhone,
                    tenantIdNumber,
                    tenantGender,
                    tenantDob,
                    tenantAddr,
                    room.getBranchId(),
                    branch != null ? branch.name() : "",
                    room.getId(),
                    room.getRoomNumber(),
                    effectivePeriod,
                    dueDate,
                    overdueDays,
                    isOverdue,
                    roomRentAmount,
                    registeredServices,
                    registeredServicesAmount,
                    utility.electricityAmount(),
                    utility.waterAmount(),
                    isPaid ? BigDecimal.ZERO : utility.unpaidUtilityAmount(),
                    totalAmount,
                    paidAmount,
                    remainingAmount,
                    status
            );

            if (overdueOnly && !debtItem.overdue()) {
                continue;
            }
            if (!matchesKeyword(debtItem, keyword)) {
                continue;
            }
            results.add(debtItem);
        }

        // Sort by roomNumber ascending (or overdueDays descending then roomNumber)
        results.sort((a, b) -> {
            int roomCmp = compareRoomCode(
                    a.roomNumber() != null ? a.roomNumber() : "",
                    b.roomNumber() != null ? b.roomNumber() : ""
            );
            if (roomCmp != 0) return roomCmp;
            return Long.compare(b.overdueDays(), a.overdueDays());
        });

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), results.size());
        List<TenantDebtResponse> pageContent = start >= results.size() ? List.of() : results.subList(start, end);

        return PagedResponse.from(new PageImpl<>(pageContent, pageable, results.size()));
    }

    private boolean isContractEffectiveOn(Contract c, LocalDate today) {
        if (c == null || c.getStatus() != ContractStatus.ACTIVE) return false;
        if (c.getStartDate() != null && c.getStartDate().isAfter(today)) return false;
        if (c.getEndDate() != null && c.getEndDate().isBefore(today)) return false;
        return true;
    }

    private BigDecimal resolveRoomRent(Invoice unpaidInvoice, ContractTenant ct, Contract contract, Room room) {
        if (unpaidInvoice != null && unpaidInvoice.getItems() != null) {
            BigDecimal fromInvoice = unpaidInvoice.getItems().stream()
                    .filter(item -> item.getType() == InvoiceItemType.ROOM_RENT && item.getAmount() != null)
                    .map(InvoiceItem::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (fromInvoice.compareTo(BigDecimal.ZERO) > 0) {
                return fromInvoice;
            }
        }
        if (ct.getRentAmount() != null && ct.getRentAmount().compareTo(BigDecimal.ZERO) > 0) {
            return ct.getRentAmount();
        }
        if (contract.getRentPrice() != null && contract.getRentPrice().compareTo(BigDecimal.ZERO) > 0) {
            return contract.getRentPrice();
        }
        if (room.getListedRentPrice() != null && room.getListedRentPrice().compareTo(BigDecimal.ZERO) > 0) {
            return room.getListedRentPrice();
        }
        return BigDecimal.ZERO;
    }

    private List<TenantDebtServiceItemResponse> resolveRegisteredServices(
            Contract contract,
            ContractTenant ct,
            Room room,
            List<RoomService> roomServices
    ) {
        Map<String, TenantDebtServiceItemResponse> byKey = new LinkedHashMap<>();

        List<ContractServiceSnapshot> snapshots = new ArrayList<>();
        if (contract.getServices() != null) snapshots.addAll(contract.getServices());
        if (ct.getServices() != null) snapshots.addAll(ct.getServices());

        for (ContractServiceSnapshot s : snapshots) {
            if (!s.isSelected() && !s.isMandatory()) continue;
            if (isElectricityOrWater(s.getName(), s.getCalculationType())) continue;
            BigDecimal unitPrice = s.getUnitPrice() != null ? s.getUnitPrice() : BigDecimal.ZERO;
            int qty = s.getQuantity() != null && s.getQuantity() > 0 ? s.getQuantity() : 1;
            BigDecimal amount = unitPrice.multiply(BigDecimal.valueOf(qty));
            String key = s.getServiceId() != null ? s.getServiceId() : s.getName();
            byKey.putIfAbsent(key, new TenantDebtServiceItemResponse(
                    s.getServiceId(),
                    s.getName() != null ? s.getName() : "Dịch vụ",
                    s.getUnit() != null ? s.getUnit() : "tháng",
                    unitPrice,
                    qty,
                    amount,
                    s.isMandatory()
            ));
        }

        if (contract.getActiveSlotServices() != null) {
            LocalDate today = LocalDate.now(clock.withZone(VIETNAM_ZONE));
            for (ActiveSlotService as : contract.getActiveSlotServices()) {
                if (!as.isActiveOn(today)) continue;
                if (isElectricityOrWater(as.getName(), "")) continue;
                BigDecimal unitPrice = as.getUnitPrice() != null ? as.getUnitPrice() : BigDecimal.ZERO;
                int qty = as.getQuantity() != null && as.getQuantity() > 0 ? as.getQuantity() : 1;
                BigDecimal amount = unitPrice.multiply(BigDecimal.valueOf(qty));
                String key = as.getSlotServiceId() != null ? as.getSlotServiceId() : as.getName();
                byKey.putIfAbsent(key, new TenantDebtServiceItemResponse(
                        as.getSlotServiceId(),
                        as.getName() != null ? as.getName() : "Dịch vụ tự chọn",
                        as.getUnit() != null ? as.getUnit() : "tháng",
                        unitPrice,
                        qty,
                        amount,
                        false
                ));
            }
        }

        for (RoomService rs : roomServices) {
            String name = rs.getName() != null ? rs.getName() : "Dịch vụ phòng";
            String calcType = rs.getCalculationType() != null ? rs.getCalculationType().name() : "";
            if (isElectricityOrWater(name, calcType)) continue;
            BigDecimal unitPrice = rs.getUnitPrice() != null ? rs.getUnitPrice() : BigDecimal.ZERO;
            String key = rs.getId() != null ? rs.getId() : name;
            byKey.putIfAbsent(key, new TenantDebtServiceItemResponse(
                    rs.getId(),
                    name,
                    rs.getUnit() != null ? rs.getUnit() : "tháng",
                    unitPrice,
                    1,
                    unitPrice,
                    true
            ));
        }

        // Sample fallback registered services when room/contract has no service records yet
        if (byKey.isEmpty()) {
            byKey.put("sample-wifi", new TenantDebtServiceItemResponse(
                    "sample-wifi",
                    "Internet / Wifi tốc độ cao",
                    "tháng",
                    new BigDecimal("100000"),
                    1,
                    new BigDecimal("100000"),
                    true
            ));
            byKey.put("sample-parking", new TenantDebtServiceItemResponse(
                    "sample-parking",
                    "Gửi xe máy",
                    "xe/tháng",
                    new BigDecimal("120000"),
                    1,
                    new BigDecimal("120000"),
                    false
            ));
            byKey.put("sample-cleaning", new TenantDebtServiceItemResponse(
                    "sample-cleaning",
                    "Vệ sinh & thu gom rác",
                    "tháng",
                    new BigDecimal("50000"),
                    1,
                    new BigDecimal("50000"),
                    true
            ));
        }

        return new ArrayList<>(byKey.values());
    }

    private UtilityBreakdown resolveUnpaidUtility(
            Invoice unpaidInvoice,
            Contract contract,
            Room room,
            BranchResponse branch,
            List<RoomService> roomServices,
            Map<String, List<RoomServiceCharge>> chargesByRoomServiceId
    ) {
        BigDecimal electricity = BigDecimal.ZERO;
        BigDecimal water = BigDecimal.ZERO;

        if (unpaidInvoice != null && unpaidInvoice.getItems() != null) {
            for (InvoiceItem item : unpaidInvoice.getItems()) {
                if (item.getAmount() == null) continue;
                String desc = item.getDescription() != null ? item.getDescription().toLowerCase(Locale.ROOT) : "";
                if (desc.contains("điện") || desc.contains("dien") || desc.contains("electric")) {
                    electricity = electricity.add(item.getAmount());
                } else if (desc.contains("nước") || desc.contains("nuoc") || desc.contains("water")) {
                    water = water.add(item.getAmount());
                }
            }
        }

        if (electricity.compareTo(BigDecimal.ZERO) == 0 && water.compareTo(BigDecimal.ZERO) == 0) {
            for (RoomService rs : roomServices) {
                String name = rs.getName() != null ? rs.getName().toLowerCase(Locale.ROOT) : "";
                List<RoomServiceCharge> charges = chargesByRoomServiceId.getOrDefault(rs.getId(), List.of());
                BigDecimal latestCharge = charges.stream()
                        .filter(c -> c.getTotalAmount() != null && c.getTotalAmount().compareTo(BigDecimal.ZERO) > 0)
                        .map(RoomServiceCharge::getTotalAmount)
                        .findFirst()
                        .orElse(BigDecimal.ZERO);
                if (name.contains("điện") || name.contains("dien") || name.contains("electric")) {
                    electricity = electricity.add(latestCharge);
                } else if (name.contains("nước") || name.contains("nuoc") || name.contains("water")) {
                    water = water.add(latestCharge);
                }
            }
        }

        // Fallback if metered utility items exist in contract services or branch utility rates
        if (electricity.compareTo(BigDecimal.ZERO) == 0 && water.compareTo(BigDecimal.ZERO) == 0 && contract.getServices() != null) {
            for (ContractServiceSnapshot s : contract.getServices()) {
                String n = s.getName() != null ? s.getName().toLowerCase(Locale.ROOT) : "";
                BigDecimal price = s.getUnitPrice() != null ? s.getUnitPrice() : BigDecimal.ZERO;
                int qty = s.getQuantity() != null && s.getQuantity() > 0 ? s.getQuantity() : 1;
                if (n.contains("điện") || n.contains("dien") || n.contains("electric")) {
                    electricity = electricity.add(price.multiply(BigDecimal.valueOf(qty)));
                } else if (n.contains("nước") || n.contains("nuoc") || n.contains("water")) {
                    water = water.add(price.multiply(BigDecimal.valueOf(qty)));
                }
            }
        }

        // Sample fallback utility amounts if no meter reading/invoice item exists yet
        if (electricity.compareTo(BigDecimal.ZERO) == 0 && water.compareTo(BigDecimal.ZERO) == 0) {
            BigDecimal elecRate = branch != null && branch.electricityRate() != null && branch.electricityRate().compareTo(BigDecimal.ZERO) > 0
                    ? branch.electricityRate()
                    : new BigDecimal("3500");
            BigDecimal waterRate = branch != null && branch.waterRate() != null && branch.waterRate().compareTo(BigDecimal.ZERO) > 0
                    ? branch.waterRate()
                    : new BigDecimal("18000");
            int sampleKwh = room.getRoomNumber() != null && room.getRoomNumber().endsWith("3") ? 110 : 85;
            int sampleM3 = room.getRoomNumber() != null && room.getRoomNumber().endsWith("3") ? 6 : 5;
            electricity = elecRate.multiply(BigDecimal.valueOf(sampleKwh));
            water = waterRate.multiply(BigDecimal.valueOf(sampleM3));
        }

        BigDecimal totalUtility = electricity.add(water);
        return new UtilityBreakdown(electricity, water, totalUtility);
    }

    private LocalDate resolveDueDate(Invoice unpaidInvoice, Contract contract, LocalDate today) {
        if (unpaidInvoice != null && unpaidInvoice.getDueDate() != null) {
            return unpaidInvoice.getDueDate();
        }
        int dueDay = contract.getPaymentDueDay() != null && contract.getPaymentDueDay() >= 1 && contract.getPaymentDueDay() <= 31
                ? contract.getPaymentDueDay()
                : 5;
        int clampedThisMonth = Math.min(dueDay, today.lengthOfMonth());
        LocalDate thisMonthDue = LocalDate.of(today.getYear(), today.getMonth(), clampedThisMonth);
        if (today.isAfter(thisMonthDue)) {
            return thisMonthDue;
        }
        LocalDate prevMonth = today.minusMonths(1);
        int clampedPrevMonth = Math.min(dueDay, prevMonth.lengthOfMonth());
        LocalDate prevMonthDue = LocalDate.of(prevMonth.getYear(), prevMonth.getMonth(), clampedPrevMonth);
        if (contract.getStartDate() != null && !contract.getStartDate().isAfter(prevMonthDue)) {
            return prevMonthDue;
        }
        return thisMonthDue;
    }

    private boolean isElectricityOrWater(String name, String calculationType) {
        if ("METERED".equalsIgnoreCase(calculationType)) return true;
        if (name == null) return false;
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.contains("điện") || lower.contains("dien") || lower.contains("electric")
                || lower.contains("nước") || lower.contains("nuoc") || lower.contains("water");
    }

    private boolean matchesKeyword(TenantDebtResponse item, String keyword) {
        if (keyword == null || keyword.isBlank()) return true;
        String q = keyword.trim().toLowerCase(Locale.ROOT);
        return (item.tenantName() != null && item.tenantName().toLowerCase(Locale.ROOT).contains(q))
                || (item.roomNumber() != null && item.roomNumber().toLowerCase(Locale.ROOT).contains(q))
                || (item.tenantPhone() != null && item.tenantPhone().toLowerCase(Locale.ROOT).contains(q))
                || (item.tenantEmail() != null && item.tenantEmail().toLowerCase(Locale.ROOT).contains(q))
                || (item.contractNumber() != null && item.contractNumber().toLowerCase(Locale.ROOT).contains(q));
    }

    private boolean isTenantOnlyCaller(AuthPrincipal principal) {
        if (principal == null || principal.role() == null) return false;
        String role = principal.role().toUpperCase(Locale.ROOT);
        return !"OWNER".equals(role) && !"MANAGER".equals(role) && !"ADMIN".equals(role);
    }

    private Set<String> resolveCallerTenantIds(AuthPrincipal principal, Map<String, Tenant> tenantById) {
        Set<String> ids = new HashSet<>();
        if (principal == null) return ids;
        if (principal.userId() != null) {
            ids.add(principal.userId());
        }
        String email = principal.email() != null ? principal.email().trim().toLowerCase(Locale.ROOT) : "";
        String phone = principal.phone() != null ? principal.phone().trim() : "";
        for (Tenant t : tenantById.values()) {
            if (!email.isEmpty() && t.getEmail() != null && email.equals(t.getEmail().trim().toLowerCase(Locale.ROOT))) {
                ids.add(t.getId());
            }
            if (!phone.isEmpty() && t.getPhone() != null && phone.equals(t.getPhone().trim())) {
                ids.add(t.getId());
            }
        }
        return ids;
    }

    private Map<String, BranchResponse> resolveScopedBranches(String requestedBranchId, AuthPrincipal principal) {
        if (isTenantOnlyCaller(principal)) {
            Map<String, Tenant> tenantById = tenantRepository.findByIsDeletedFalse()
                    .stream()
                    .collect(Collectors.toMap(Tenant::getId, t -> t, (a, b) -> a));
            Set<String> callerTenantIds = resolveCallerTenantIds(principal, tenantById);
            Set<String> branchIds = new HashSet<>();
            for (String tid : callerTenantIds) {
                Tenant t = tenantById.get(tid);
                if (t != null && t.getBranchIds() != null) {
                    branchIds.addAll(t.getBranchIds());
                }
            }
            List<Contract> allActiveContracts = mongoTemplate.find(
                    new Query(Criteria.where("isDeleted").is(false)
                            .and("status").is(ContractStatus.ACTIVE.name())),
                    Contract.class
            );
            Set<String> roomIds = new HashSet<>();
            for (Contract c : allActiveContracts) {
                if (c.getTenantId() != null && callerTenantIds.contains(c.getTenantId()) && c.getRoomId() != null) {
                    roomIds.add(c.getRoomId());
                }
            }
            List<ContractTenant> allActiveCts = mongoTemplate.find(
                    new Query(Criteria.where("isDeleted").is(false)
                            .and("status").is(ContractTenantStatus.ACTIVE.name())
                            .and("tenantId").in(callerTenantIds)),
                    ContractTenant.class
            );
            Set<String> ctContractIds = allActiveCts.stream()
                    .map(ContractTenant::getContractId)
                    .filter(id -> id != null)
                    .collect(Collectors.toSet());
            for (Contract c : allActiveContracts) {
                if (ctContractIds.contains(c.getId()) && c.getRoomId() != null) {
                    roomIds.add(c.getRoomId());
                }
            }
            if (!roomIds.isEmpty()) {
                for (Room r : roomRepository.findAllById(roomIds)) {
                    if (r.getBranchId() != null) {
                        branchIds.add(r.getBranchId());
                    }
                }
            }
            Map<String, BranchResponse> map = new LinkedHashMap<>();
            for (String bid : branchIds) {
                try {
                    BranchResponse b = branchService.getById(bid);
                    if (b != null) map.put(b.id(), b);
                } catch (Exception ignored) {
                }
            }
            return map;
        }
        List<BranchResponse> managed = branchService.managedBranches(principal);
        Map<String, BranchResponse> map = new LinkedHashMap<>();
        for (BranchResponse b : managed) {
            map.put(b.id(), b);
        }
        if (requestedBranchId != null && !requestedBranchId.isBlank()) {
            String trimmed = requestedBranchId.trim();
            if (!map.containsKey(trimmed)) {
                branchService.requireManagementAccess(trimmed, principal);
                BranchResponse single = branchService.getById(trimmed);
                return Map.of(single.id(), single);
            }
            return Map.of(trimmed, map.get(trimmed));
        }
        return map;
    }

    @Override
    public TenantDebtResponse payDebt(String debtId, AuthPrincipal principal) {
        List<TenantDebtResponse> allDebts = listDebts(null, null, false, null, PageRequest.of(0, 500), principal).getContent();
        TenantDebtResponse target = allDebts.stream()
                .filter(d -> debtId.equals(d.id())
                        || debtId.equals(d.contractTenantId())
                        || debtId.equals(d.contractId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khoản công nợ cần thanh toán"));

        List<Invoice> existingInvoices = mongoTemplate.find(
                new Query(Criteria.where("isDeleted").is(false)
                        .and("contractTenantId").is(target.contractTenantId())),
                Invoice.class
        );
        Invoice invoice = existingInvoices.stream()
                .filter(inv -> inv.getStatus() != InvoiceStatus.CANCELLED)
                .max(Comparator.comparing(Invoice::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElseGet(() -> {
                    Invoice created = new Invoice();
                    created.setContractTenantId(target.contractTenantId());
                    created.setInvoiceNumber("INV-" + target.roomNumber() + "-" + target.period());
                    created.setPeriod(target.period());
                    created.setIssueDate(target.dueDate().minusDays(5));
                    created.setDueDate(target.dueDate());
                    return created;
                });

        invoice.setTotalAmount(target.totalAmount());
        invoice.setPaidAmount(target.totalAmount());
        invoice.setRemainingAmount(BigDecimal.ZERO);
        invoice.setStatus(InvoiceStatus.PAID);
        Invoice saved = invoiceRepository.save(invoice);

        return new TenantDebtResponse(
                saved.getId(),
                target.contractId(),
                target.contractNumber(),
                target.contractStatus(),
                target.contractStartDate(),
                target.contractEndDate(),
                target.contractSignedDate(),
                target.contractDepositAmount(),
                target.paymentDueDay(),
                target.joinedAt(),
                target.contractTenantId(),
                target.tenantId(),
                target.tenantName(),
                target.tenantEmail(),
                target.tenantPhone(),
                target.tenantIdNumber(),
                target.tenantGender(),
                target.tenantDateOfBirth(),
                target.tenantAddress(),
                target.branchId(),
                target.branchName(),
                target.roomId(),
                target.roomNumber(),
                target.period(),
                target.dueDate(),
                0L,
                false,
                target.roomRentAmount(),
                target.registeredServices(),
                target.registeredServicesAmount(),
                target.electricityAmount(),
                target.waterAmount(),
                BigDecimal.ZERO,
                target.totalAmount(),
                target.totalAmount(),
                BigDecimal.ZERO,
                "PAID"
        );
    }

    @Override
    public TenantDebtResponse unpayDebt(String debtId, AuthPrincipal principal) {
        List<TenantDebtResponse> allDebts = listDebts(null, null, false, null, PageRequest.of(0, 500), principal).getContent();
        TenantDebtResponse target = allDebts.stream()
                .filter(d -> debtId.equals(d.id())
                        || debtId.equals(d.contractTenantId())
                        || debtId.equals(d.contractId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khoản công nợ"));

        List<Invoice> existingInvoices = mongoTemplate.find(
                new Query(Criteria.where("isDeleted").is(false)
                        .and("contractTenantId").is(target.contractTenantId())),
                Invoice.class
        );
        for (Invoice inv : existingInvoices) {
            inv.setPaidAmount(BigDecimal.ZERO);
            inv.setRemainingAmount(target.totalAmount());
            inv.setStatus(InvoiceStatus.OVERDUE);
            invoiceRepository.save(inv);
        }

        List<TenantDebtResponse> refreshed = listDebts(null, null, false, null, PageRequest.of(0, 500), principal).getContent();
        return refreshed.stream()
                .filter(d -> target.contractTenantId().equals(d.contractTenantId()))
                .findFirst()
                .orElse(target);
    }

    private int compareRoomCode(String a, String b) {
        int i = 0, j = 0;
        while (i < a.length() && j < b.length()) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int startI = i;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                int startJ = j;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                long numA = Long.parseLong(a.substring(startI, i));
                long numB = Long.parseLong(b.substring(startJ, j));
                if (numA != numB) return Long.compare(numA, numB);
            } else {
                int cmp = Character.compare(Character.toLowerCase(ca), Character.toLowerCase(cb));
                if (cmp != 0) return cmp;
                i++;
                j++;
            }
        }
        return Integer.compare(a.length(), b.length());
    }

    private record UtilityBreakdown(
            BigDecimal electricityAmount,
            BigDecimal waterAmount,
            BigDecimal unpaidUtilityAmount
    ) {}

    @Override
    public InvoiceResponse create(InvoiceCreateRequest request) {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public InvoiceResponse getById(String id) {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<InvoiceResponse> search(InvoiceFilterRequest filter, Pageable pageable) {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public InvoiceResponse update(String id, InvoiceUpdateRequest request) {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public List<OverviewInvoice> readForOverview(List<String> ids) {
        if (ids.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractTenantId", ids);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").nin("DRAFT", "CANCELLED"));
        query.fields().include("contractTenantId");
        return mongoTemplate.find(query, Invoice.class).stream()
                .map(item -> new OverviewInvoice(item.getId(), item.getContractTenantId())).toList();
    }

    @Override
    public List<TenantInvoice> readForTenantOverview(List<String> contractTenantIds) {
        if (contractTenantIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractTenantId", contractTenantIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").nin("DRAFT", "CANCELLED"));
        query.fields().include("invoiceNumber", "period", "dueDate", "totalAmount", "remainingAmount", "status");
        return mongoTemplate.find(query, Invoice.class).stream().map(item -> new TenantInvoice(item.getId(),
                item.getInvoiceNumber(), item.getPeriod(), item.getDueDate(), item.getTotalAmount(), item.getRemainingAmount(), item.getStatus())).toList();
    }

    @Override
    public List<DebtInvoice> readDebts(List<String> contractTenantIds) {
        if (contractTenantIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractTenantId", contractTenantIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status")
                .in("ISSUED", "PARTIALLY_PAID", "OVERDUE"));
        query.fields().include("contractTenantId", "invoiceNumber", "period", "dueDate", "totalAmount", "remainingAmount");
        return mongoTemplate.find(query, Invoice.class).stream()
                .filter(item -> item.getRemainingAmount() != null && item.getRemainingAmount().signum() > 0)
                .map(item -> new DebtInvoice(item.getId(), item.getContractTenantId(), item.getInvoiceNumber(),
                        item.getPeriod(), item.getDueDate(), item.getTotalAmount(), item.getRemainingAmount()))
                .toList();
    }

    @Override
    public List<OverviewInvoice> readForReports(List<String> contractTenantIds) {
        if (contractTenantIds.isEmpty()) return List.of();
        var query = MongoQueryHelper.byReferenceIds("contractTenantId", contractTenantIds);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").nin("DRAFT", "CANCELLED"));
        // A partial receipt cannot be split between rent and deposit without allocation data.
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("items.type").ne("DEPOSIT"));
        query.fields().include("contractTenantId");
        return mongoTemplate.find(query, Invoice.class).stream()
                .map(item -> new OverviewInvoice(item.getId(), item.getContractTenantId())).toList();
    }
}
