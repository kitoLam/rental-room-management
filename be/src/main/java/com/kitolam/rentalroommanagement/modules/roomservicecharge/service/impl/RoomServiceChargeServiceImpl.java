package com.kitolam.rentalroommanagement.modules.roomservicecharge.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.request.RoomServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.dto.response.RoomServiceChargeResponse;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.repository.RoomServiceChargeRepository;
import com.kitolam.rentalroommanagement.modules.roomservicecharge.service.RoomServiceChargeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomServiceChargeServiceImpl implements RoomServiceChargeService {

    private final RoomServiceChargeRepository roomServiceChargeRepository;

    @Override
    public RoomServiceChargeResponse create(RoomServiceChargeCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomServiceChargeResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<RoomServiceChargeResponse> search(RoomServiceChargeFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomServiceChargeResponse update(String id, RoomServiceChargeUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
