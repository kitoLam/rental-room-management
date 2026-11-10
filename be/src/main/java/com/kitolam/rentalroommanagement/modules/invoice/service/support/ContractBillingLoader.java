package com.kitolam.rentalroommanagement.modules.invoice.service.support;

import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.invoice.billing.BillingPeriod;
import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput;
import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput.Holding;
import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput.RoomServiceLine;
import com.kitolam.rentalroommanagement.modules.invoice.billing.ContractBillingInput.SlotServiceLine;
import com.kitolam.rentalroommanagement.modules.invoice.billing.DateRange;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.document.RoomServiceCharge;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.enums.RoomServiceChargeStatus;
import com.kitolam.rentalroommanagement.modules.roomslot.document.RoomSlot;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.document.RoomSlotOccupancy;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.document.ServiceItem;
import com.kitolam.rentalroommanagement.modules.serviceitem.repository.ServiceItemRepository;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.enums.ProrateMethod;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Loads the data of one contract for one period and turns it into a {@link ContractBillingInput}. */
@Component
@RequiredArgsConstructor
public class ContractBillingLoader {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final List<String> BILLED_OCCUPANCY = List.of(OccupancyStatus.ACTIVE.name(), OccupancyStatus.ENDED.name());
    private static final List<RoomServiceChargeStatus> BILLABLE_CHARGE =
            List.of(RoomServiceChargeStatus.CONFIRMED, RoomServiceChargeStatus.INVOICED);

    private final MongoTemplate mongoTemplate;
    private final ContractRepository contractRepository;
    private final RoomRepository roomRepository;
    private final RoomSlotRepository roomSlotRepository;
    private final ServiceItemRepository serviceItemRepository;

    /**
     * Days of the period the contract is billed for:
     * [max(startDate, firstBillingStartDate), min(endDate, termination date)) ∩ period.
     */
    public static DateRange billingWindow(Contract contract, BillingPeriod period) {
        if (contract.getStartDate() == null) {
            return new DateRange(period.range().from(), period.range().from());
        }
        LocalDate start = contract.getStartDate();
        if (contract.getFirstBillingStartDate() != null && contract.getFirstBillingStartDate().isAfter(start)) {
            start = contract.getFirstBillingStartDate();
        }
        LocalDate end = contract.getEndDate();
        if (contract.getTerminatedAt() != null) {
            LocalDate terminated = LocalDate.ofInstant(contract.getTerminatedAt(), VIETNAM);
            if (end == null || terminated.isBefore(end)) end = terminated;
        }
        return DateRange.of(start, end).intersect(period.range());
    }

    public ContractBillingInput load(Contract contract, BillingPeriod period) {
        DateRange window = billingWindow(contract, period);

        // Slots held by this contract
        List<RoomSlotOccupancy> ownOccupancies = occupancies(Criteria.where("contractId").is(oid(contract.getId())), period);
        Map<String, RoomSlot> slots = byId(roomSlotRepository.findByIdInAndIsDeletedFalse(
                ownOccupancies.stream().map(RoomSlotOccupancy::getRoomSlotId).collect(Collectors.toSet())), RoomSlot::getId);
        Set<String> roomIds = slots.values().stream().map(RoomSlot::getRoomId).collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, Room> rooms = byId(roomRepository.findAllById(roomIds), Room::getId);

        List<Holding> holdings = ownOccupancies.stream()
                .filter(o -> slots.containsKey(o.getRoomSlotId()))
                .map(o -> {
                    RoomSlot slot = slots.get(o.getRoomSlotId());
                    Room room = rooms.get(slot.getRoomId());
                    DateRange range = DateRange.of(o.getStartDate(), o.getEndDate()).intersect(window);
                    return new Holding(slot.getRoomId(), room == null ? "?" : room.getRoomNumber(),
                            slot.getId(), slot.getSlotCode(), range);
                })
                .filter(h -> !h.range().isEmpty())
                .toList();

        // Services of those slots
        List<SlotService> slotServiceDocs = overlapping(
                Criteria.where("roomSlotId").in(oids(slots.keySet())), period, SlotService.class);
        List<RoomService> roomServiceDocs = overlapping(
                Criteria.where("roomId").in(oids(roomIds)), period, RoomService.class);
        Map<String, ServiceItem> catalog = byId(serviceItemRepository.findAllById(
                concat(slotServiceDocs.stream().map(SlotService::getServiceId).toList(),
                        roomServiceDocs.stream().map(RoomService::getServiceId).toList())), ServiceItem::getId);

        List<SlotServiceLine> slotServices = slotServiceDocs.stream()
                .map(s -> new SlotServiceLine(s.getId(), s.getRoomSlotId(), name(catalog, s.getServiceId()),
                        s.getQuantity() == null ? 1 : s.getQuantity(), s.getUnitPrice(),
                        s.getProrateMethod() != ProrateMethod.NONE, DateRange.of(s.getStartDate(), s.getEndDate())))
                .toList();

        // Confirmed meter readings of the period
        Map<String, RoomServiceCharge> charges = mongoTemplate.find(new Query(new Criteria().andOperator(
                        MongoQueryHelper.notDeleted(),
                        Criteria.where("roomServiceId").in(oids(roomServiceDocs.stream().map(RoomService::getId).toList())),
                        Criteria.where("period").is(period.code()),
                        Criteria.where("status").in(BILLABLE_CHARGE.stream().map(Enum::name).toList()))),
                RoomServiceCharge.class).stream()
                .collect(Collectors.toMap(RoomServiceCharge::getRoomServiceId, Function.identity(), (a, b) -> a));

        List<RoomServiceLine> roomServices = roomServiceDocs.stream()
                .filter(rs -> catalog.containsKey(rs.getServiceId()))
                .map(rs -> {
                    ServiceItem item = catalog.get(rs.getServiceId());
                    RoomServiceCharge charge = charges.get(rs.getId());
                    Room room = rooms.get(rs.getRoomId());
                    return new RoomServiceLine(rs.getId(), rs.getRoomId(), room == null ? "?" : room.getRoomNumber(),
                            item.getName(), item.getCalculationType(), rs.getUnitPrice(),
                            DateRange.of(rs.getStartDate(), rs.getEndDate()),
                            charge == null ? null : charge.getId(), charge == null ? null : charge.getTotalAmount());
                })
                .toList();

        return new ContractBillingInput(contract.getId(), contract.getRentPrice(), window, holdings,
                slotServices, roomServices, roomSlotDays(roomIds, period));
    }

    /** roomId -> (contractId -> slot-days) of every contract living in the rooms during the period. */
    private Map<String, Map<String, Long>> roomSlotDays(Collection<String> roomIds, BillingPeriod period) {
        Map<String, String> slotToRoom = roomSlotRepository.findByRoomIdInAndIsDeletedFalse(roomIds).stream()
                .collect(Collectors.toMap(RoomSlot::getId, RoomSlot::getRoomId));
        List<RoomSlotOccupancy> all = occupancies(Criteria.where("roomSlotId").in(oids(slotToRoom.keySet())), period).stream()
                .filter(o -> o.getContractId() != null)
                .toList();
        Map<String, DateRange> windows = new HashMap<>();
        contractRepository.findAllById(all.stream().map(RoomSlotOccupancy::getContractId).collect(Collectors.toSet()))
                .forEach(c -> windows.put(c.getId(), billingWindow(c, period)));

        Map<String, Map<String, Long>> result = new HashMap<>();
        for (RoomSlotOccupancy occupancy : all) {
            DateRange window = windows.get(occupancy.getContractId());
            if (window == null) continue;
            long days = DateRange.of(occupancy.getStartDate(), occupancy.getEndDate()).intersect(window).days();
            if (days == 0) continue;
            result.computeIfAbsent(slotToRoom.get(occupancy.getRoomSlotId()), k -> new HashMap<>())
                    .merge(occupancy.getContractId(), days, Long::sum);
        }
        return result;
    }

    /** Billed occupancies (ACTIVE / ENDED) overlapping the period. */
    private List<RoomSlotOccupancy> occupancies(Criteria filter, BillingPeriod period) {
        return mongoTemplate.find(new Query(new Criteria().andOperator(
                MongoQueryHelper.notDeleted(),
                filter,
                Criteria.where("status").in(BILLED_OCCUPANCY),
                Criteria.where("startDate").lt(period.range().to()),
                new Criteria().orOperator(Criteria.where("endDate").is(null), Criteria.where("endDate").gt(period.range().from()))
        )), RoomSlotOccupancy.class);
    }

    /** Non-deleted documents with startDate/endDate (end exclusive, null = open) overlapping the period. */
    private <T> List<T> overlapping(Criteria filter, BillingPeriod period, Class<T> type) {
        return mongoTemplate.find(new Query(new Criteria().andOperator(
                MongoQueryHelper.notDeleted(),
                filter,
                Criteria.where("startDate").lt(period.range().to()),
                new Criteria().orOperator(Criteria.where("endDate").is(null), Criteria.where("endDate").gt(period.range().from()))
        )), type);
    }

    private static String name(Map<String, ServiceItem> catalog, String serviceId) {
        ServiceItem item = catalog.get(serviceId);
        return item == null ? "Dịch vụ" : item.getName();
    }

    private static List<ObjectId> oids(Collection<String> ids) {
        return ids.stream().filter(ObjectId::isValid).map(ObjectId::new).toList();
    }

    private static ObjectId oid(String id) {
        return new ObjectId(id);
    }

    private static Set<String> concat(List<String> a, List<String> b) {
        Set<String> all = new LinkedHashSet<>(a);
        all.addAll(b);
        return all;
    }

    private static <T> Map<String, T> byId(Iterable<T> items, Function<T, String> id) {
        Map<String, T> map = new HashMap<>();
        items.forEach(item -> map.put(id.apply(item), item));
        return map;
    }
}
