package com.kitolam.rentalroommanagement.modules.roomtype.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.response.RoomTypeResponse;
import org.springframework.data.domain.Pageable;

public interface RoomTypeService {

    RoomTypeResponse create(RoomTypeCreateRequest request);

    RoomTypeResponse getById(String id);

    PagedResponse<RoomTypeResponse> search(RoomTypeFilterRequest filter, Pageable pageable);

    RoomTypeResponse update(String id, RoomTypeUpdateRequest request);

    void delete(String id);
}
