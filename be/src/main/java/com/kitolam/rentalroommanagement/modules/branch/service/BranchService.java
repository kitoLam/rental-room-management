package com.kitolam.rentalroommanagement.modules.branch.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchCreateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchFilterRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchUpdateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Pageable;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.UtilityRatesRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;

public interface BranchService {
    void requireManagementAccess(String branchId, AuthPrincipal principal);
    UtilityRatesResponse utilityRates(String branchId, AuthPrincipal principal);
    UtilityRatesResponse updateUtilityRates(String branchId, UtilityRatesRequest request, AuthPrincipal principal);
    Set<String> ownedBranchIds(String accountId);
    List<BranchResponse> managedBranches(AuthPrincipal principal);

    BranchResponse create(BranchCreateRequest request);

    BranchResponse getById(String id);

    PagedResponse<BranchResponse> search(BranchFilterRequest filter, Pageable pageable);

    BranchResponse update(String id, BranchUpdateRequest request);

    void delete(String id);
}
