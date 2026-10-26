package com.kitolam.rentalroommanagement.modules.furniture.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureResponse;
import com.kitolam.rentalroommanagement.modules.furniture.repository.FurnitureRepository;
import com.kitolam.rentalroommanagement.modules.furniture.service.FurnitureService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FurnitureServiceImpl implements FurnitureService {

    private final FurnitureRepository furnitureRepository;

    @Override
    public FurnitureResponse create(FurnitureCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public FurnitureResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<FurnitureResponse> search(FurnitureFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public FurnitureResponse update(String id, FurnitureUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
