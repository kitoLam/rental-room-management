package com.kitolam.rentalroommanagement.modules.roomservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.RoomServiceResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.repository.RoomServiceRepository;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomServiceServiceImpl implements RoomServiceService {

    private final RoomServiceRepository roomServiceRepository;

    @Override
    public RoomServiceResponse create(RoomServiceCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomServiceResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<RoomServiceResponse> search(RoomServiceFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomServiceResponse update(String id, RoomServiceUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
