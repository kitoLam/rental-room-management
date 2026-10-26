package com.kitolam.rentalroommanagement.modules.manager.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerCreateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerFilterRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerUpdateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import org.springframework.data.domain.Pageable;

public interface ManagerService {

    ManagerResponse create(ManagerCreateRequest request);

    ManagerResponse getById(String id);

    PagedResponse<ManagerResponse> search(ManagerFilterRequest filter, Pageable pageable);

    ManagerResponse update(String id, ManagerUpdateRequest request);

    void delete(String id);
}
