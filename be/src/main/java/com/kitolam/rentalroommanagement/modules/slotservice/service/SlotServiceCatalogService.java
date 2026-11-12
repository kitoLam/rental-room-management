package com.kitolam.rentalroommanagement.modules.slotservice.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.slotservice.document.SlotService;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface SlotServiceCatalogService {

    SlotServiceResponse create(SlotServiceCreateRequest request, AuthPrincipal principal);

    SlotServiceResponse getById(String id, AuthPrincipal principal);

    PagedResponse<SlotServiceResponse> search(SlotServiceFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    SlotServiceResponse update(String id, SlotServiceUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    /** Active entries of a branch, for public pages and tenants. */
    List<SlotServiceResponse> activeOfBranch(String branchId);

    /** For other modules: live entry or NotFoundException. */
    SlotService getEntity(String id);

    SlotServiceResponse toResponse(SlotService item);
}
