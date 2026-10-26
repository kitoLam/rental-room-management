package com.kitolam.rentalroommanagement.modules.roomslotoccupancy.service;

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
}
