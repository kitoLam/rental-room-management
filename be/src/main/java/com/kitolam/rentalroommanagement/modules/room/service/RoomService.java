package com.kitolam.rentalroommanagement.modules.room.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomFilterRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomUpdateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import org.springframework.data.domain.Pageable;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomUtilityRatesResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;

public interface RoomService {
    /** Internal read-only platform statistics. */
    java.util.List<StatusTotal> readStatusTotalsForAdmin();
    record StatusTotal(String status, long count) { }
    UtilityRatesResponse publicUtilityRates(String roomId);
    RoomUtilityRatesResponse utilityRateConfiguration(String roomId, AuthPrincipal principal);
    PagedResponse<RoomResponse> listByBranch(String branchId, Pageable pageable);

    /** Also creates maxOccupants slots. */
    RoomResponse create(RoomCreateRequest request, AuthPrincipal principal);

    RoomResponse getById(String id);

    PagedResponse<RoomResponse> search(RoomFilterRequest filter, Pageable pageable);

    RoomResponse update(String id, RoomUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    /** Slots of a room with whether each one is busy (staff of the room's branch). */
    java.util.List<com.kitolam.rentalroommanagement.modules.room.dto.response.RoomSlotUsageResponse> slots(String roomId, AuthPrincipal principal);

    /** Manually set when a free slot can be rented from; refused while the slot is busy. */
    com.kitolam.rentalroommanagement.modules.room.dto.response.RoomSlotUsageResponse updateSlotAvailableFrom(
            String roomId, String slotId, java.time.LocalDate availableFrom, AuthPrincipal principal);

    com.kitolam.rentalroommanagement.modules.room.dto.response.RoomSlotUsageResponse setSlotDepositPaused(
            String roomId, String slotId, boolean paused, java.time.LocalDate availableFrom, AuthPrincipal principal);
}
