package com.kitolam.rentalroommanagement.modules.manager.service;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerCreateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerFilterRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerUpdateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface ManagerService {
    String VIEWING_PERMISSION = "MANAGE_VIEWING_APPOINTMENTS";
    Optional<ManagerResponse> findAssignment(String email);

    ManagerResponse create(ManagerCreateRequest request);

    ManagerResponse getById(String id);

    PagedResponse<ManagerResponse> search(ManagerFilterRequest filter, Pageable pageable);

    ManagerResponse update(String id, ManagerUpdateRequest request);

    void delete(String id);
    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewManager> readForOverview(List<String> ids);

    record OverviewManager(String branchId, String fullName) { }
}
