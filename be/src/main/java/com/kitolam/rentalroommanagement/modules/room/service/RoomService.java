package com.kitolam.rentalroommanagement.modules.room.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomCreateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomFilterRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.request.RoomUpdateRequest;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import org.springframework.data.domain.Pageable;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.UtilityRatesRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomUtilityRatesResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;

public interface RoomService {
    UtilityRatesResponse publicUtilityRates(String roomId);
    RoomUtilityRatesResponse utilityRateConfiguration(String roomId, AuthPrincipal principal);
    RoomUtilityRatesResponse updateUtilityRates(String roomId, UtilityRatesRequest request, AuthPrincipal principal);
    PagedResponse<RoomResponse> listByBranch(String branchId, Pageable pageable);

    RoomResponse create(RoomCreateRequest request);

    RoomResponse getById(String id);

    PagedResponse<RoomResponse> search(RoomFilterRequest filter, Pageable pageable);

    RoomResponse update(String id, RoomUpdateRequest request);

    void delete(String id);
}
