package com.kitolam.rentalroommanagement.modules.tenant.service;

import java.util.List;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.MessageResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantBranchStatusRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantCreateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantFilterRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.request.TenantUpdateRequest;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantBranchStatsResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface TenantService {
    Optional<String> profileIdByEmail(String email);

    TenantResponse create(TenantCreateRequest request, AuthPrincipal principal);

    TenantResponse getById(String id, String branchId, AuthPrincipal principal);

    PagedResponse<TenantResponse> search(TenantFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    TenantBranchStatsResponse stats(String branchId, AuthPrincipal principal);

    /** Internal read-only projection. Callers must supply an already-authorized scope. */
    List<OverviewTenant> readForOverview(List<String> ids);

    record OverviewTenant(String id, String fullName, String phone) { }

    TenantResponse update(String id, TenantUpdateRequest request, AuthPrincipal principal);

    TenantResponse updateBranchStatus(String id, TenantBranchStatusRequest request, AuthPrincipal principal);

    TenantResponse updateRole(String id, TenantRoleUpdateRequest request, AuthPrincipal principal);

    MessageResponse resendVerification(String id, String branchId, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);
}
