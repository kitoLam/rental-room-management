package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.request.RoomSlotOccupancyUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslotoccupancy.dto.response.RoomSlotOccupancyResponse;
import org.springframework.data.domain.Pageable;

public interface RoomSlotOccupancyService {

    RoomSlotOccupancyResponse create(RoomSlotOccupancyCreateRequest request);

    RoomSlotOccupancyResponse getById(String id);

    PagedResponse<RoomSlotOccupancyResponse> search(RoomSlotOccupancyFilterRequest filter, Pageable pageable);

    RoomSlotOccupancyResponse update(String id, RoomSlotOccupancyUpdateRequest request);

    void delete(String id);
    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewOccupancy> readForOverview(List<String> ids);

    record OverviewOccupancy(String roomSlotId, String contractTenantId, String bookingId, java.time.LocalDate startDate, java.time.LocalDate endDate, com.kitolam.rentalroommanagement.modules.roomslotoccupancy.enums.OccupancyStatus status) { }
}
