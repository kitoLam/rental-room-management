package com.kitolam.rentalroommanagement.modules.roomslot.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.response.RoomSlotResponse;
import org.springframework.data.domain.Pageable;

public interface RoomSlotService {

    RoomSlotResponse create(RoomSlotCreateRequest request);

    RoomSlotResponse getById(String id);

    PagedResponse<RoomSlotResponse> search(RoomSlotFilterRequest filter, Pageable pageable);

    RoomSlotResponse update(String id, RoomSlotUpdateRequest request);

    void delete(String id);
}
