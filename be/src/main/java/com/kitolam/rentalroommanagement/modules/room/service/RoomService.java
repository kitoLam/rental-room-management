package com.kitolam.rentalroommanagement.modules.room.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomFilterRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomUpdateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import org.springframework.data.domain.Pageable;

public interface RoomService {

    RoomResponse create(RoomCreateRequest request);

    RoomResponse getById(String id);

    PagedResponse<RoomResponse> search(RoomFilterRequest filter, Pageable pageable);

    RoomResponse update(String id, RoomUpdateRequest request);

    void delete(String id);
}
