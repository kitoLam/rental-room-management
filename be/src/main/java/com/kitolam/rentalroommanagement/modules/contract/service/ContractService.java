package com.kitolam.rentalroommanagement.modules.contract.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import org.springframework.data.domain.Pageable;

public interface ContractService {

    ContractResponse create(ContractCreateRequest request);

    ContractResponse getById(String id);

    PagedResponse<ContractResponse> search(ContractFilterRequest filter, Pageable pageable);

    ContractResponse update(String id, ContractUpdateRequest request);

    void delete(String id);
}
