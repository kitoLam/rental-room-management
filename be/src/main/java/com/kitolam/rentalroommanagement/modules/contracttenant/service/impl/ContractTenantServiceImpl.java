package com.kitolam.rentalroommanagement.modules.contracttenant.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.ContractTenantResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.repository.ContractTenantRepository;
import com.kitolam.rentalroommanagement.modules.contracttenant.service.ContractTenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ContractTenantServiceImpl implements ContractTenantService {

    private final ContractTenantRepository contractTenantRepository;

    @Override
    public ContractTenantResponse create(ContractTenantCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ContractTenantResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ContractTenantResponse> search(ContractTenantFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ContractTenantResponse update(String id, ContractTenantUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
