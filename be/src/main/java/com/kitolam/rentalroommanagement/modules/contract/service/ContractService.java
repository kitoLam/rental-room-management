package com.kitolam.rentalroommanagement.modules.contract.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractDraftRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractServiceSelectionRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCheckInRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import org.springframework.data.domain.Pageable;

public interface ContractService {

    ContractResponse create(ContractCreateRequest request);

    ContractResponse getById(String id, AuthPrincipal principal);

    PagedResponse<ContractResponse> search(ContractFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    ContractResponse update(String id, ContractUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    ContractResponse createDraftFromBooking(String bookingId, ContractDraftRequest request, AuthPrincipal principal);

    ContractResponse selectServices(String id, ContractServiceSelectionRequest request, AuthPrincipal principal);

    ContractResponse completeCheckIn(String id, ContractCheckInRequest request, AuthPrincipal principal);
}
