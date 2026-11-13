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
        var leases = contracts.readForOverview(List.of(roomId));
        var holds = bookings.readForOverview(ids).stream().filter(b -> effectiveHold(b, clock.instant())).toList();
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneId.of("Asia/Ho_Chi_Minh"));
        return units.stream().map(unit -> {
            boolean selectable = unit.status() != null && unit.status() != RoomSlotStatus.INACTIVE && unit.status() != RoomSlotStatus.MAINTENANCE;
            var intervals = new java.util.ArrayList<Interval>();
            var unitLeases = leases.stream().filter(c -> c.roomSlotIds() != null && c.roomSlotIds().contains(unit.id())).toList();
            var unitOccupancies = occupancy.stream().filter(o -> unit.id().equals(o.roomSlotId())).toList();
            unitLeases.stream().filter(c -> c.status() == ContractStatus.ACTIVE)
                    .forEach(c -> intervals.add(new Interval(c.startDate(), c.endDate(), "SLOT_OCCUPIED")));
            unitOccupancies.stream().filter(o -> o.status() == OccupancyStatus.ACTIVE)
                    .forEach(o -> intervals.add(new Interval(o.startDate(), o.endDate(), "SLOT_OCCUPIED")));
            for (var hold : holds.stream().filter(b -> bookingSlots(b).contains(unit.id())).toList()) {
                var linkedLeases = unitLeases.stream().filter(c -> Objects.equals(c.bookingId(), hold.id())).toList();
                var linkedStays = unitOccupancies.stream().filter(o -> Objects.equals(o.bookingId(), hold.id())).toList();
                if (hold.status() == BookingStatus.CONFIRMED) {
                    // A converted lease owns the dates for THIS slot, not every slot of the booking.
                    if (linkedLeases.stream().anyMatch(c -> c.status() == ContractStatus.ACTIVE)
                            || linkedStays.stream().anyMatch(o -> o.status() == OccupancyStatus.ACTIVE)) continue;
                    boolean liveReservation = linkedStays.stream().anyMatch(o -> o.status() == OccupancyStatus.RESERVED);
                    boolean finishedLeases = !linkedLeases.isEmpty() && linkedLeases.stream()
                            .allMatch(c -> c.status() == ContractStatus.EXPIRED || c.status() == ContractStatus.TERMINATED);
                    boolean finishedStays = !linkedStays.isEmpty() && linkedStays.stream().allMatch(o -> o.status() == OccupancyStatus.ENDED);
                    if (!liveReservation && (finishedLeases || (linkedLeases.isEmpty() && finishedStays))) continue;
                }
                LocalDate holdEnd = null;
                if (hold.status() == BookingStatus.CONFIRMED) {
                    var drafts = linkedLeases.stream().filter(c -> c.status() == ContractStatus.DRAFT).toList();
                    var reservations = linkedStays.stream().filter(o -> o.status() == OccupancyStatus.RESERVED).toList();
                    if (!drafts.isEmpty() && drafts.stream().allMatch(c -> c.endDate() != null))
                        holdEnd = drafts.stream().map(ContractService.OverviewContract::endDate).max(LocalDate::compareTo).orElseThrow();
                    else if (drafts.isEmpty() && !reservations.isEmpty() && reservations.stream().allMatch(o -> o.endDate() != null))
                        holdEnd = reservations.stream().map(RoomSlotOccupancyService.OverviewOccupancy::endDate).max(LocalDate::compareTo).orElseThrow();
                }
                // A live reservation blocks new viewings even before its intended move-in date.
                // Missing dates stay blocked; a historical finished booking is handled above.
                intervals.add(new Interval(today, holdEnd, hold.status() == BookingStatus.CONFIRMED ? "SLOT_OFFICIAL_HOLD" : "SLOT_TEMPORARY_HOLD"));
            }
            boolean knownOccupancy = intervals.stream().anyMatch(i -> i.reason.equals("SLOT_OCCUPIED")
                    && (i.start == null || !i.start.isAfter(today)));
            if (unit.status() == RoomSlotStatus.OCCUPIED && !knownOccupancy) intervals.add(new Interval(today, null, "SLOT_OCCUPIED"));
            // Move-in availability is independent from the date a vacant slot can be viewed.
            LocalDate earliest = firstViewingDate(today, intervals);
            String reason = selectable ? "AVAILABLE" : "SLOT_UNAVAILABLE";
            var blocked = intervals.stream().filter(i -> i.covers(date)).findFirst().orElse(null);
            if (selectable && blocked != null) reason = blocked.reason;
            String message = null;
            if (!reason.equals("AVAILABLE")) {
                var blockedIntervals = intervals.stream().filter(i -> i.covers(date)).toList();
                LocalDate from = blocked == null ? earliest : blockedIntervals.stream().anyMatch(i -> i.end == null) ? null
                        : blockedIntervals.stream().map(i -> i.end.plusDays(1)).max(LocalDate::compareTo).orElse(earliest);
                message = !selectable ? "Slot " + unit.slotCode() + " đang bảo trì hoặc ngừng hoạt động."
                        : from == null && (reason.equals("SLOT_OFFICIAL_HOLD") || reason.equals("SLOT_TEMPORARY_HOLD"))
                          ? "Slot " + unit.slotCode() + " đang được giữ chỗ và chưa xác định ngày kết thúc; chưa thể đặt lịch xem khi giữ chỗ còn hiệu lực."
                        : from == null ? "Slot " + unit.slotCode() + " đang có người thuê nhưng chưa xác định ngày kết thúc; vui lòng chọn slot khác."
                        : "Slot " + unit.slotCode() + " chỉ có thể xem từ " + from.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                          + ". Ngày xem phải sau ngày kết thúc hợp đồng/lượt ở và ngoài thời gian giữ chỗ.";
            }
            return new ViewingSlotSnapshot(unit.id(), unit.slotCode(), unit.status(), selectable, reason.equals("AVAILABLE"), earliest, reason, message);
        }).toList();
    }

    private record Interval(LocalDate start, LocalDate end, String reason) {
        boolean covers(LocalDate date) { return (start == null || !date.isBefore(start)) && (end == null || !date.isAfter(end)); }
    }
    private static LocalDate firstViewingDate(LocalDate today, List<Interval> intervals) {
        LocalDate candidate = today;
        for (int pass = 0; pass <= intervals.size(); pass++) {
            LocalDate next = candidate;
            for (var interval : intervals) if (interval.covers(candidate)) {
                if (interval.end == null) return null;
                if (interval.end.plusDays(1).isAfter(next)) next = interval.end.plusDays(1);
            }
            if (next.equals(candidate)) return candidate;
            candidate = next;
        }
        return candidate;
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
