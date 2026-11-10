package com.kitolam.rentalroommanagement.modules.roomservicecharge.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response.RoomServiceChargeResponse;
import org.springframework.data.domain.Pageable;

/** Monthly meter readings of metered room services (electricity, water...). */
public interface RoomServiceChargeService {

    RoomServiceChargeResponse create(RoomServiceChargeCreateRequest request, AuthPrincipal principal);

    RoomServiceChargeResponse getById(String id, AuthPrincipal principal);

    PagedResponse<RoomServiceChargeResponse> search(RoomServiceChargeFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    RoomServiceChargeResponse update(String id, RoomServiceChargeUpdateRequest request, AuthPrincipal principal);

    /** DRAFT → CONFIRMED. Only confirmed readings are billed. */
    RoomServiceChargeResponse confirm(String id, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);
}
