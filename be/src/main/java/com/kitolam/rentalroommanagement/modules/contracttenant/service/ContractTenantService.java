package com.kitolam.rentalroommanagement.modules.contracttenant.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.request.ContractTenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.ContractTenantResponse;
import com.kitolam.rentalroommanagement.modules.contracttenant.dto.response.EligibleContractTenantResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface ContractTenantService {

    ContractTenantResponse create(ContractTenantCreateRequest request, AuthPrincipal principal);

    ContractTenantResponse getById(String id, AuthPrincipal principal);

    PagedResponse<ContractTenantResponse> search(ContractTenantFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    ContractTenantResponse update(String id, ContractTenantUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    List<EligibleContractTenantResponse> eligibleTenants(String contractId, AuthPrincipal principal);
}
