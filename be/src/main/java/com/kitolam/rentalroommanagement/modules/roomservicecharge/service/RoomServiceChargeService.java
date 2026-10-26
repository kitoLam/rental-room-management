package com.kitolam.rentalroommanagement.modules.roomservicecharge.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response.RoomServiceChargeResponse;
import org.springframework.data.domain.Pageable;

public interface RoomServiceChargeService {

    RoomServiceChargeResponse create(RoomServiceChargeCreateRequest request);

    RoomServiceChargeResponse getById(String id);

    PagedResponse<RoomServiceChargeResponse> search(RoomServiceChargeFilterRequest filter, Pageable pageable);

    RoomServiceChargeResponse update(String id, RoomServiceChargeUpdateRequest request);

    void delete(String id);
}
