package com.kitolam.rentalroommanagement.modules.contract.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractCreateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractFilterRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.request.ContractUpdateRequest;
import com.kitolam.rentalroommanagement.modules.contract.dto.response.ContractResponse;
import com.kitolam.rentalroommanagement.modules.contract.repository.ContractRepository;
import com.kitolam.rentalroommanagement.modules.contract.service.ContractService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ContractServiceImpl implements ContractService {

    private final ContractRepository contractRepository;

    @Override
    public ContractResponse create(ContractCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ContractResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ContractResponse> search(ContractFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ContractResponse update(String id, ContractUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
