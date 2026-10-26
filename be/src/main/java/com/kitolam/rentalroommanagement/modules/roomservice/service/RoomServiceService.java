package com.kitolam.rentalroommanagement.modules.roomservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import org.springframework.data.domain.Pageable;

public interface RoomServiceService {

    RoomServiceResponse create(RoomServiceCreateRequest request);

    RoomServiceResponse getById(String id);

    PagedResponse<RoomServiceResponse> search(RoomServiceFilterRequest filter, Pageable pageable);

    RoomServiceResponse update(String id, RoomServiceUpdateRequest request);

    void delete(String id);
}
