package com.kitolam.rentalroommanagement.modules.contract.service.support;

import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractTerminationSettlement.ElectricityClosing;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractTerminationSettlement.InvoiceAdjustment;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractTerminationRequest;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.document.ContractTenant;
import com.kitolam.rentalroommanagement.modules.invoice.billing.MonthlyBillCalculator;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceStatus;
import com.kitolam.rentalroommanagement.modules.invoice.repository.InvoiceRepository;
import com.kitolam.rentalroommanagement.modules.invoice.service.impl.InvoiceGenerationService;
import com.kitolam.rentalroommanagement.modules.meterreading.document.RoomMeterReading;
import com.kitolam.rentalroommanagement.modules.meterreading.enums.MeterReadingStatus;
import com.kitolam.rentalroommanagement.modules.meterreading.repository.RoomMeterReadingRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.support.RoomOccupancyCalendar;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ContractTerminationBilling {
    private final RoomMeterReadingRepository readings;
    private final ContractRepository contracts;
    private final RoomOccupancyCalendar calendar;
    private final BranchService branches;
    private final MonthlyBillCalculator calculator;
    private final InvoiceGenerationService invoiceGeneration;
    private final InvoiceRepository invoices;

    public ElectricityClosing closeElectricity(Room room, LocalDate today, ContractTerminationRequest request) {
        YearMonth month = YearMonth.from(today);
        String period = month.toString();
        List<Contract> occupants = contracts.findByRoomIdInAndIsDeletedFalse(List.of(room.getId())).stream()
                .filter(c -> calendar.covers(c, month) && !c.getStartDate().isAfter(today)).toList();
        var priorClosings = occupants.stream().map(Contract::getTerminationSettlement).filter(Objects::nonNull)
                .filter(s -> YearMonth.from(s.lastRentalDate()).equals(month))
                .sorted(Comparator.comparing(s -> s.terminatedAt())).toList();
        RoomMeterReading monthly = readings.findByRoomIdAndPeriodAndIsDeletedFalse(room.getId(), period).orElse(null);
        BigDecimal start = monthly == null ? null : monthly.getStartReading();
        if (start == null) start = readings.findFirstByRoomIdAndPeriodLessThanAndIsDeletedFalseOrderByPeriodDesc(room.getId(), period)
                .filter(reading -> reading.getStatus() == MeterReadingStatus.CONFIRMED)
                .map(RoomMeterReading::getEndReading).orElse(null);
        if (start == null && !priorClosings.isEmpty()) start = priorClosings.getFirst().electricity().startReading();
        if (start != null && request.electricityStartReading() != null && start.compareTo(request.electricityStartReading()) != 0)
            throw new BadRequestException("Chỉ số đầu kỳ đã có trên hệ thống. Vui lòng để trống hoặc nhập đúng chỉ số đó.");
        if (start == null) start = request.electricityStartReading();
        BigDecimal end = request.electricityEndReading();
        if (start == null || end.compareTo(start) < 0)
            throw new BadRequestException("Cần chỉ số đầu kỳ và chỉ số ngày hủy không được nhỏ hơn chỉ số đầu kỳ.");
        if (monthly != null && monthly.getStatus() == MeterReadingStatus.CONFIRMED
                && monthly.getEndReading() != null && end.compareTo(monthly.getEndReading()) > 0)
            throw new ConflictException("Chỉ số ngày hủy vượt chỉ số đã chốt của tháng. Vui lòng kiểm tra lại sổ điện.");
        BigDecimal rate = monthly == null ? null : monthly.getUnitPrice();
        if (rate == null && !priorClosings.isEmpty()) rate = priorClosings.getFirst().electricity().unitPrice();
        if (rate == null) rate = branches.getById(room.getBranchId()).electricityRate();
        if (rate == null) throw new BadRequestException("Chi nhánh chưa cấu hình giá điện.");

        long shares = Math.max(1, occupants.size() - priorClosings.size());
        // Each reading closes a usage segment with the share count recorded at that checkpoint.
        BigDecimal previous = start;
        BigDecimal amount = BigDecimal.ZERO;
        for (var prior : priorClosings) {
            BigDecimal checkpoint = prior.electricity().endReading();
            if (checkpoint.compareTo(previous) < 0 || checkpoint.compareTo(end) > 0
                    || start.compareTo(prior.electricity().startReading()) != 0 || rate.compareTo(prior.electricity().unitPrice()) != 0)
                throw new ConflictException("Chỉ số hoặc đơn giá điện không khớp với lần chốt trước của phòng trong tháng.");
            amount = amount.add(electricityShare(checkpoint.subtract(previous), rate, prior.electricity().remainingShares()));
            previous = checkpoint;
        }
        amount = amount.add(electricityShare(end.subtract(previous), rate, shares));
        return new ElectricityClosing(start, end, rate, shares, amount);
    }

    private BigDecimal electricityShare(BigDecimal usage, BigDecimal rate, long shares) {
        return usage.multiply(rate).divide(BigDecimal.valueOf(shares), 0, RoundingMode.HALF_UP);
    }

    public List<InvoiceAdjustment> settle(Contract contract, Room room, ContractTenant tenant, LocalDate today) {
        YearMonth period = YearMonth.from(today);
        List<Invoice> existing = invoices.findByContractIdInAndIsDeletedFalse(List.of(contract.getId()));
        var bill = calculator.compute(List.of(room), period).stream()
                .filter(item -> contract.getId().equals(item.contract().getId())).findFirst()
                .orElseThrow(() -> new ConflictException("Không tính được hóa đơn tháng hủy hợp đồng."));
        List<InvoiceAdjustment> adjustments = new ArrayList<>();
        boolean currentFound = false;
        for (Invoice invoice : existing) {
            YearMonth invoicePeriod = YearMonth.parse(invoice.getPeriod());
            BigDecimal previous = zeroIfNull(invoice.getTotalAmount());
            if (invoicePeriod.equals(period)) {
                currentFound = true;
                invoice.setItems(bill.items());
                invoice.setTotalAmount(bill.total().subtract(zeroIfNull(invoice.getDiscountAmount())).max(BigDecimal.ZERO));
                updateBalance(invoice, today);
                invoices.save(invoice);
            } else if (invoicePeriod.isAfter(period)) {
                invoice.setStatus(InvoiceStatus.CANCELLED);
                invoice.setItems(List.of());
                invoice.setDiscountAmount(BigDecimal.ZERO);
                invoice.setTotalAmount(BigDecimal.ZERO);
                invoice.setRemainingAmount(BigDecimal.ZERO);
                invoices.save(invoice);
            } else if (invoice.getStatus() == InvoiceStatus.CANCELLED || zeroIfNull(invoice.getRemainingAmount()).signum() == 0) {
                continue;
            }
            adjustments.add(adjustment(invoice, previous));
        }
        if (!currentFound) {
            Invoice created = invoices.insert(invoiceGeneration.toInvoice(bill, period.toString(), tenant, today));
            adjustments.add(adjustment(created, BigDecimal.ZERO));
        }
        return adjustments;
    }

    private void updateBalance(Invoice invoice, LocalDate today) {
        BigDecimal paid = zeroIfNull(invoice.getPaidAmount());
        BigDecimal outstanding = invoice.getTotalAmount().subtract(paid).max(BigDecimal.ZERO);
        invoice.setRemainingAmount(outstanding);
        if (outstanding.signum() == 0) invoice.setStatus(InvoiceStatus.PAID);
        else if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(today)) invoice.setStatus(InvoiceStatus.OVERDUE);
        else invoice.setStatus(paid.signum() > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.ISSUED);
    }

    private InvoiceAdjustment adjustment(Invoice invoice, BigDecimal previous) {
        BigDecimal paid = zeroIfNull(invoice.getPaidAmount());
        BigDecimal total = zeroIfNull(invoice.getTotalAmount());
        return new InvoiceAdjustment(invoice.getId(), invoice.getPeriod(), previous, total, paid,
                zeroIfNull(invoice.getRemainingAmount()), paid.subtract(total).max(BigDecimal.ZERO), invoice.getItems());
    }

    private static BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
