package com.kitolam.rentalroommanagement.modules.tenant.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.kitolam.rentalroommanagement.modules.tenant.repository.TenantRepository;
import com.kitolam.rentalroommanagement.modules.tenant.service.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;

    @Override
    public TenantResponse create(TenantCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public TenantResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<TenantResponse> search(TenantFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public TenantResponse update(String id, TenantUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
