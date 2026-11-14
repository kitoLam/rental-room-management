package com.kitolam.rentalroommanagement.modules.invoice.service.impl;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.support.StaffAccess;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.invoice.billing.MonthlyBillCalculator;
import com.kitolam.rentalroommanagement.modules.invoice.billing.MonthlyBillCalculator.SlotBill;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceConfirmResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceEstimateResponse;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceEstimateResponse.RoomEstimate;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceEstimateResponse.SlotEstimate;
import com.kitolam.rentalroommanagement.modules.invoice.dto.response.InvoiceResponse;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.support.InvoiceMapper;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Turns {@link MonthlyBillCalculator} results into invoices. One invoice per contract (= slot) and
 * period: a slot invoiced by staff from the estimate page is skipped by the monthly job.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceGenerationService {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int DEFAULT_DUE_DAY = 10;

    private final MonthlyBillCalculator calculator;
    private final InvoiceRepository invoiceRepository;
    private final ContractTenantRepository contractTenantRepository;
    private final RoomRepository roomRepository;
    private final StaffAccess staffAccess;
    private final Clock clock;

    /** Preview of a month for slots with no invoice yet; nothing is saved. */
    public InvoiceEstimateResponse estimate(String branchId, String period, AuthPrincipal principal) {
        staffAccess.requireBranch(branchId, principal);
        YearMonth month = requireBillable(period);
        List<SlotBill> all = calculator.compute(branchId, month);
        Set<String> invoiced = invoicedContractIds(all, period);
        List<SlotBill> pending = all.stream().filter(b -> !invoiced.contains(b.contract().getId())).toList();

        Map<String, List<SlotBill>> byRoom = new LinkedHashMap<>();
        for (SlotBill bill : pending) byRoom.computeIfAbsent(bill.room().getId(), k -> new ArrayList<>()).add(bill);
        List<RoomEstimate> rooms = byRoom.values().stream().map(bills -> {
            Room room = bills.getFirst().room();
            return new RoomEstimate(room.getId(), room.getRoomNumber(), room.getTitle(), bills.getFirst().occupants(),
                    sum(bills), bills.stream().map(this::toEstimate).toList());
        }).toList();
        return new InvoiceEstimateResponse(branchId, period, currentMonth().toString(), invoiced.size(), sum(pending), rooms);
    }

    /** Staff confirmation from the estimate page; contractIds empty = every pending slot of the branch. */
    public InvoiceConfirmResponse confirm(String branchId, String period, List<String> contractIds, AuthPrincipal principal) {
        staffAccess.requireBranch(branchId, principal);
        YearMonth month = requireBillable(period);
        List<SlotBill> bills = calculator.compute(branchId, month);
        if (contractIds != null && !contractIds.isEmpty()) {
            Set<String> wanted = Set.copyOf(contractIds);
            bills = bills.stream().filter(b -> wanted.contains(b.contract().getId())).toList();
        }
        Result result = create(bills, period);
        if (contractIds != null) {
            Set<String> done = result.created().stream().map(InvoiceResponse::contractId).collect(Collectors.toSet());
            contractIds.stream().filter(id -> !done.contains(id) && !result.skipped().contains(id)).forEach(result.skipped()::add);
        }
        return new InvoiceConfirmResponse(result.created(), result.skipped());
    }

    /** Monthly job: invoices every slot of every branch for the month, except the ones already invoiced. */
    public int generateAll(YearMonth month) {
        Map<String, List<Room>> byBranch = roomRepository.findAll().stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsDeleted()) && r.getBranchId() != null)
                .collect(Collectors.groupingBy(Room::getBranchId));
        int created = 0;
        for (Map.Entry<String, List<Room>> entry : byBranch.entrySet()) {
            try {
                created += create(calculator.compute(entry.getValue(), month), month.toString()).created().size();
            } catch (RuntimeException e) {
                log.error("Monthly invoices of branch {} for {} failed", entry.getKey(), month, e);
            }
        }
        return created;
    }

    private Result create(List<SlotBill> bills, String period) {
        Set<String> invoiced = invoicedContractIds(bills, period);
        Map<String, ContractTenant> representatives = representatives(bills);
        LocalDate today = LocalDate.now(clock.withZone(VIETNAM));
        List<InvoiceResponse> created = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (SlotBill bill : bills) {
            Contract contract = bill.contract();
            if (invoiced.contains(contract.getId())) {
                skipped.add(contract.getId());
                continue;
            }
            try {
                created.add(InvoiceMapper.toResponse(invoiceRepository.save(
                        toInvoice(bill, period, representatives.get(contract.getId()), today))));
            } catch (DuplicateKeyException e) {
                skipped.add(contract.getId()); // created concurrently (job vs staff)
            }
        }
        return new Result(created, skipped);
    }

    public Invoice toInvoice(SlotBill bill, String period, ContractTenant representative, LocalDate today) {
        Contract contract = bill.contract();
        Invoice invoice = new Invoice();
        invoice.setContractId(contract.getId());
        invoice.setTenantId(contract.getTenantId() != null ? contract.getTenantId()
                : representative == null ? null : representative.getTenantId());
        invoice.setBranchId(bill.room().getBranchId());
        invoice.setRoomId(bill.room().getId());
        invoice.setRoomNumber(bill.room().getRoomNumber());
        invoice.setRoomSlotId(bill.roomSlotId());
        invoice.setSlotCode(bill.slotCode());
        invoice.setTenantName(contract.getTenantName());
        invoice.setContractNumber(contract.getContractNumber());
        invoice.setInvoiceNumber("INV-" + period.replace("-", "") + "-"
                + (contract.getContractNumber() != null ? contract.getContractNumber() : contract.getId().substring(18)));
        invoice.setPeriod(period);
        invoice.setIssueDate(today);
        invoice.setDueDate(dueDate(contract, YearMonth.parse(period), today));
        invoice.setItems(bill.items());
        invoice.setTotalAmount(bill.total());
        invoice.setPaidAmount(BigDecimal.ZERO);
        invoice.setRemainingAmount(bill.total());
        invoice.setStatus(bill.total().signum() > 0 ? InvoiceStatus.ISSUED : InvoiceStatus.PAID);
        return invoice;
    }

    /** paymentDueDay (default 10) of the month after the period, never before the issue date. */
    private LocalDate dueDate(Contract contract, YearMonth period, LocalDate today) {
        YearMonth next = period.plusMonths(1);
        int day = contract.getPaymentDueDay() == null ? DEFAULT_DUE_DAY : contract.getPaymentDueDay();
        LocalDate due = next.atDay(Math.max(1, Math.min(day, next.lengthOfMonth())));
        return due.isBefore(today) ? today.plusDays(7) : due;
    }

    private Map<String, ContractTenant> representatives(List<SlotBill> bills) {
        List<String> ids = bills.stream().map(b -> b.contract().getId()).toList();
        if (ids.isEmpty()) return Map.of();
        return contractTenantRepository.findByContractIdInAndIsDeletedFalse(ids).stream()
                .sorted(Comparator.comparing((ContractTenant ct) -> !Boolean.TRUE.equals(ct.getIsRepresentative())))
                .collect(Collectors.toMap(ContractTenant::getContractId, ct -> ct, (a, b) -> a));
    }

    private Set<String> invoicedContractIds(List<SlotBill> bills, String period) {
        List<String> ids = bills.stream().map(b -> b.contract().getId()).toList();
        if (ids.isEmpty()) return Set.of();
        return invoiceRepository.findByContractIdInAndPeriodAndIsDeletedFalse(ids, period).stream()
                .map(Invoice::getContractId).collect(Collectors.toSet());
    }

    private SlotEstimate toEstimate(SlotBill b) {
        Contract c = b.contract();
        return new SlotEstimate(c.getId(), c.getContractNumber(), b.roomSlotId(), b.slotCode(), c.getTenantName(),
                b.stayFrom(), b.stayTo(), b.amountOf(InvoiceItemType.ROOM_RENT), b.amountOf(InvoiceItemType.ROOM_SERVICE),
                b.amountOf(InvoiceItemType.PERSONAL_SERVICE), b.amountOf(InvoiceItemType.ELECTRICITY),
                b.amountOf(InvoiceItemType.SLOT_SERVICE), b.total(),
                b.electricityUnchanged(), b.warnings(), InvoiceMapper.items(b.items()));
    }

    private YearMonth requireBillable(String period) {
        YearMonth month = YearMonth.parse(period);
        if (month.isAfter(currentMonth())) throw new BadRequestException("Không lập hoá đơn cho tháng chưa tới");
        return month;
    }

    private YearMonth currentMonth() {
        return YearMonth.now(clock.withZone(VIETNAM));
    }

    private static BigDecimal sum(List<SlotBill> bills) {
        return bills.stream().map(SlotBill::total).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private record Result(List<InvoiceResponse> created, List<String> skipped) {
    }
}
