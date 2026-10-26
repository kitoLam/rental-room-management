package com.kitolam.rentalroommanagement.modules.branch.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchCreateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchFilterRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.request.BranchUpdateRequest;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import org.springframework.data.domain.Pageable;

public interface BranchService {

    BranchResponse create(BranchCreateRequest request);

    BranchResponse getById(String id);

    PagedResponse<BranchResponse> search(BranchFilterRequest filter, Pageable pageable);

    BranchResponse update(String id, BranchUpdateRequest request);

    void delete(String id);
}
