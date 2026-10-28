package com.kitolam.rentalroommanagement.modules.tenant.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface TenantService {
    Optional<String> profileIdByEmail(String email);

    TenantResponse create(TenantCreateRequest request);

    TenantResponse getById(String id);

    PagedResponse<TenantResponse> search(TenantFilterRequest filter, Pageable pageable);

    TenantResponse update(String id, TenantUpdateRequest request);

    void delete(String id);
}
