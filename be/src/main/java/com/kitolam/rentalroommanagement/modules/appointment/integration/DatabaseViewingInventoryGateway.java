package com.kitolam.rentalroommanagement.modules.appointment.integration;

import com.kitolam.rentalroommanagement.modules.booking.service.BookingService;
import com.kitolam.rentalroommanagement.modules.booking.dto.response.EffectiveRoomHoldResponse;
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

@Component
@RequiredArgsConstructor
public class DatabaseViewingInventoryGateway implements ViewingInventoryGateway {
    private final RoomService rooms;
    private final BranchService branches;
    private final BookingService bookings;
    private final Clock clock;

    @Override
    public ViewingRoomSnapshot getRoom(String roomId) {
        var room = rooms.getById(roomId);
        var branch = branches.getById(room.branchId());
        return snapshot(room, branch, bookings.currentRoomHold(roomId));
    }

    private ViewingRoomSnapshot snapshot(RoomResponse room, BranchResponse branch, EffectiveRoomHoldResponse hold) {
        boolean occupied = room.status() == RoomStatus.OCCUPIED;
        boolean official = !occupied && !hold.officialBookingIds().isEmpty();
        boolean temporary = !occupied && !official && hold.temporarilyHeld();
        // The merged room/booking module explicitly exposes whole-room rentals (ROOM).
        // Capacity is people, never a count of rentable slots.
        return new ViewingRoomSnapshot(room.id(), branch.id(), room.roomNumber(), branch.name(), branch.phone(),
                room.status() == RoomStatus.AVAILABLE, branch.status() == BranchStatus.ACTIVE,
                room.status() != RoomStatus.MAINTENANCE && room.status() != RoomStatus.INACTIVE,
                ViewingRoomSnapshot.RentalMode.ROOM, 1, occupied ? 1 : 0, official ? 1 : 0, temporary ? 1 : 0,
                hold.officialBookingIds(), room.updatedAt() + ":" + branch.updatedAt() + ":" + hold.revision(), clock.instant());
    }

    @Override
    public Page<ViewingRoomSnapshot> roomsInBranch(String branchId, Pageable pageable) {
        var page = rooms.listByBranch(branchId, pageable);
        var branch = branches.getById(branchId);
        return new PageImpl<>(page.getContent().stream()
                .map(room -> snapshot(room, branch, bookings.currentRoomHold(room.id())))
                .toList(), pageable, page.getTotalElements());
    }
}
