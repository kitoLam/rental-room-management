package com.kitolam.rentalroommanagement.modules.invoice.billing;

import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput.Holding;
import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput.RoomServiceLine;
import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput.SlotServiceLine;
import com.kitolam.rentalroommanagement.modules.invoice.document.Invoice;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import org.bson.types.ObjectId;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Pure monthly billing rules (no database access).
 * <ul>
 *   <li>ROOM_RENT: contract.rentPrice × billed days / days in month (billed days start at firstBillingStartDate).</li>
 *   <li>Everything else follows the days the tenant actually lives there (the holdings).</li>
 *   <li>SLOT_SERVICE: unitPrice × quantity, × days / days in month when prorated BY_DAY.</li>
 *   <li>ROOM_SERVICE: room amount split between the contracts living in the room by slot-days.
 *       METERED uses the confirmed reading, FIXED the monthly price, PER_SLOT/PER_PERSON is
 *       charged per slot held by the contract (no split).</li>
 * </ul>
 * Money is whole VND, rounded half-up per item. Item toDate is the last day included.
 */
public final class InvoiceCalculator {

    private InvoiceCalculator() {
    }

    /** Generated items (ROOM_RENT, SLOT_SERVICE, ROOM_SERVICE) of one contract. */
    public static List<InvoiceItem> calculate(ContractBillingInput input, BillingPeriod period) {
        List<InvoiceItem> items = new ArrayList<>();
        BigDecimal daysInPeriod = BigDecimal.valueOf(period.days());

        // 1. Rent of the whole contract, from firstBillingStartDate on
        DateRange window = input.billingWindow();
        if (!window.isEmpty()) {
            BigDecimal rentDays = BigDecimal.valueOf(window.days());
            items.add(item(InvoiceItemType.ROOM_RENT, "Tiền phòng " + period.label(), window,
                    rentDays, input.rentPrice(), prorate(input.rentPrice(), rentDays, daysInPeriod)));
        }

        // 2. Services of each slot held
        for (Holding holding : input.holdings()) {
            for (SlotServiceLine service : input.slotServices()) {
                if (!service.roomSlotId().equals(holding.roomSlotId())) continue;
                DateRange used = service.active().intersect(holding.range());
                if (used.isEmpty()) continue;
                BigDecimal monthly = service.unitPrice().multiply(BigDecimal.valueOf(service.quantity()));
                BigDecimal amount = service.prorateByDay()
                        ? prorate(monthly, BigDecimal.valueOf(used.days()), daysInPeriod)
                        : round(monthly);
                InvoiceItem item = item(InvoiceItemType.SLOT_SERVICE,
                        service.serviceName() + " - Chỗ " + holding.slotCode() + " (Phòng " + holding.roomNumber() + ")",
                        used, BigDecimal.valueOf(service.quantity()), service.unitPrice(), amount);
                item.setRoomId(holding.roomId());
                item.setRoomSlotId(holding.roomSlotId());
                item.setSlotServiceId(service.slotServiceId());
                items.add(item);
            }
        }

        // 3. Services of each room the contract lives in
        Set<String> roomIds = new LinkedHashSet<>();
        input.holdings().forEach(h -> roomIds.add(h.roomId()));
        List<String> missing = new ArrayList<>();
        for (RoomServiceLine service : input.roomServices()) {
            if (!roomIds.contains(service.roomId())) continue;
            DateRange active = service.active().intersect(period.range());
            if (active.isEmpty()) continue;
            String label = service.serviceName() + " " + period.label() + " - Phòng " + service.roomNumber();

            if (service.calculationType() == CalculationType.PER_SLOT || service.calculationType() == CalculationType.PER_PERSON) {
                long slotDays = slotDays(input.holdings(), service.roomId(), active);
                if (slotDays == 0) continue;
                InvoiceItem item = item(InvoiceItemType.ROOM_SERVICE, label, active, BigDecimal.valueOf(slotDays),
                        service.unitPrice(), prorate(service.unitPrice(), BigDecimal.valueOf(slotDays), daysInPeriod));
                items.add(withRoomService(item, service));
                continue;
            }

            BigDecimal roomAmount;
            if (service.calculationType() == CalculationType.METERED) {
                if (service.chargeId() == null) {
                    missing.add(service.serviceName() + " phòng " + service.roomNumber());
                    continue;
                }
                roomAmount = service.chargeAmount();
            } else {
                roomAmount = prorate(service.unitPrice(), BigDecimal.valueOf(active.days()), daysInPeriod);
            }
            Map<String, Long> weights = input.roomSlotDays().getOrDefault(service.roomId(), Map.of());
            Long own = weights.get(input.contractId());
            if (own == null || own == 0) continue;
            long totalSlotDays = weights.values().stream().mapToLong(Long::longValue).sum();
            BigDecimal share = allocate(roomAmount, weights).get(input.contractId());
            InvoiceItem item = item(InvoiceItemType.ROOM_SERVICE,
                    label + " (" + own + "/" + totalSlotDays + " slot-ngày)", period.range(),
                    BigDecimal.ONE, share, share);
            item.setRoomServiceChargeId(service.chargeId());
            items.add(withRoomService(item, service));
        }
        if (!missing.isEmpty()) {
            throw new MissingMeterReadingException(missing);
        }
        return items;
    }

    /**
     * Splits {@code amount} by weight. Keys are processed in sorted order and the last one takes the
     * rounding remainder, so every contract computes the same split and the parts add up exactly.
     */
    public static Map<String, BigDecimal> allocate(BigDecimal amount, Map<String, Long> weights) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        TreeMap<String, Long> sorted = new TreeMap<>(weights);
        sorted.values().removeIf(w -> w == null || w <= 0);
        long total = sorted.values().stream().mapToLong(Long::longValue).sum();
        if (total == 0) return result;
        BigDecimal allocated = BigDecimal.ZERO;
        String last = sorted.lastKey();
        for (Map.Entry<String, Long> entry : sorted.entrySet()) {
            BigDecimal part = entry.getKey().equals(last)
                    ? amount.subtract(allocated)
                    : round(amount.multiply(BigDecimal.valueOf(entry.getValue()))
                            .divide(BigDecimal.valueOf(total), 10, RoundingMode.HALF_UP));
            result.put(entry.getKey(), part);
            allocated = allocated.add(part);
        }
        return result;
    }

    /** Recomputes discountAmount, totalAmount and remainingAmount from the items. */
    public static void applyTotals(Invoice invoice) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;
        for (InvoiceItem item : invoice.getItems()) {
            total = total.add(item.getAmount());
            if (item.getType() == InvoiceItemType.DISCOUNT) discount = discount.add(item.getAmount().negate());
        }
        if (total.signum() < 0) total = BigDecimal.ZERO;
        BigDecimal paid = invoice.getPaidAmount() == null ? BigDecimal.ZERO : invoice.getPaidAmount();
        invoice.setPreviousDebt(BigDecimal.ZERO);
        invoice.setDiscountAmount(discount);
        invoice.setTotalAmount(total);
        invoice.setRemainingAmount(total.subtract(paid).max(BigDecimal.ZERO));
    }

    private static long slotDays(List<Holding> holdings, String roomId, DateRange within) {
        return holdings.stream()
                .filter(h -> h.roomId().equals(roomId))
                .mapToLong(h -> h.range().intersect(within).days())
                .sum();
    }

    private static InvoiceItem withRoomService(InvoiceItem item, RoomServiceLine service) {
        item.setRoomId(service.roomId());
        item.setRoomServiceId(service.roomServiceId());
        return item;
    }

    private static InvoiceItem item(InvoiceItemType type, String description, DateRange range,
                                    BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount) {
        InvoiceItem item = new InvoiceItem();
        item.setId(new ObjectId().toHexString());
        item.setType(type);
        item.setDescription(description);
        item.setFromDate(range.from());
        item.setToDate(range.lastDay());
        item.setQuantity(quantity);
        item.setUnitPrice(unitPrice);
        item.setAmount(amount);
        return item;
    }

    private static BigDecimal prorate(BigDecimal monthly, BigDecimal days, BigDecimal daysInPeriod) {
        return round(monthly.multiply(days).divide(daysInPeriod, 10, RoundingMode.HALF_UP));
    }

    private static BigDecimal round(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP);
    }
}
