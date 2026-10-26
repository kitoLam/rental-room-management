package com.kitolam.rentalroommanagement.modules.slotservice.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.response.SlotServiceResponse;
import com.kitolam.rentalroommanagement.modules.slotservice.repository.SlotServiceRepository;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SlotServiceServiceImpl implements SlotServiceService {

    private final SlotServiceRepository slotServiceRepository;

    @Override
    public SlotServiceResponse create(SlotServiceCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public SlotServiceResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<SlotServiceResponse> search(SlotServiceFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public SlotServiceResponse update(String id, SlotServiceUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
