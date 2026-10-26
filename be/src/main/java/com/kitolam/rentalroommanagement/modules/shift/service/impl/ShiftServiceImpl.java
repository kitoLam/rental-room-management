package com.kitolam.rentalroommanagement.modules.shift.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftCreateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftFilterRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.response.ShiftResponse;
import com.kitolam.rentalroommanagement.modules.shift.repository.ShiftRepository;
import com.kitolam.rentalroommanagement.modules.shift.service.ShiftService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {

    private final ShiftRepository shiftRepository;

    @Override
    public ShiftResponse create(ShiftCreateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ShiftResponse getById(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public PagedResponse<ShiftResponse> search(ShiftFilterRequest filter, Pageable pageable) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public ShiftResponse update(String id, ShiftUpdateRequest request) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    public void delete(String id) {
        // TODO: implement
        throw new UnsupportedOperationException("Not implemented yet");
    }
}
