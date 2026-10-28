package com.kitolam.rentalroommanagement.modules.manager.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerCreateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerFilterRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.request.ManagerUpdateRequest;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import com.kitolam.rentalroommanagement.modules.manager.mapper.ManagerMapper;
import com.kitolam.rentalroommanagement.modules.manager.repository.ManagerRepository;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ManagerServiceImpl implements ManagerService {

    private final ManagerRepository managerRepository;
    private final ManagerMapper mapper;

    @Override
    public Optional<ManagerResponse> findAssignment(String email) {
        return managerRepository.findByEmailAndIsDeletedFalse(email).map(mapper::toResponse);
    }

    @Override
    public ManagerResponse create(ManagerCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ManagerResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ManagerResponse> search(ManagerFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ManagerResponse update(String id, ManagerUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
