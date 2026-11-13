package com.kitolam.rentalroommanagement.modules.dashboard.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService.ReportContract;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.request.ManagementReportRequest;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementReportResponse;
import com.kitolam.rentalroommanagement.modules.dashboard.dto.response.ManagementReportResponse.*;
import com.kitolam.rentalroommanagement.modules.dashboard.service.ManagementReportService;
import com.kitolam.rentalroommanagement.modules.invoice.service.InvoiceService;
import com.kitolam.rentalroommanagement.modules.payment.service.PaymentService;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/** Read-only reporting. Scope is resolved before loading any room, lease or receipt data. */
@Service
@RequiredArgsConstructor
public class ManagementReportServiceImpl implements ManagementReportService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int PAGE_SIZE = 10;
    private final BranchService branches;
    private final RoomService rooms;
    private final ContractService contracts;
    private final InvoiceService invoices;
    private final PaymentService payments;
    private final Clock clock;

    @Override
    public ManagementReportResponse report(AuthPrincipal principal, ManagementReportRequest request) {
        if (principal == null || !principal.enabled() || !Set.of("OWNER", "MANAGER").contains(principal.role()))
            throw new ForbiddenException("Chỉ Owner/Manager được xem báo cáo quản lý");
        if (request.getPage() < 0 || request.getPage() > 10000
                || !Set.of("receipts", "leases", "roomNumber").contains(Objects.toString(request.getSort(), "")))
            throw new BadRequestException("Trang hoặc cách sắp xếp báo cáo không hợp lệ");
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, ZONE);
        YearMonth from = month(request.getFromMonth(), YearMonth.of(today.getYear(), 1));
        YearMonth to = month(request.getToMonth(), YearMonth.of(today.getYear(), 12));
        long monthCount = ChronoUnit.MONTHS.between(from, to) + 1;
        if (from.getYear() < 1901 || to.getYear() > 9998 || monthCount < 1 || monthCount > 12)
            throw new BadRequestException("Kỳ báo cáo phải từ 1 đến 12 tháng liên tiếp, năm từ 1901 đến 9998");

        var allowed = branches.managedBranches(principal);
        if (request.getBranchId() != null && allowed.stream().noneMatch(b -> b.id().equals(request.getBranchId())))
            throw new ForbiddenException("Bạn không có quyền xem chi nhánh này");
        var selectedBranches = allowed.stream()
                .filter(b -> request.getBranchId() == null || b.id().equals(request.getBranchId())).toList();
        var branchById = selectedBranches.stream().collect(Collectors.toMap(BranchResponse::id, Function.identity()));
        var availableRooms = new ArrayList<RoomResponse>();
        for (var branch : selectedBranches) {
            for (int page = 0; ; page++) {
                var result = rooms.listByBranch(branch.id(), PageRequest.of(page, 100, Sort.by("_id")));
                availableRooms.addAll(result.getContent());
                if (page + 1 >= result.getTotalPages()) break;
            }
        }
        if (request.getRoomId() != null && availableRooms.stream().noneMatch(r -> r.id().equals(request.getRoomId())))
            throw new ForbiddenException("Phòng không thuộc phạm vi báo cáo đã chọn");
        var selectedRooms = availableRooms.stream()
                .filter(r -> request.getRoomId() == null || r.id().equals(request.getRoomId())).toList();
        var roomById = selectedRooms.stream().collect(Collectors.toMap(RoomResponse::id, Function.identity()));
        var roomIds = new ArrayList<>(roomById.keySet());
        var contractById = contracts.readForReports(roomIds).stream().filter(c -> roomById.containsKey(c.roomId()))
                .collect(Collectors.toMap(ReportContract::id, Function.identity()));
        var invoiceRoom = new HashMap<String, String>();
        for (var invoice : invoices.readForReports(new ArrayList<>(contractById.keySet()))) {
            var contract = contractById.get(invoice.contractId());
            String roomId = contract == null ? null : contract.roomId();
            if (roomId != null) invoiceRoom.put(invoice.id(), roomId);
        }

        var months = new ArrayList<YearMonth>();
        for (var month = from; !month.isAfter(to); month = month.plusMonths(1)) months.add(month);
        var totals = new HashMap<String, RoomTotals>();
        selectedRooms.forEach(room -> totals.put(room.id(), new RoomTotals()));
        BigDecimal previousReceipts = BigDecimal.ZERO;
        var previousFrom = from.minusMonths(monthCount);
        var queryEnd = to.plusMonths(1).atDay(1).atStartOfDay(ZONE).toInstant();
        if (queryEnd.isAfter(now)) queryEnd = now.plusNanos(1);
        var queryStart = previousFrom.atDay(1).atStartOfDay(ZONE).toInstant();
        for (var payment : payments.readForReports(new ArrayList<>(invoiceRoom.keySet()), queryStart, queryEnd)) {
            String roomId = invoiceRoom.get(payment.invoiceId());
            if (roomId == null || payment.paidAt() == null || payment.paidAt().isAfter(now)
                    || payment.amount() == null || payment.amount().signum() <= 0) continue;
            var paidMonth = YearMonth.from(LocalDate.ofInstant(payment.paidAt(), ZONE));
            if (!paidMonth.isBefore(from) && !paidMonth.isAfter(to))
                totals.get(roomId).receipts.merge(paidMonth, payment.amount(), BigDecimal::add);
            else if (!paidMonth.isBefore(previousFrom) && paidMonth.isBefore(from))
                previousReceipts = previousReceipts.add(payment.amount());
        }
        var leasesByMonth = new HashMap<YearMonth, Long>();
        for (var contract : contractById.values()) {
            if (!effectiveLease(contract, today)) continue;
            var start = YearMonth.from(contract.startDate());
            if (start.isBefore(from) || start.isAfter(to)) continue;
            var room = totals.get(contract.roomId());
            room.leases++;
            long slotCount = contract.roomSlotIds() == null ? 0
                    : contract.roomSlotIds().stream().filter(Objects::nonNull).distinct().count();
            room.leasedSlots += slotCount;
            if (slotCount == 0) room.unknownSlots++;
            leasesByMonth.merge(start, 1L, Long::sum);
        }
        BigDecimal totalReceipts = totals.values().stream().map(RoomTotals::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        var rows = selectedRooms.stream().map(room -> {
            var stats = totals.get(room.id());
            BigDecimal amount = stats.total();
            BigDecimal share = totalReceipts.signum() == 0 ? BigDecimal.ZERO
                    : amount.multiply(BigDecimal.valueOf(100)).divide(totalReceipts, 2, RoundingMode.HALF_UP);
            return new RoomRow(room.id(), room.roomNumber(), room.branchId(), branchById.get(room.branchId()).name(),
                    amount, share, stats.leases, stats.leasedSlots, stats.unknownSlots,
                    months.stream().map(m -> stats.receipts.getOrDefault(m, BigDecimal.ZERO)).toList());
        }).toList();
        Comparator<RoomRow> byName = Comparator.comparing(RoomRow::roomNumber, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparing(RoomRow::id);
        var byReceipts = Comparator.comparing(RoomRow::receipts).reversed().thenComparing(byName);
        var byLeases = Comparator.comparingLong(RoomRow::newLeases).reversed()
                .thenComparing(Comparator.comparingLong(RoomRow::leasedSlots).reversed()).thenComparing(byName);
        var ordered = rows.stream().sorted(switch (request.getSort()) {
            case "leases" -> byLeases;
            case "roomNumber" -> byName;
            default -> byReceipts;
        }).toList();
        var series = months.stream().map(m -> new MonthlyRow(m.toString(), totals.values().stream()
                .map(t -> t.receipts.getOrDefault(m, BigDecimal.ZERO)).reduce(BigDecimal.ZERO, BigDecimal::add),
                leasesByMonth.getOrDefault(m, 0L))).toList();
        var branchRows = new ArrayList<BranchRow>();
        if ("OWNER".equals(principal.role())) {
            for (var branch : selectedBranches) {
                var scoped = rows.stream().filter(r -> r.branchId().equals(branch.id())).toList();
                // With a room filter, comparison only includes the branch containing that room.
                if (request.getRoomId() != null && scoped.isEmpty()) continue;
                branchRows.add(new BranchRow(branch.id(), branch.name(), scoped.size(),
                        scoped.stream().map(RoomRow::receipts).reduce(BigDecimal.ZERO, BigDecimal::add),
                        scoped.stream().mapToLong(RoomRow::newLeases).sum(), scoped.stream().mapToLong(RoomRow::leasedSlots).sum(),
                        scoped.stream().mapToLong(RoomRow::unknownSlotContracts).sum()));
            }
            branchRows.sort(Comparator.comparing(BranchRow::receipts).reversed().thenComparing(BranchRow::id));
        }
        return new ManagementReportResponse(from.toString(), to.toString(), now,
                allowed.stream().map(b -> new BranchOption(b.id(), b.name())).toList(),
                availableRooms.stream().sorted(Comparator.comparing(RoomResponse::roomNumber,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)).thenComparing(RoomResponse::id))
                        .map(r -> new RoomOption(r.id(), r.branchId(), r.roomNumber())).toList(),
                new Metrics(totalReceipts, previousReceipts, rows.stream().mapToLong(RoomRow::newLeases).sum(),
                        rows.stream().mapToLong(RoomRow::leasedSlots).sum(), rows.stream().mapToLong(RoomRow::unknownSlotContracts).sum()),
                series, rows.stream().filter(r -> r.receipts().signum() > 0).sorted(byReceipts).limit(5).toList(),
                rows.stream().filter(r -> r.newLeases() > 0).sorted(byLeases).limit(5).toList(),
                PagedResponse.of(ordered.stream().skip((long) request.getPage() * PAGE_SIZE).limit(PAGE_SIZE).toList(),
                        request.getPage() + 1, PAGE_SIZE, rows.size()), branchRows);
    }

    private YearMonth month(String value, YearMonth fallback) {
        if (value == null) return fallback;
        try { return YearMonth.parse(value); }
        catch (DateTimeParseException exception) { throw new BadRequestException("Tháng phải có định dạng yyyy-MM"); }
    }

    private boolean effectiveLease(ReportContract contract, LocalDate today) {
        if (contract.startDate() == null || contract.startDate().isAfter(today) || contract.endDate() == null
                || contract.endDate().isBefore(contract.startDate())) return false;
        if (contract.status() == ContractStatus.ACTIVE || contract.status() == ContractStatus.EXPIRED) return true;
        return contract.status() == ContractStatus.TERMINATED && contract.terminatedAt() != null
                && !LocalDate.ofInstant(contract.terminatedAt(), ZONE).isBefore(contract.startDate());
    }

    private static class RoomTotals {
        private final Map<YearMonth, BigDecimal> receipts = new HashMap<>();
        private long leases;
        private long leasedSlots;
        private long unknownSlots;
        BigDecimal total() { return receipts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add); }
    }
}
