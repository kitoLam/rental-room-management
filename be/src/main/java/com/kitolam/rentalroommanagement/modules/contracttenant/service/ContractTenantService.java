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
    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewTenancy> readForOverview(List<String> ids);

    /** Internal read-only projection; tenantId must be resolved from the authenticated account. */
    List<TenantLease> readOwnedForOverview(String tenantId);

    record TenantLease(String id, String contractId, List<String> roomSlotIds, Boolean representative,
                       java.math.BigDecimal rentAmount, java.time.LocalDate joinedAt, java.time.LocalDate leftAt,
                       com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus status) { }

    record OverviewTenancy(String id, String contractId, String tenantId, com.kitolam.rentalroommanagement.modules.contracttenant.enums.ContractTenantStatus status, java.time.LocalDate joinedAt, java.time.LocalDate leftAt) { }
}
