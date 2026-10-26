package com.kitolam.rentalroommanagement.modules.contracttenant.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.ContractTenantResponse;
import org.springframework.data.domain.Pageable;

public interface ContractTenantService {

    ContractTenantResponse create(ContractTenantCreateRequest request);

    ContractTenantResponse getById(String id);

    PagedResponse<ContractTenantResponse> search(ContractTenantFilterRequest filter, Pageable pageable);

    ContractTenantResponse update(String id, ContractTenantUpdateRequest request);

    void delete(String id);
}
