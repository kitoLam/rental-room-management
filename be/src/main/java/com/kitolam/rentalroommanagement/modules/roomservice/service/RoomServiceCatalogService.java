package com.kitolam.rentalroommanagement.modules.roomservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.roomservice.document.RoomService;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface RoomServiceCatalogService {

    RoomServiceResponse create(RoomServiceCreateRequest request, AuthPrincipal principal);

    RoomServiceResponse getById(String id, AuthPrincipal principal);

    PagedResponse<RoomServiceResponse> search(RoomServiceFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    RoomServiceResponse update(String id, RoomServiceUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    /** Active entries of a branch, for public pages and tenants. */
    List<RoomServiceResponse> activeOfBranch(String branchId);

    /** For other modules: live entry or NotFoundException. */
    RoomService getEntity(String id);

    RoomServiceResponse toResponse(RoomService item);
}
