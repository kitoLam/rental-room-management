package com.kitolam.rentalroommanagement.modules.appointment.support;

import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingInventoryGateway;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot;
import com.kitolam.rentalroommanagement.modules.appointment.integration.ViewingRoomSnapshot.RentalMode;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

/** Synthetic rooms only. Never reads/writes booking, payment, room or slot collections. */
public class ViewingInventoryFixture implements ViewingInventoryGateway {
    public static final String BRANCH_ID = "700000000000000000000001";
    @Override
    public Page<ViewingRoomSnapshot> roomsInBranch(String branchId, Pageable pageable) {
        if (!BRANCH_ID.equals(branchId)) return Page.empty(pageable);
        List<ViewingRoomSnapshot> rooms = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(i -> getRoom("71000000000000000000000" + i)).toList();
        int start = (int) Math.min(pageable.getOffset(), rooms.size());
        int end = Math.min(start + pageable.getPageSize(), rooms.size());
        return new PageImpl<>(rooms.subList(start, end), pageable, rooms.size());
    }

    @Override
    public ViewingRoomSnapshot getRoom(String roomId) {
        return switch (roomId) {
            case "710000000000000000000001" -> room(roomId, RentalMode.ROOM, 1, 0, 0, 0, true);
            case "710000000000000000000002" -> room(roomId, RentalMode.SLOT, 4, 2, 1, 0, true);
            case "710000000000000000000003" -> room(roomId, RentalMode.ROOM, 1, 0, 0, 1, true);
            case "710000000000000000000004" -> room(roomId, RentalMode.ROOM, 1, 0, 1, 0, true);
            case "710000000000000000000005" -> room(roomId, RentalMode.ROOM, 1, 1, 0, 0, true);
            case "710000000000000000000006" -> room(roomId, RentalMode.SLOT, 4, 2, 1, 1, true);
            case "710000000000000000000007" -> room(roomId, RentalMode.ROOM, 1, 0, 0, 0, false);
            default -> throw new NotFoundException("Không tìm thấy phòng trong dữ liệu giả lập lịch xem");
        };
    }

    private ViewingRoomSnapshot room(String id, RentalMode mode, int total, int occupied,
                                      int official, int temporary, boolean publicListing) {
        return new ViewingRoomSnapshot(id, BRANCH_ID, "Phòng thử " + id.substring(22),
                "Chi nhánh thử nghiệm lịch xem", "0900000000", publicListing, true, true, mode,
                total, occupied, official, temporary,
                official > 0 ? List.of("viewing-dev-booking-" + id) : List.of(),
                "viewing-dev-v1", Instant.now());
    }
}
