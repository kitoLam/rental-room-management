package com.kitolam.rentalroommanagement.modules.roomslot.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotCreateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotFilterRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.request.RoomSlotUpdateRequest;
import com.kitolam.rentalroommanagement.modules.roomslot.dto.response.RoomSlotResponse;
import com.kitolam.rentalroommanagement.modules.roomslot.repository.RoomSlotRepository;
import com.kitolam.rentalroommanagement.modules.roomslot.service.RoomSlotService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomSlotServiceImpl implements RoomSlotService {

    private final RoomSlotRepository roomSlotRepository;

    @Override
    public RoomSlotResponse create(RoomSlotCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomSlotResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<RoomSlotResponse> search(RoomSlotFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public RoomSlotResponse update(String id, RoomSlotUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
