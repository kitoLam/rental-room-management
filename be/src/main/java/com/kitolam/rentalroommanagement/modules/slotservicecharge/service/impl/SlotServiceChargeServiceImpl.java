package com.kitolam.rentalroommanagement.modules.slotservicecharge.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeCreateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeFilterRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.request.SlotServiceChargeUpdateRequest;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.dto.response.SlotServiceChargeResponse;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.repository.SlotServiceChargeRepository;
import com.kitolam.rentalroommanagement.modules.slotservicecharge.service.SlotServiceChargeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SlotServiceChargeServiceImpl implements SlotServiceChargeService {

    private final SlotServiceChargeRepository slotServiceChargeRepository;

    @Override
    public SlotServiceChargeResponse create(SlotServiceChargeCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public SlotServiceChargeResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<SlotServiceChargeResponse> search(SlotServiceChargeFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public SlotServiceChargeResponse update(String id, SlotServiceChargeUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
