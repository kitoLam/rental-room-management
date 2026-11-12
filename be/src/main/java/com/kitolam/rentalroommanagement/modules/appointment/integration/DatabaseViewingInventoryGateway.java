package com.kitolam.rentalroommanagement.modules.appointment.integration;

import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.room.enums.RoomStatus;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import com.kitolam.rentalroommanagement.modules.roomslot.enums.RoomSlotStatus;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service.RoomSlotOccupancyService;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import com.kitolam.rentalroommanagement.modules.contract.enums.ContractStatus;
import com.kitolam.rentalroommanagement.modules.booking.enums.BookingStatus;

@Component
@RequiredArgsConstructor
public class DatabaseViewingInventoryGateway implements ViewingInventoryGateway {
    private final RoomService rooms;
    private final BranchService branches;
    private final BookingService bookings;
    private final Clock clock;
    private final RoomSlotService slots;
    private final RoomSlotOccupancyService occupancies;
    private final ContractService contracts;

    @Override
    public ViewingRoomSnapshot getRoom(String roomId) {
        var room = rooms.getById(roomId);
        var branch = branches.getById(room.branchId());
        return snapshot(room, branch);
    }

    private ViewingRoomSnapshot snapshot(RoomResponse room, BranchResponse branch) {
        var units = slots.readForOverview(List.of(room.id()));
        var held = bookings.readForOverview(units.stream().map(RoomSlotService.OverviewSlot::id).toList());
        var now = clock.instant();
        var officialIds = held.stream().filter(b -> b.status() == BookingStatus.CONFIRMED && effectiveHold(b, now))
                .map(BookingService.OverviewBooking::id).toList();
        int occupied = 0, official = 0, temporary = 0;
        for (var unit : units) {
            if (unit.status() == RoomSlotStatus.OCCUPIED) { occupied++; continue; }
            var unitHolds = held.stream().filter(b -> bookingSlots(b).contains(unit.id()) && effectiveHold(b, now)).toList();
            if (unitHolds.stream().anyMatch(b -> b.status() == BookingStatus.CONFIRMED)) official++;
            else if (!unitHolds.isEmpty()) temporary++;
        }
        return new ViewingRoomSnapshot(room.id(), branch.id(), room.roomNumber(), branch.name(), branch.phone(),
                room.status() != RoomStatus.INACTIVE, branch.status() == BranchStatus.ACTIVE,
                room.status() != RoomStatus.MAINTENANCE && room.status() != RoomStatus.INACTIVE,
                ViewingRoomSnapshot.RentalMode.SLOT, Math.max(1, units.size()), occupied, official, temporary,
                officialIds, room.updatedAt() + ":" + branch.updatedAt() + ":" + held.hashCode(), now);
    }

    @Override
    public List<ViewingSlotSnapshot> slotsForViewing(String roomId, LocalDate date) {
        var units = slots.readForOverview(List.of(roomId));
        var ids = units.stream().map(RoomSlotService.OverviewSlot::id).toList();
        var occupancy = occupancies.readForOverview(ids);
        var leases = contracts.readForOverview(List.of(roomId)).stream().filter(c -> c.status() == ContractStatus.ACTIVE).toList();
        var holds = bookings.readForOverview(ids).stream().filter(b -> effectiveHold(b, clock.instant()))
                .filter(b -> leases.stream().noneMatch(c -> Objects.equals(c.bookingId(), b.id())))
                .collect(java.util.stream.Collectors.toMap(BookingService.OverviewBooking::id, b -> b));
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneId.of("Asia/Ho_Chi_Minh"));
        return units.stream().map(unit -> {
            boolean selectable = unit.status() != null && unit.status() != RoomSlotStatus.INACTIVE && unit.status() != RoomSlotStatus.MAINTENANCE;
            var intervals = new java.util.ArrayList<Interval>();
            leases.stream().filter(c -> c.roomSlotIds() != null && c.roomSlotIds().contains(unit.id()))
                    .forEach(c -> intervals.add(new Interval(c.startDate(), c.endDate(), "SLOT_OCCUPIED")));
            occupancy.stream().filter(o -> unit.id().equals(o.roomSlotId())).forEach(o -> {
                if (o.status() == OccupancyStatus.ACTIVE) intervals.add(new Interval(o.startDate(), o.endDate(), "SLOT_OCCUPIED"));
                else if (o.status() == OccupancyStatus.RESERVED && holds.containsKey(o.bookingId())) {
                    String reason = holds.get(o.bookingId()).status() == BookingStatus.CONFIRMED ? "SLOT_OFFICIAL_HOLD" : "SLOT_TEMPORARY_HOLD";
                    intervals.add(new Interval(o.startDate(), o.endDate(), reason));
                }
            });
            // An effective hold without its range is unknown, never assumed free.
            holds.values().stream().filter(b -> bookingSlots(b).contains(unit.id())
                    && occupancy.stream().noneMatch(o -> unit.id().equals(o.roomSlotId()) && Objects.equals(b.id(), o.bookingId())
                        && o.status() == OccupancyStatus.RESERVED))
                    .forEach(b -> intervals.add(new Interval(today, null, b.status() == BookingStatus.CONFIRMED ? "SLOT_OFFICIAL_HOLD" : "SLOT_TEMPORARY_HOLD")));
            boolean knownOccupancy = intervals.stream().anyMatch(i -> i.reason.equals("SLOT_OCCUPIED")
                    && (i.start == null || !i.start.isAfter(today)));
            if (unit.status() == RoomSlotStatus.OCCUPIED && !knownOccupancy) intervals.add(new Interval(today, null, "SLOT_OCCUPIED"));
            LocalDate earliest = unit.status() == RoomSlotStatus.AVAILABLE && unit.availableFrom() != null ? unit.availableFrom() : today;
            for (var interval : intervals) {
                if (interval.covers(today)) {
                    if (interval.end == null) { earliest = null; break; }
                    if (interval.end.plusDays(1).isAfter(earliest)) earliest = interval.end.plusDays(1);
                }
            }
            String reason = selectable ? "AVAILABLE" : "SLOT_UNAVAILABLE";
            var blocked = intervals.stream().filter(i -> i.covers(date)).findFirst().orElse(null);
            if (selectable && blocked != null) reason = blocked.reason;
            else if (selectable && unit.status() == RoomSlotStatus.AVAILABLE && unit.availableFrom() != null && date.isBefore(unit.availableFrom())) reason = "SLOT_NOT_OPEN";
            String message = null;
            if (!reason.equals("AVAILABLE")) {
                var blockedIntervals = intervals.stream().filter(i -> i.covers(date)).toList();
                LocalDate from = blocked == null ? earliest : blockedIntervals.stream().anyMatch(i -> i.end == null) ? null
                        : blockedIntervals.stream().map(i -> i.end.plusDays(1)).max(LocalDate::compareTo).orElse(earliest);
                message = !selectable ? "Slot " + unit.slotCode() + " đang bảo trì hoặc ngừng hoạt động."
                        : from == null ? "Slot " + unit.slotCode() + " chưa xác định ngày có thể xem; vui lòng chọn slot khác."
                        : "Slot " + unit.slotCode() + " chỉ có thể xem từ " + from.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                          + ". Ngày xem phải sau ngày kết thúc hợp đồng/lượt ở và ngoài thời gian giữ chỗ.";
            }
            return new ViewingSlotSnapshot(unit.id(), unit.slotCode(), unit.status(), selectable, reason.equals("AVAILABLE"), earliest, reason, message);
        }).toList();
    }

    private record Interval(LocalDate start, LocalDate end, String reason) {
        boolean covers(LocalDate date) { return (start == null || !date.isBefore(start)) && (end == null || !date.isAfter(end)); }
    }
    private static List<String> bookingSlots(BookingService.OverviewBooking booking) {
        return booking.roomSlotIds() != null && !booking.roomSlotIds().isEmpty() ? booking.roomSlotIds()
                : booking.roomSlotId() == null ? List.of() : List.of(booking.roomSlotId());
    }
    private static boolean effectiveHold(BookingService.OverviewBooking booking, Instant now) {
        if (booking.status() == BookingStatus.CONFIRMED) return booking.checkInDeadline() == null || booking.checkInDeadline().isAfter(now);
        return booking.status() == BookingStatus.AWAITING_PAYMENT && booking.paymentDeadline() != null && booking.paymentDeadline().isAfter(now)
                && booking.holdExpiresAt() != null && booking.holdExpiresAt().isAfter(now);
    }

    @Override
    public Page<ViewingRoomSnapshot> roomsInBranch(String branchId, Pageable pageable) {
        var page = rooms.listByBranch(branchId, pageable);
        var branch = branches.getById(branchId);
        return new PageImpl<>(page.getContent().stream()
                .map(room -> snapshot(room, branch))
                .toList(), pageable, page.getTotalElements());
    }
}
