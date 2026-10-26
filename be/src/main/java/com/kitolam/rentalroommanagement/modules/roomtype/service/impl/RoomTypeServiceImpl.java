package com.kitolam.rentalroommanagement.modules.roomtype.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.request.RoomTypeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomtype.dto.response.RoomTypeResponse;
import com.kitolam.rentalroommanagement.modules.roomtype.repository.RoomTypeRepository;
import com.kitolam.rentalroommanagement.modules.roomtype.service.RoomTypeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomTypeServiceImpl implements RoomTypeService {

    private final RoomTypeRepository roomTypeRepository;

    @Override
    public RoomTypeResponse create(RoomTypeCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomTypeResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<RoomTypeResponse> search(RoomTypeFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomTypeResponse update(String id, RoomTypeUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
