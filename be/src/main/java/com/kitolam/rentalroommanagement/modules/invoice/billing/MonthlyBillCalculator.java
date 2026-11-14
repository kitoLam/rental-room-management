package com.kitolam.rentalroommanagement.modules.invoice.billing;

import com.kitolam.rentalroommanagement.modules.contract.document.ActiveSlotService;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractTerminationSettlement;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractTerminationSettlement.ElectricityClosing;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.invoice.document.InvoiceItem;
import com.kitolam.rentalroommanagement.modules.invoice.enums.InvoiceItemType;
import com.kitolam.rentalroommanagement.modules.meterreading.document.RoomMeterReading;
import com.kitolam.rentalroommanagement.modules.meterreading.repository.RoomMeterReadingRepository;
import com.kitolam.rentalroommanagement.modules.meterreading.support.RoomOccupancyCalendar;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.enums.RoomServiceStatus;
import com.kitolam.rentalroommanagement.modules.roomservice.repository.RoomServiceRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Computes the monthly bill of every contract (= slot) of a branch from 4 fees:
 * <ol>
 *   <li>rent, prorated by the days actually lived in the month;</li>
 *   <li>room services, the room's monthly price split by the number of occupants of the month;</li>
 *   <li>room electricity (meter reading), split the same way;</li>
 *   <li>slot services: every registration that touched the month counts in full.</li>
 * </ol>
 * "Occupants of the month" = contracts of the room whose stay overlaps the month, even partially.
 * Pure read: nothing is saved here.
 */
@Component
@RequiredArgsConstructor
public class MonthlyBillCalculator {

    private final RoomRepository roomRepository;
    private final ContractRepository contractRepository;
    private final RoomServiceRepository roomServiceRepository;
    private final RoomMeterReadingRepository meterReadingRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final RoomOccupancyCalendar occupancy;

    /** Bills of one branch for one month, sorted by room then slot. */
    public List<SlotBill> compute(String branchId, YearMonth month) {
        return compute(roomRepository.findByBranchIdAndIsDeletedFalse(branchId), month);
    }

    public List<SlotBill> compute(Collection<Room> roomList, YearMonth month) {
        if (roomList.isEmpty()) return List.of();
        Map<String, Room> rooms = roomList.stream().collect(Collectors.toMap(Room::getId, Function.identity(), (a, b) -> a));
        List<Contract> covering = contractRepository.findByRoomIdInAndIsDeletedFalse(rooms.keySet()).stream()
                .filter(c -> rooms.containsKey(c.getRoomId()) && occupancy.covers(c, month))
                .toList();
        if (covering.isEmpty()) return List.of();
        Map<String, Long> occupants = covering.stream().collect(Collectors.groupingBy(Contract::getRoomId, Collectors.counting()));
        Map<String, List<ContractTerminationSettlement>> settlementsByRoom = covering.stream()
                .filter(c -> c.getTerminationSettlement() != null
                        && YearMonth.from(c.getTerminationSettlement().lastRentalDate()).equals(month))
                .collect(Collectors.groupingBy(Contract::getRoomId,
                        Collectors.mapping(Contract::getTerminationSettlement, Collectors.toList())));

        List<String> serviceIds = rooms.values().stream()
                .flatMap(r -> r.getRoomServiceIds() == null ? java.util.stream.Stream.empty() : r.getRoomServiceIds().stream())
                .distinct().toList();
        Map<String, RoomService> services = serviceIds.isEmpty() ? Map.of()
                : roomServiceRepository.findByIdInAndIsDeletedFalse(serviceIds).stream()
                .filter(s -> s.getStatus() == RoomServiceStatus.ACTIVE)
                .collect(Collectors.toMap(RoomService::getId, Function.identity()));
        Map<String, RoomMeterReading> readings = meterReadingRepository
                .findByRoomIdInAndPeriodAndIsDeletedFalse(occupants.keySet(), month.toString()).stream()
                .collect(Collectors.toMap(RoomMeterReading::getRoomId, Function.identity(), (a, b) -> a));
        List<String> slotIds = covering.stream().map(MonthlyBillCalculator::slotIdOf).filter(Objects::nonNull).distinct().toList();
        Map<String, String> slotCodes = slotIds.isEmpty() ? Map.of()
                : roomSlotRepository.findByIdInAndIsDeletedFalse(slotIds).stream()
                .collect(Collectors.toMap(RoomSlot::getId, s -> s.getSlotCode() == null ? "" : s.getSlotCode()));

        List<SlotBill> bills = new ArrayList<>();
        for (Contract contract : covering) {
            Room room = rooms.get(contract.getRoomId());
            int people = occupants.get(room.getId()).intValue();
            String slotId = slotIdOf(contract);
            var settlements = settlementsByRoom.getOrDefault(room.getId(), List.of());
            var ownSettlement = contract.getTerminationSettlement();
            var closing = ownSettlement != null && YearMonth.from(ownSettlement.lastRentalDate()).equals(month)
                    ? ownSettlement.electricity() : null;
            BigDecimal allocated = settlements.stream().map(s -> s.electricity().amount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            bills.add(bill(contract, room, slotId, slotId == null ? null : slotCodes.get(slotId), month, people,
                    roomServicesOf(room, services), readings.get(room.getId()), closing, allocated, settlements.size()));
        }
        bills.sort(Comparator.comparing((SlotBill b) -> b.room().getRoomNumber(), Comparator.nullsLast(String::compareTo))
                .thenComparing(SlotBill::slotCode, Comparator.nullsLast(String::compareTo)));
        return bills;
    }

    private SlotBill bill(Contract contract, Room room, String slotId, String slotCode, YearMonth month, int people,
                          List<RoomService> roomServices, RoomMeterReading reading,
                          ElectricityClosing closing,
                          BigDecimal allocatedElectricity, int closedContracts) {
        LocalDate first = month.atDay(1);
        LocalDate afterLast = month.plusMonths(1).atDay(1);
        LocalDate stayFrom = contract.getStartDate().isAfter(first) ? contract.getStartDate() : first;
        LocalDate end = occupancy.stayEnd(contract);
        LocalDate stayUntil = end == null || end.isAfter(afterLast) ? afterLast : end;
        List<InvoiceItem> items = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Phí 1: rent for the days lived (stayUntil is exclusive).
        long days = ChronoUnit.DAYS.between(stayFrom, stayUntil);
        int monthDays = month.lengthOfMonth();
        BigDecimal rentPrice = contract.getRentPrice() == null ? BigDecimal.ZERO : contract.getRentPrice();
        if (contract.getRentPrice() == null) warnings.add("Hợp đồng chưa có giá thuê");
        BigDecimal rent = days >= monthDays ? rentPrice
                : rentPrice.multiply(BigDecimal.valueOf(days)).divide(BigDecimal.valueOf(monthDays), 0, RoundingMode.HALF_UP);
        items.add(item(InvoiceItemType.ROOM_RENT,
                days >= monthDays ? "Tiền phòng" : "Tiền phòng " + days + " ngày",
                stayFrom, stayUntil.minusDays(1), BigDecimal.valueOf(days), rentPrice, rent, null));

        // Phí 2: room services, the room's monthly price split by the occupants of the month.
        BigDecimal peopleCount = BigDecimal.valueOf(people);
        for (RoomService s : roomServices) {
            BigDecimal price = s.getUnitPrice() == null ? BigDecimal.ZERO : s.getUnitPrice();
            items.add(item(InvoiceItemType.ROOM_SERVICE, s.getName(), first, afterLast.minusDays(1), peopleCount, price,
                    price.divide(peopleCount, 0, RoundingMode.HALF_UP), null));
        }

        // Phí 3: room electricity, split by occupants of the month.
        boolean electricityUnchanged = false;
        if (closing != null) {
            items.add(item(InvoiceItemType.ELECTRICITY, "Tiền điện chốt khi hủy hợp đồng",
                    stayFrom, stayUntil.minusDays(1), closing.endReading().subtract(closing.startReading()),
                    closing.unitPrice(), closing.amount(), null));
        } else if (reading == null) {
            warnings.add("Phòng chưa có chỉ số điện tháng " + label(month));
            items.add(item(InvoiceItemType.ELECTRICITY, "Tiền điện", first, afterLast.minusDays(1),
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, "Chưa có chỉ số điện tháng này"));
        } else {
            BigDecimal amount = reading.getAmount() == null ? BigDecimal.ZERO : reading.getAmount();
            BigDecimal share = amount.subtract(allocatedElectricity).max(BigDecimal.ZERO)
                    .divide(BigDecimal.valueOf(people - closedContracts), 0, RoundingMode.HALF_UP);
            electricityUnchanged = reading.getStartReading() != null
                    && reading.getStartReading().compareTo(reading.getEndReading()) == 0;
            String warning = electricityUnchanged
                    ? "Chỉ số đầu = cuối tháng (0 kWh), có thể quên nhập chỉ số cuối tháng" : null;
            if (warning != null) warnings.add(warning);
            items.add(item(InvoiceItemType.ELECTRICITY,
                    "Tiền điện",
                    first, afterLast.minusDays(1), reading.getUsage(), reading.getUnitPrice(), share, warning));
        }

        // Phí 4: every slot-service registration that touched the month counts in full.
        if (contract.getActiveSlotServices() != null) {
            for (ActiveSlotService s : contract.getActiveSlotServices()) {
                boolean endsOnClosingDay = closing != null && s.getStartDate() != null
                        && stayUntil.minusDays(1).equals(s.getEndDate());
                if (!endsOnClosingDay && !touches(s, first, afterLast)) continue;
                if (closing != null && !s.getStartDate().isBefore(stayUntil)) continue;
                int quantity = s.getQuantity() == null ? 1 : s.getQuantity();
                BigDecimal price = s.getUnitPrice() == null ? BigDecimal.ZERO : s.getUnitPrice();
                LocalDate from = s.getStartDate().isBefore(first) ? first : s.getStartDate();
                LocalDate to = s.getEndDate() == null || !s.getEndDate().isBefore(afterLast) ? afterLast.minusDays(1) : s.getEndDate();
                items.add(item(InvoiceItemType.SLOT_SERVICE,
                        s.getName(),
                        from, to, BigDecimal.valueOf(quantity), price, price.multiply(BigDecimal.valueOf(quantity)), null));
            }
        }

        BigDecimal total = items.stream().map(InvoiceItem::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new SlotBill(contract, room, slotId, slotCode, month, people, stayFrom, stayUntil.minusDays(1),
                items, total, warnings, electricityUnchanged);
    }

    /** Registered before the month ends and not ended before it starts (a same-day add + cancel still counts). */
    private static boolean touches(ActiveSlotService s, LocalDate first, LocalDate afterLast) {
        if (s.getStartDate() == null || !s.getStartDate().isBefore(afterLast)) return false;
        LocalDate end = s.getEndDate();
        return end == null || end.isAfter(first) || (end.equals(s.getStartDate()) && !s.getStartDate().isBefore(first));
    }

    private static List<RoomService> roomServicesOf(Room room, Map<String, RoomService> services) {
        if (room.getRoomServiceIds() == null) return List.of();
        return room.getRoomServiceIds().stream().distinct().map(services::get).filter(Objects::nonNull).toList();
    }

    private static String slotIdOf(Contract c) {
        if (c.getRoomSlotId() != null) return c.getRoomSlotId();
        return c.getRoomSlotIds() == null || c.getRoomSlotIds().isEmpty() ? null : c.getRoomSlotIds().getFirst();
    }

    private static InvoiceItem item(InvoiceItemType type, String description, LocalDate from, LocalDate to,
                                    BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount, String warning) {
        InvoiceItem item = new InvoiceItem();
        item.setId(new ObjectId().toHexString());
        item.setType(type);
        item.setDescription(description);
        item.setFromDate(from);
        item.setToDate(to);
        item.setQuantity(quantity);
        item.setUnitPrice(unitPrice);
        item.setAmount(amount);
        item.setWarning(warning);
        return item;
    }

    private static String label(YearMonth month) {
        return String.format("%02d/%d", month.getMonthValue(), month.getYear());
    }



    /**
     * Bill of one contract for one month.
     *
     * @param occupants number of contracts in the room during the month (divisor of fees 2 and 3)
     * @param stayFrom  first day billed for rent; stayTo last day (inclusive)
     */
    public record SlotBill(Contract contract, Room room, String roomSlotId, String slotCode, YearMonth month,
                           int occupants, LocalDate stayFrom, LocalDate stayTo, List<InvoiceItem> items,
                           BigDecimal total, List<String> warnings, boolean electricityUnchanged) {

        public BigDecimal amountOf(InvoiceItemType type) {
            return items.stream().filter(i -> i.getType() == type).map(InvoiceItem::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }
}
